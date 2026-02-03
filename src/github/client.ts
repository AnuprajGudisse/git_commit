import { Octokit } from '@octokit/rest';
import { PRComment, FetchResult, ReplyResult } from '../models/comment';
import { getConfig, getGitHubApiBaseUrl, validateToken } from '../utils/config';
import { logInfo, logError, logWarn } from '../utils/logger';

const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY_MS = 1000;

interface GitHubError {
    status?: number;
    message?: string;
    response?: {
        headers?: {
            'x-ratelimit-remaining'?: string;
            'x-ratelimit-reset'?: string;
            'retry-after'?: string;
        };
    };
}

function isGitHubError(error: unknown): error is GitHubError {
    return typeof error === 'object' && error !== null;
}

function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function calculateRetryDelay(attempt: number, retryAfter?: string): number {
    if (retryAfter) {
        const seconds = parseInt(retryAfter, 10);
        if (!isNaN(seconds)) {
            return seconds * 1000;
        }
    }
    // Exponential backoff: 1s, 2s, 4s
    return INITIAL_RETRY_DELAY_MS * Math.pow(2, attempt);
}

export function createOctokitClient(token?: string): Octokit {
    const config = getConfig();
    const authToken = token || config.githubToken;
    const baseUrl = getGitHubApiBaseUrl();

    const options: ConstructorParameters<typeof Octokit>[0] = {
        auth: authToken,
    };

    if (baseUrl !== 'https://api.github.com') {
        options.baseUrl = baseUrl;
    }

    return new Octokit(options);
}

export async function validateGitHubToken(token: string): Promise<{ valid: boolean; message: string }> {
    // First do local validation
    const localValidation = validateToken(token);
    if (!localValidation.valid) {
        return { valid: false, message: localValidation.message || 'Invalid token format' };
    }

    // Then validate against GitHub API
    try {
        const octokit = createOctokitClient(token);
        const { data } = await octokit.users.getAuthenticated();
        logInfo(`Token validated for user: ${data.login}`);
        return { valid: true, message: `Authenticated as ${data.login}` };
    } catch (error) {
        if (isGitHubError(error)) {
            if (error.status === 401) {
                return { valid: false, message: 'Token is invalid or expired' };
            }
            if (error.status === 403) {
                return { valid: false, message: 'Token lacks required permissions' };
            }
        }
        logError(`Token validation failed: ${error}`);
        return { valid: false, message: 'Failed to validate token' };
    }
}

