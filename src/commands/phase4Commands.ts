import * as vscode from 'vscode';
import {
    resolveThread,
    unresolveThread,
    fetchIssueComments,
    createIssueComment,
    listOpenPRs,
    fetchCommentsWithThreads,
    type IssueComment,
    type PRInfo,
} from '../github/client';
import { getCurrentRepoInfo } from './commentActions';
import { logInfo, logError } from '../utils/logger';

// Store thread mappings for resolve/unresolve operations
let threadMap = new Map<number, { threadId: string; resolved: boolean }>();

// Store issue comments separately
let issueComments: IssueComment[] = [];

// Store loaded PRs for multi-PR support
let loadedPRs: Map<number, { comments: Map<string, import('../models/comment').PRComment[]> }> = new Map();

/**
 * Set the thread map from fetched data
 */
export function setThreadMap(map: Map<number, { threadId: string; resolved: boolean }>): void {
    threadMap = map;
}

/**
 * Get the thread map
 */
export function getThreadMap(): Map<number, { threadId: string; resolved: boolean }> {
    return threadMap;
}

/**
 * Get issue comments
 */
export function getIssueComments(): IssueComment[] {
    return issueComments;
}

/**
 * Get loaded PRs
 */
export function getLoadedPRs(): Map<number, { comments: Map<string, import('../models/comment').PRComment[]> }> {
    return loadedPRs;
}

/**
 * Clear all Phase 4 state
 */
export function clearPhase4State(): void {
    threadMap.clear();
    issueComments = [];
    loadedPRs.clear();
}

/**
 * Command to resolve a comment thread
 */
export async function resolveThreadCommand(commentId?: number): Promise<void> {
    const repoInfo = getCurrentRepoInfo();
    if (!repoInfo || !repoInfo.prNumber) {
        vscode.window.showErrorMessage('No PR loaded. Fetch PR comments first.');
        return;
    }

    // If no commentId provided, show quick pick of unresolved threads
    if (commentId === undefined) {
        const unresolvedThreads = Array.from(threadMap.entries())
            .filter(([_, info]) => !info.resolved);

        if (unresolvedThreads.length === 0) {
            vscode.window.showInformationMessage('No unresolved threads found.');
            return;
        }

        const items = unresolvedThreads.map(([id, info]) => ({
            label: `Thread #${id}`,
            description: info.threadId,
            commentId: id,
            threadId: info.threadId,
        }));

        const selected = await vscode.window.showQuickPick(items, {
            placeHolder: 'Select a thread to resolve',
        });

        if (!selected) {
            return;
        }

        commentId = selected.commentId;
    }

    const threadInfo = threadMap.get(commentId);
    if (!threadInfo) {
        vscode.window.showErrorMessage('Thread information not found. Try refreshing comments.');
        return;
    }

    await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: 'Resolving thread...',
        cancellable: false,
    }, async () => {
        const result = await resolveThread(
            repoInfo.owner,
            repoInfo.repo,
            threadInfo.threadId
        );

        if (result.success) {
            threadInfo.resolved = true;
            vscode.window.showInformationMessage('Thread resolved successfully.');
            // Trigger refresh
            vscode.commands.executeCommand('pr-comments.refresh');
        } else {
            vscode.window.showErrorMessage(`Failed to resolve thread: ${result.error}`);
        }
    });
}

/**
 * Command to unresolve a comment thread
 */
