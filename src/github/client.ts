import { Octokit } from '@octokit/rest';
import { PRComment, FetchResult } from '../models/comment';
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