export async function fetchPRCommentsWithRetry(
    owner: string,
    repo: string,
    prNumber: number,
    token?: string
): Promise<FetchResult> {
    const config = getConfig();
    const authToken = token || config.githubToken;

    if (!authToken) {
        return {
            success: false,
            comments: [],
            error: 'GitHub token is not configured. Please set prComments.githubToken in settings.',
        };
    }

    const tokenValidation = validateToken(authToken);
    if (!tokenValidation.valid) {
        return {
            success: false,
            comments: [],
            error: tokenValidation.message,
        };
    }

    const octokit = createOctokitClient(authToken);
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
        try {
            logInfo(`Fetching PR comments (attempt ${attempt + 1}/${MAX_RETRIES}): ${owner}/${repo}#${prNumber}`);

            const { data: comments, headers } = await octokit.pulls.listReviewComments({
                owner,
                repo,
                pull_number: prNumber,
                per_page: 100,
            });

            const rateLimitRemaining = headers['x-ratelimit-remaining'] 
                ? parseInt(headers['x-ratelimit-remaining'], 10) 
                : undefined;
            const rateLimitReset = headers['x-ratelimit-reset']
                ? new Date(parseInt(headers['x-ratelimit-reset'], 10) * 1000)
                : undefined;

            if (rateLimitRemaining !== undefined && rateLimitRemaining < 10) {
                logWarn(`GitHub API rate limit low: ${rateLimitRemaining} remaining`);
            }

            const prComments: PRComment[] = comments
                .filter(comment => comment.path && comment.line !== undefined && comment.line !== null)
                .map(comment => ({
                    path: comment.path,
                    line: comment.line!,
                    body: comment.body || '',
                    user: comment.user?.login || 'Unknown',
                    id: comment.id,
                    createdAt: comment.created_at,
                    updatedAt: comment.updated_at,
                    inReplyToId: comment.in_reply_to_id,
                    // Phase 3: Include diff context
                    diffHunk: comment.diff_hunk,
                    commitId: comment.commit_id,
                    authorAssociation: comment.author_association,
                }));

            logInfo(`Fetched ${prComments.length} comments`);

            return {
                success: true,
                comments: prComments,
                rateLimitRemaining,
                rateLimitReset,
            };
        } catch (error) {
            lastError = error instanceof Error ? error : new Error(String(error));
            
            if (isGitHubError(error)) {
                const status = error.status;
                const retryAfter = error.response?.headers?.['retry-after'];

                // Don't retry on authentication errors
                if (status === 401) {
                    return {
                        success: false,
                        comments: [],
                        error: 'Authentication failed. Please check your GitHub token.',
                    };
                }

                // Don't retry on not found
                if (status === 404) {
                    return {
                        success: false,
                        comments: [],
                        error: `PR #${prNumber} not found in ${owner}/${repo}. Check the PR number and repository.`,
                    };
                }

                // Rate limit - wait and retry
                if (status === 403 || status === 429) {
                    const delay = calculateRetryDelay(attempt, retryAfter);
                    logWarn(`Rate limited. Waiting ${delay}ms before retry...`);
                    await sleep(delay);
                    continue;
                }

                // Server errors - retry with backoff
                if (status && status >= 500) {
                    const delay = calculateRetryDelay(attempt);
                    logWarn(`Server error (${status}). Waiting ${delay}ms before retry...`);
                    await sleep(delay);
                    continue;
                }
            }

            // For other errors, retry with backoff
            if (attempt < MAX_RETRIES - 1) {
                const delay = calculateRetryDelay(attempt);
                logWarn(`Request failed. Waiting ${delay}ms before retry...`);
                await sleep(delay);
            }
        }
    }

    logError(`Failed to fetch PR comments after ${MAX_RETRIES} attempts`);
    return {
        success: false,
        comments: [],
        error: lastError?.message || 'Failed to fetch PR comments after multiple attempts',
    };
}

export async function checkRateLimit(token?: string): Promise<{
    remaining: number;
    limit: number;
    reset: Date;
} | null> {
    try {
        const octokit = createOctokitClient(token);
        const { data } = await octokit.rateLimit.get();
        
        return {
            remaining: data.rate.remaining,
            limit: data.rate.limit,
            reset: new Date(data.rate.reset * 1000),
        };
    } catch (error) {
        logError(`Failed to check rate limit: ${error}`);
        return null;
    }
}

/**
 * Reply to an existing PR review comment
 */
export async function replyToComment(
    owner: string,
    repo: string,
    prNumber: number,
    commentId: number,
    body: string,
    token?: string
): Promise<ReplyResult> {
    const config = getConfig();
    const authToken = token || config.githubToken;

    if (!authToken) {
        return {
            success: false,
            error: 'GitHub token is not configured.',
        };
    }

    if (!body || body.trim().length === 0) {
        return {
            success: false,
            error: 'Reply body cannot be empty.',
        };
    }

    try {
        const octokit = createOctokitClient(authToken);
        logInfo(`Replying to comment ${commentId} on PR #${prNumber}`);

        const { data } = await octokit.pulls.createReplyForReviewComment({
            owner,
            repo,
            pull_number: prNumber,
            comment_id: commentId,
            body: body.trim(),
        });

        logInfo(`Successfully created reply comment ${data.id}`);

        return {
            success: true,
            comment: {
                path: data.path,
                line: data.line || data.original_line || 0,
                body: data.body || '',
                user: data.user?.login || 'Unknown',
                id: data.id,
                createdAt: data.created_at,
                updatedAt: data.updated_at,
                inReplyToId: data.in_reply_to_id,
            },
        };
    } catch (error) {
        logError(`Failed to reply to comment: ${error}`);
        
        if (isGitHubError(error)) {
            if (error.status === 401) {
                return { success: false, error: 'Authentication failed. Check your token.' };
            }
            if (error.status === 403) {
                return { success: false, error: 'Permission denied. Token may lack write access.' };
            }
            if (error.status === 404) {
                return { success: false, error: 'Comment or PR not found.' };
            }
        }

        return {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to post reply',
        };
    }
}

/**
 * Create a new review comment on a PR
 */