export async function unresolveThreadCommand(commentId?: number): Promise<void> {
    const repoInfo = getCurrentRepoInfo();
    if (!repoInfo || !repoInfo.prNumber) {
        vscode.window.showErrorMessage('No PR loaded. Fetch PR comments first.');
        return;
    }

    // If no commentId provided, show quick pick of resolved threads
    if (commentId === undefined) {
        const resolvedThreads = Array.from(threadMap.entries())
            .filter(([_, info]) => info.resolved);

        if (resolvedThreads.length === 0) {
            vscode.window.showInformationMessage('No resolved threads found.');
            return;
        }

        const items = resolvedThreads.map(([id, info]) => ({
            label: `Thread #${id}`,
            description: info.threadId,
            commentId: id,
            threadId: info.threadId,
        }));

        const selected = await vscode.window.showQuickPick(items, {
            placeHolder: 'Select a thread to unresolve',
        });

        if (!selected) {
            return;
        }

        commentId = selected.commentId;
    }

    const threadInfo = threadMap.get(commentId);
    if (!threadInfo) {
        vscode.window.showErrorMessage('Thread information not found. Try refreshing comments.');
        return;
    }

    await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: 'Unresolving thread...',
        cancellable: false,
    }, async () => {
        const result = await unresolveThread(
            repoInfo.owner,
            repoInfo.repo,
            threadInfo.threadId
        );

        if (result.success) {
            threadInfo.resolved = false;
            vscode.window.showInformationMessage('Thread unresolved successfully.');
            vscode.commands.executeCommand('pr-comments.refresh');
        } else {
            vscode.window.showErrorMessage(`Failed to unresolve thread: ${result.error}`);
        }
    });
}

/**
 * Command to show PR conversation (issue comments)
 */
export async function showConversationCommand(): Promise<void> {
    const repoInfo = getCurrentRepoInfo();
    if (!repoInfo || !repoInfo.prNumber) {
        vscode.window.showErrorMessage('No PR loaded. Fetch PR comments first.');
        return;
    }

    await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: 'Fetching PR conversation...',
        cancellable: false,
    }, async () => {
        const result = await fetchIssueComments(
            repoInfo.owner,
            repoInfo.repo,
            repoInfo.prNumber!
        );

        if (!result.success) {
            vscode.window.showErrorMessage(`Failed to fetch conversation: ${result.error}`);
            return;
        }

        issueComments = result.comments;

        if (issueComments.length === 0) {
            vscode.window.showInformationMessage('No conversation comments found.');
            return;
        }

        // Show in a webview or quick pick
        const items = issueComments.map(comment => ({
            label: `@${comment.user}`,
            description: new Date(comment.createdAt).toLocaleString(),
            detail: comment.body.substring(0, 100) + (comment.body.length > 100 ? '...' : ''),
            comment,
        }));

        const selected = await vscode.window.showQuickPick(items, {
            placeHolder: `PR #${repoInfo.prNumber} Conversation (${issueComments.length} comments)`,
            matchOnDescription: true,
            matchOnDetail: true,
        });

        if (selected) {
            // Show full comment in a new document
            const doc = await vscode.workspace.openTextDocument({
                content: `# Comment by @${selected.comment.user}\n\n${selected.comment.body}\n\n---\n*Posted: ${new Date(selected.comment.createdAt).toLocaleString()}*`,
                language: 'markdown',
            });
            await vscode.window.showTextDocument(doc, { preview: true });
        }
    });
}

/**
 * Command to add a conversation comment (issue comment)
 */
export async function addConversationCommentCommand(): Promise<void> {
    const repoInfo = getCurrentRepoInfo();
    if (!repoInfo || !repoInfo.prNumber) {
        vscode.window.showErrorMessage('No PR loaded. Fetch PR comments first.');
        return;
    }

    const body = await vscode.window.showInputBox({
        prompt: 'Enter your comment',
        placeHolder: 'Write a comment on the PR conversation...',
        validateInput: (value) => {
            if (!value || value.trim().length === 0) {
                return 'Comment cannot be empty';
            }
            return null;
        },
    });

    if (!body) {
        return;
    }

    await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: 'Posting comment...',
        cancellable: false,
    }, async () => {
        const result = await createIssueComment(
            repoInfo.owner,
            repoInfo.repo,
            repoInfo.prNumber!,
            body
        );

        if (result.success) {
            vscode.window.showInformationMessage('Comment posted successfully.');
            logInfo(`Posted conversation comment on PR #${repoInfo.prNumber}`);
        } else {
            vscode.window.showErrorMessage(`Failed to post comment: ${result.error}`);
        }
    });
}

