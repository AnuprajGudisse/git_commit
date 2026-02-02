import * as vscode from 'vscode';
import type { PRComment, FilterOptions } from '../models/comment';
import { replyToComment, getPRHeadCommit, createReviewComment } from '../github/client';
import { getCommentTreeProvider, ThreadItem, CommentItem } from '../views/commentTreeProvider';
import { showAndLog, logInfo, logError } from '../utils/logger';

// Store current repository info for actions
let currentRepoInfo: { owner: string; repo: string; prNumber: number } | null = null;

export function setCurrentRepoInfo(info: { owner: string; repo: string; prNumber: number } | null): void {
    currentRepoInfo = info;
}

export function getCurrentRepoInfo(): { owner: string; repo: string; prNumber: number } | null {
    return currentRepoInfo;
}

/**
 * Reply to a comment from the tree view or hover
 */
export async function replyToCommentCommand(item?: ThreadItem | CommentItem | number): Promise<boolean> {
    if (!currentRepoInfo) {
        showAndLog('No PR loaded. Please fetch PR comments first.', 'error');
        return false;
    }

    let commentId: number;
    
    if (typeof item === 'number') {
        commentId = item;
    } else if (item instanceof ThreadItem) {
        commentId = item.thread.rootComment.id;
    } else if (item instanceof CommentItem) {
        commentId = item.comment.id;
    } else {
        // Prompt for comment ID if not provided
        const input = await vscode.window.showInputBox({
            prompt: 'Enter comment ID to reply to',
            placeHolder: '12345',
        });
        if (!input) return false;
        commentId = parseInt(input, 10);
        if (isNaN(commentId)) {
            showAndLog('Invalid comment ID', 'error');
            return false;
        }
    }

    // Get reply text
    const replyText = await vscode.window.showInputBox({
        prompt: 'Enter your reply',
        placeHolder: 'Type your reply here...',
        validateInput: (value) => {
            if (!value || value.trim().length === 0) {
                return 'Reply cannot be empty';
            }
            return null;
        },
    });

    if (!replyText) {
        return false;
    }

    const result = await vscode.window.withProgress(
        {
            location: vscode.ProgressLocation.Notification,
            title: 'Posting reply...',
            cancellable: false,
        },
        async () => {
            return await replyToComment(
                currentRepoInfo!.owner,
                currentRepoInfo!.repo,
                currentRepoInfo!.prNumber,
                commentId,
                replyText
            );
        }
    );

    if (result.success) {
        showAndLog('Reply posted successfully!', 'info');
        // Trigger a refresh of comments
        vscode.commands.executeCommand('pr-comments.fetch');
        return true;
    } else {
        showAndLog(`Failed to post reply: ${result.error}`, 'error');
        return false;
    }
}

/**
 * Add a new comment at the current cursor position
 */
export async function addCommentCommand(): Promise<boolean> {
    if (!currentRepoInfo) {
        showAndLog('No PR loaded. Please fetch PR comments first.', 'error');
        return false;
    }

    const editor = vscode.window.activeTextEditor;
    if (!editor) {
        showAndLog('No active editor', 'error');
        return false;
    }

    const line = editor.selection.active.line + 1; // Convert to 1-based
    const relativePath = vscode.workspace.asRelativePath(editor.document.uri, false);

    // Get commit SHA
    const commitId = await getPRHeadCommit(
        currentRepoInfo.owner,
        currentRepoInfo.repo,
        currentRepoInfo.prNumber
    );

    if (!commitId) {
        showAndLog('Could not get PR commit information', 'error');
        return false;
    }

    // Get comment text
    const commentText = await vscode.window.showInputBox({
        prompt: `Add comment on ${relativePath}:${line}`,
        placeHolder: 'Type your comment here...',
        validateInput: (value) => {
            if (!value || value.trim().length === 0) {
                return 'Comment cannot be empty';
            }
            return null;
        },
    });

    if (!commentText) {
        return false;
    }

    const result = await vscode.window.withProgress(
        {
            location: vscode.ProgressLocation.Notification,
            title: 'Posting comment...',
            cancellable: false,
        },
        async () => {
            return await createReviewComment(
                currentRepoInfo!.owner,
                currentRepoInfo!.repo,
                currentRepoInfo!.prNumber,
                relativePath,
                line,
                commentText,
                commitId
            );
        }
    );

    if (result.success) {
        showAndLog('Comment posted successfully!', 'info');
        vscode.commands.executeCommand('pr-comments.fetch');
        return true;
    } else {
        showAndLog(`Failed to post comment: ${result.error}`, 'error');
        return false;
    }
}