export async function createReviewComment(
    owner: string,
    repo: string,
    prNumber: number,
    path: string,
    line: number,
    body: string,
    commitId: string,
    token?: string
): Promise<ReplyResult> {
    const config = getConfig();
    const authToken = token || config.githubToken;

    if (!authToken) {
        return {
            success: false,
            error: 'GitHub token is not configured.',
        };
    }

    if (!body || body.trim().length === 0) {
        return {
            success: false,
            error: 'Comment body cannot be empty.',
        };
    }

    try {
        const octokit = createOctokitClient(authToken);
        logInfo(`Creating review comment on ${path}:${line} for PR #${prNumber}`);

        const { data } = await octokit.pulls.createReviewComment({
            owner,
            repo,
            pull_number: prNumber,
            body: body.trim(),
            commit_id: commitId,
            path,
            line,
        });

        logInfo(`Successfully created comment ${data.id}`);

        return {
            success: true,
            comment: {
                path: data.path,
                line: data.line || data.original_line || line,
                body: data.body || '',
                user: data.user?.login || 'Unknown',
                id: data.id,
                createdAt: data.created_at,
                updatedAt: data.updated_at,
            },
        };
    } catch (error) {
        logError(`Failed to create comment: ${error}`);
        
        if (isGitHubError(error)) {
            if (error.status === 401) {
                return { success: false, error: 'Authentication failed.' };
            }
            if (error.status === 403) {
                return { success: false, error: 'Permission denied.' };
            }
            if (error.status === 422) {
                return { success: false, error: 'Invalid comment location. Line may not be part of the diff.' };
            }
        }

        return {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to create comment',
        };
    }
}

/**
 * Get the latest commit SHA for a PR
 */
export async function getPRHeadCommit(
    owner: string,
    repo: string,
    prNumber: number,
    token?: string
): Promise<string | null> {
    const config = getConfig();
    const authToken = token || config.githubToken;

    if (!authToken) {
        return null;
    }

    try {
        const octokit = createOctokitClient(authToken);
        const { data } = await octokit.pulls.get({
            owner,
            repo,
            pull_number: prNumber,
        });

        return data.head.sha;
    } catch (error) {
        logError(`Failed to get PR head commit: ${error}`);
        return null;
    }
}

/**
 * Get list of reviewers who have commented on the PR
 */
export async function getPRReviewers(
    owner: string,
    repo: string,
    prNumber: number,
    token?: string
): Promise<string[]> {
    const config = getConfig();
    const authToken = token || config.githubToken;

    if (!authToken) {
        return [];
    }

    try {
        const octokit = createOctokitClient(authToken);
        const { data: reviews } = await octokit.pulls.listReviews({
            owner,
            repo,
            pull_number: prNumber,
        });

        const reviewers = new Set<string>();
        for (const review of reviews) {
            if (review.user?.login) {
                reviewers.add(review.user.login);
            }
        }

        return Array.from(reviewers).sort();
    } catch (error) {
        logError(`Failed to get PR reviewers: ${error}`);
        return [];
    }
}

// ============================================================================
// Phase 4: Resolve/Unresolve, Issue Comments, Multi-PR Support
// ============================================================================

export interface ResolveResult {
    success: boolean;
    error?: string;
}

/**
 * Resolve a review thread using GraphQL API
 * Note: GitHub REST API doesn't support resolving threads, must use GraphQL
 */
export async function resolveThread(
    owner: string,
    repo: string,
    threadId: string,
    token?: string
): Promise<ResolveResult> {
    const config = getConfig();
    const authToken = token || config.githubToken;

    if (!authToken) {
        return { success: false, error: 'GitHub token is not configured.' };
    }

    try {
        const octokit = createOctokitClient(authToken);
        logInfo(`Resolving thread ${threadId}`);

        // Use GraphQL to resolve the thread
        await octokit.graphql(`
            mutation ResolveThread($threadId: ID!) {
                resolveReviewThread(input: { threadId: $threadId }) {
                    thread {
                        isResolved
                    }
                }
            }
        `, { threadId });

        logInfo(`Successfully resolved thread ${threadId}`);
        return { success: true };
    } catch (error) {
        logError(`Failed to resolve thread: ${error}`);
        
        if (isGitHubError(error)) {
            if (error.status === 401) {
                return { success: false, error: 'Authentication failed.' };
            }
            if (error.status === 403) {
                return { success: false, error: 'Permission denied.' };
            }
        }

        return {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to resolve thread',
        };
    }
}

/**
 * Unresolve a review thread using GraphQL API
 */