/**
 * Command to switch between PRs (multi-PR support)
 */
export async function switchPRCommand(): Promise<void> {
    const repoInfo = getCurrentRepoInfo();
    if (!repoInfo) {
        vscode.window.showErrorMessage('No repository detected. Open a Git repository first.');
        return;
    }

    await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: 'Fetching open PRs...',
        cancellable: false,
    }, async () => {
        const result = await listOpenPRs(repoInfo.owner, repoInfo.repo);

        if (!result.success) {
            vscode.window.showErrorMessage(`Failed to fetch PRs: ${result.error}`);
            return;
        }

        if (result.prs.length === 0) {
            vscode.window.showInformationMessage('No open PRs found in this repository.');
            return;
        }

        const items: vscode.QuickPickItem[] = result.prs.map(pr => ({
            label: `#${pr.number}: ${pr.title}`,
            description: pr.draft ? '$(git-pull-request-draft) Draft' : '$(git-pull-request)',
            detail: `${pr.headBranch} → ${pr.baseBranch} | by @${pr.author} | Updated ${new Date(pr.updatedAt).toLocaleDateString()}`,
            pr,
        } as vscode.QuickPickItem & { pr: PRInfo }));

        const selected = await vscode.window.showQuickPick(items, {
            placeHolder: 'Select a PR to view comments',
            matchOnDescription: true,
            matchOnDetail: true,
        });

        if (selected && 'pr' in selected) {
            const pr = (selected as { pr: PRInfo }).pr;
            // Update the current PR number and fetch comments
            logInfo(`Switching to PR #${pr.number}`);
            
            // Execute fetch with the new PR number
            await vscode.commands.executeCommand('pr-comments.fetchWithPR', pr.number);
        }
    });
}

/**
 * Command to fetch comments with thread resolution status
 */
export async function fetchWithThreadsCommand(): Promise<{
    success: boolean;
    comments: import('../models/comment').PRComment[];
    threads: Map<number, { threadId: string; resolved: boolean }>;
} | null> {
    const repoInfo = getCurrentRepoInfo();
    if (!repoInfo || !repoInfo.prNumber) {
        vscode.window.showErrorMessage('No PR loaded. Fetch PR comments first.');
        return null;
    }

    const result = await fetchCommentsWithThreads(
        repoInfo.owner,
        repoInfo.repo,
        repoInfo.prNumber
    );

    if (result.success) {
        threadMap = result.threads;
        logInfo(`Loaded ${result.threads.size} thread mappings`);
    }

    return result;
}

/**
 * Command to show thread resolution statistics
 */
export async function showThreadStatsCommand(): Promise<void> {
    const repoInfo = getCurrentRepoInfo();
    if (!repoInfo || !repoInfo.prNumber) {
        vscode.window.showErrorMessage('No PR loaded. Fetch PR comments first.');
        return;
    }

    const totalThreads = threadMap.size;
    const resolvedThreads = Array.from(threadMap.values()).filter(t => t.resolved).length;
    const unresolvedThreads = totalThreads - resolvedThreads;

    const message = [
        `📊 PR #${repoInfo.prNumber} Thread Statistics`,
        '',
        `Total Threads: ${totalThreads}`,
        `✅ Resolved: ${resolvedThreads}`,
        `❌ Unresolved: ${unresolvedThreads}`,
        '',
        totalThreads > 0 && unresolvedThreads > 0 
            ? `${Math.round((resolvedThreads / totalThreads) * 100)}% complete`
            : '🎉 All threads resolved!',
    ].join('\n');

    vscode.window.showInformationMessage(message, { modal: true });
}

/**
 * Command to toggle thread resolution from TreeView context
 */
export async function toggleThreadResolutionCommand(item?: { commentId?: number; resolved?: boolean }): Promise<void> {
    if (!item || item.commentId === undefined) {
        vscode.window.showErrorMessage('No thread selected.');
        return;
    }

    if (item.resolved) {
        await unresolveThreadCommand(item.commentId);
    } else {
        await resolveThreadCommand(item.commentId);
    }
}