/**
 * Filter comments by reviewer
 */
export async function filterByReviewerCommand(): Promise<void> {
    const treeProvider = getCommentTreeProvider();
    const reviewers = treeProvider.getReviewers();

    if (reviewers.length === 0) {
        showAndLog('No reviewers found. Fetch PR comments first.', 'warn');
        return;
    }

    const items = [
        { label: '$(close) Clear Filter', description: 'Show all comments', reviewer: undefined },
        ...reviewers.map(r => ({ label: `@${r}`, description: '', reviewer: r })),
    ];

    const selected = await vscode.window.showQuickPick(items, {
        placeHolder: 'Select reviewer to filter by',
    });

    if (selected) {
        if (selected.reviewer) {
            treeProvider.setFilter({ reviewer: selected.reviewer });
            logInfo(`Filtered comments by reviewer: ${selected.reviewer}`);
        } else {
            treeProvider.clearFilter();
            logInfo('Cleared comment filter');
        }
    }
}

/**
 * Filter comments by resolved status
 */
export async function filterByStatusCommand(): Promise<void> {
    const treeProvider = getCommentTreeProvider();

    const items = [
        { label: '$(list-flat) All Comments', description: 'Show all comments', resolved: undefined },
        { label: '$(comment-discussion) Unresolved', description: 'Show only unresolved comments', resolved: false },
        { label: '$(check) Resolved', description: 'Show only resolved comments', resolved: true },
    ];

    const selected = await vscode.window.showQuickPick(items, {
        placeHolder: 'Filter by status',
    });

    if (selected) {
        if (selected.resolved !== undefined) {
            treeProvider.setFilter({ resolved: selected.resolved });
            logInfo(`Filtered comments by status: ${selected.resolved ? 'resolved' : 'unresolved'}`);
        } else {
            treeProvider.clearFilter();
            logInfo('Cleared comment filter');
        }
    }
}

/**
 * Clear all filters
 */
export function clearFiltersCommand(): void {
    const treeProvider = getCommentTreeProvider();
    treeProvider.clearFilter();
    showAndLog('Filters cleared', 'info');
}

/**
 * Navigate to a comment location in the editor
 */
export async function goToCommentCommand(filePath?: string, line?: number): Promise<void> {
    if (!filePath || line === undefined) {
        logError('goToComment called without file path or line');
        return;
    }

    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
        showAndLog('No workspace folder open', 'error');
        return;
    }

    const fullPath = vscode.Uri.joinPath(workspaceFolder.uri, filePath);

    try {
        const document = await vscode.workspace.openTextDocument(fullPath);
        const editor = await vscode.window.showTextDocument(document);
        
        // Navigate to the line (convert to 0-based)
        const lineIndex = Math.max(0, line - 1);
        const range = new vscode.Range(lineIndex, 0, lineIndex, 0);
        
        editor.selection = new vscode.Selection(range.start, range.start);
        editor.revealRange(range, vscode.TextEditorRevealType.InCenter);
        
        logInfo(`Navigated to ${filePath}:${line}`);
    } catch (error) {
        logError(`Failed to open file: ${error}`);
        showAndLog(`Could not open file: ${filePath}`, 'error');
    }
}

/**
 * Refresh comments from GitHub
 */
export async function refreshCommentsCommand(): Promise<void> {
    await vscode.commands.executeCommand('pr-comments.fetch');
}

/**
 * Show comment statistics
 */
export function showStatsCommand(): void {
    const treeProvider = getCommentTreeProvider();
    const totalComments = treeProvider.getTotalCommentCount();
    const threadCount = treeProvider.getThreadCount();
    const reviewers = treeProvider.getReviewers();

    const message = [
        `📊 PR Comment Statistics`,
        ``,
        `Total Comments: ${totalComments}`,
        `Threads: ${threadCount}`,
        `Reviewers: ${reviewers.length}`,
        reviewers.length > 0 ? `  • ${reviewers.join(', ')}` : '',
    ].filter(Boolean).join('\n');

    vscode.window.showInformationMessage(message, { modal: true });
}