export async function unresolveThread(
    owner: string,
    repo: string,
    threadId: string,
    token?: string
): Promise<ResolveResult> {
    const config = getConfig();
    const authToken = token || config.githubToken;

    if (!authToken) {
        return { success: false, error: 'GitHub token is not configured.' };
    }

    try {
        const octokit = createOctokitClient(authToken);
        logInfo(`Unresolving thread ${threadId}`);

        await octokit.graphql(`
            mutation UnresolveThread($threadId: ID!) {
                unresolveReviewThread(input: { threadId: $threadId }) {
                    thread {
                        isResolved
                    }
                }
            }
        `, { threadId });

        logInfo(`Successfully unresolved thread ${threadId}`);
        return { success: true };
    } catch (error) {
        logError(`Failed to unresolve thread: ${error}`);
        
        if (isGitHubError(error)) {
            if (error.status === 401) {
                return { success: false, error: 'Authentication failed.' };
            }
            if (error.status === 403) {
                return { success: false, error: 'Permission denied.' };
            }
        }

        return {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to unresolve thread',
        };
    }
}

export interface IssueComment {
    id: number;
    body: string;
    user: string;
    createdAt: string;
    updatedAt?: string;
    authorAssociation?: string;
}

export interface IssueCommentsResult {
    success: boolean;
    comments: IssueComment[];
    error?: string;
}

/**
 * Fetch issue/PR conversation comments (not review comments)
 */
export async function fetchIssueComments(
    owner: string,
    repo: string,
    prNumber: number,
    token?: string
): Promise<IssueCommentsResult> {
    const config = getConfig();
    const authToken = token || config.githubToken;

    if (!authToken) {
        return { success: false, comments: [], error: 'GitHub token is not configured.' };
    }

    try {
        const octokit = createOctokitClient(authToken);
        logInfo(`Fetching issue comments for PR #${prNumber}`);

        const { data } = await octokit.issues.listComments({
            owner,
            repo,
            issue_number: prNumber,
            per_page: 100,
        });

        const comments: IssueComment[] = data.map(comment => ({
            id: comment.id,
            body: comment.body || '',
            user: comment.user?.login || 'Unknown',
            createdAt: comment.created_at,
            updatedAt: comment.updated_at,
            authorAssociation: comment.author_association,
        }));

        logInfo(`Fetched ${comments.length} issue comments`);
        return { success: true, comments };
    } catch (error) {
        logError(`Failed to fetch issue comments: ${error}`);
        
        return {
            success: false,
            comments: [],
            error: error instanceof Error ? error.message : 'Failed to fetch issue comments',
        };
    }
}

/**
 * Post a new issue/PR conversation comment
 */
export async function createIssueComment(
    owner: string,
    repo: string,
    prNumber: number,
    body: string,
    token?: string
): Promise<ReplyResult> {
    const config = getConfig();
    const authToken = token || config.githubToken;

    if (!authToken) {
        return { success: false, error: 'GitHub token is not configured.' };
    }

    if (!body || body.trim().length === 0) {
        return { success: false, error: 'Comment body cannot be empty.' };
    }

    try {
        const octokit = createOctokitClient(authToken);
        logInfo(`Creating issue comment on PR #${prNumber}`);

        const { data } = await octokit.issues.createComment({
            owner,
            repo,
            issue_number: prNumber,
            body: body.trim(),
        });

        logInfo(`Successfully created issue comment ${data.id}`);

        return {
            success: true,
            comment: {
                path: '',
                line: 0,
                body: data.body || '',
                user: data.user?.login || 'Unknown',
                id: data.id,
                createdAt: data.created_at,
                updatedAt: data.updated_at,
            },
        };
    } catch (error) {
        logError(`Failed to create issue comment: ${error}`);
        
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to create comment',
        };
    }
}

export interface PRInfo {
    number: number;
    title: string;
    state: string;
    author: string;
    createdAt: string;
    updatedAt: string;
    headBranch: string;
    baseBranch: string;
    draft: boolean;
    reviewCommentCount: number;
}

export interface ListPRsResult {
    success: boolean;
    prs: PRInfo[];
    error?: string;
}

/**
 * List open PRs for a repository (for multi-PR support)
 */
export async function listOpenPRs(
    owner: string,
    repo: string,
    token?: string
): Promise<ListPRsResult> {
    const config = getConfig();
    const authToken = token || config.githubToken;

    if (!authToken) {
        return { success: false, prs: [], error: 'GitHub token is not configured.' };
    }

    try {
        const octokit = createOctokitClient(authToken);
        logInfo(`Fetching open PRs for ${owner}/${repo}`);

        const { data } = await octokit.pulls.list({
            owner,
            repo,
            state: 'open',
            per_page: 50,
            sort: 'updated',
            direction: 'desc',
        });

        const prs: PRInfo[] = data.map(pr => ({
            number: pr.number,
            title: pr.title,
            state: pr.state,
            author: pr.user?.login || 'Unknown',
            createdAt: pr.created_at,
            updatedAt: pr.updated_at,
            headBranch: pr.head.ref,
            baseBranch: pr.base.ref,
            draft: pr.draft || false,
            reviewCommentCount: 0, // Will be populated when fetching comments
        }));

        logInfo(`Found ${prs.length} open PRs`);
        return { success: true, prs };
    } catch (error) {
        logError(`Failed to list PRs: ${error}`);
        
        return {
            success: false,
            prs: [],
            error: error instanceof Error ? error.message : 'Failed to list PRs',
        };
    }
}

/**
 * Fetch comments with thread resolution status using GraphQL
 */
export async function fetchCommentsWithThreads(
    owner: string,
    repo: string,
    prNumber: number,
    token?: string
): Promise<FetchResult & { threads: Map<number, { threadId: string; resolved: boolean }> }> {
    const config = getConfig();
    const authToken = token || config.githubToken;

    if (!authToken) {
        return { 
            success: false, 
            comments: [], 
            threads: new Map(),
            error: 'GitHub token is not configured.' 
        };
    }

    try {
        const octokit = createOctokitClient(authToken);
        logInfo(`Fetching comments with thread info for PR #${prNumber}`);

        // Use GraphQL to get thread resolution status
        const response = await octokit.graphql<{
            repository: {
                pullRequest: {
                    reviewThreads: {
                        nodes: Array<{
                            id: string;
                            isResolved: boolean;
                            comments: {
                                nodes: Array<{
                                    databaseId: number;
                                    path: string;
                                    line: number | null;
                                    body: string;
                                    author: { login: string } | null;
                                    createdAt: string;
                                    updatedAt: string;
                                    replyTo: { databaseId: number } | null;
                                    diffHunk: string;
                                    commit: { oid: string } | null;
                                    authorAssociation: string;
                                }>;
                            };
                        }>;
                    };
                };
            };
        }>(`
            query GetPRThreads($owner: String!, $repo: String!, $prNumber: Int!) {
                repository(owner: $owner, name: $repo) {
                    pullRequest(number: $prNumber) {
                        reviewThreads(first: 100) {
                            nodes {
                                id
                                isResolved
                                comments(first: 100) {
                                    nodes {
                                        databaseId
                                        path
                                        line
                                        body
                                        author { login }
                                        createdAt
                                        updatedAt
                                        replyTo { databaseId }
                                        diffHunk
                                        commit { oid }
                                        authorAssociation
                                    }
                                }
                            }
                        }
                    }
                }
            }
        `, { owner, repo, prNumber });

        const comments: PRComment[] = [];
        const threads = new Map<number, { threadId: string; resolved: boolean }>();

        for (const thread of response.repository.pullRequest.reviewThreads.nodes) {
            for (const comment of thread.comments.nodes) {
                comments.push({
                    path: comment.path,
                    line: comment.line || 0,
                    body: comment.body,
                    user: comment.author?.login || 'Unknown',
                    id: comment.databaseId,
                    createdAt: comment.createdAt,
                    updatedAt: comment.updatedAt,
                    inReplyToId: comment.replyTo?.databaseId,
                    resolved: thread.isResolved,
                    diffHunk: comment.diffHunk,
                    commitId: comment.commit?.oid,
                    authorAssociation: comment.authorAssociation,
                });

                // Map comment ID to thread info
                threads.set(comment.databaseId, {
                    threadId: thread.id,
                    resolved: thread.isResolved,
                });
            }
        }

        logInfo(`Fetched ${comments.length} comments in ${threads.size} threads`);
        return { success: true, comments, threads };
    } catch (error) {
        logError(`Failed to fetch comments with threads: ${error}`);
        
        return {
            success: false,
            comments: [],
            threads: new Map(),
            error: error instanceof Error ? error.message : 'Failed to fetch comments',
        };
    }
}
