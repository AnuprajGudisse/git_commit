import * as vscode from 'vscode';
import { PRComment } from '../models/comment';
import { getRepositoryInfo, selectWorkspaceFolder, getAllWorkspaceFolders } from '../git/repository';
import { fetchPRCommentsWithRetry } from '../github/client';
import { updateDecorations, clearDecorations } from '../decorators/lineHighlight';
import { logInfo, showAndLog } from '../utils/logger';
import { hasValidToken } from '../utils/config';

// Global storage for comments
const commentsByFile = new Map<string, PRComment[]>();

export function getCommentsByFile(): Map<string, PRComment[]> {
    return commentsByFile;
}

export function clearCommentsStorage(): void {
    commentsByFile.clear();
}

export async function fetchPRComments(): Promise<boolean> {
    if (!hasValidToken()) {
        showAndLog(
            'Please configure your GitHub token in settings (prComments.githubToken)',
            'error'
        );
        
        // Offer to open settings
        const action = await vscode.window.showErrorMessage(
            'GitHub token not configured',
            'Open Settings'
        );
        
        if (action === 'Open Settings') {
            vscode.commands.executeCommand('workbench.action.openSettings', 'prComments.githubToken');
        }
        
        return false;
    }

    // Handle multi-workspace
    const folders = getAllWorkspaceFolders();
    let workspaceFolder: vscode.WorkspaceFolder | undefined;

    if (folders.length === 0) {
        showAndLog('No workspace folder open', 'error');
        return false;
    } else if (folders.length === 1) {
        workspaceFolder = folders[0];
    } else {
        workspaceFolder = await selectWorkspaceFolder();
        if (!workspaceFolder) {
            return false;
        }
    }

    // Get repository info
    const repoInfo = await getRepositoryInfo(workspaceFolder);
    if (!repoInfo) {
        showAndLog(
            'Could not determine repository information. Make sure you are in a Git repository.',
            'error'
        );
        return false;
    }

    const { owner, repo, prNumber } = repoInfo;

    if (!prNumber) {
        showAndLog('Could not determine PR number.', 'error');
        return false;
    }

    // Show progress
    return vscode.window.withProgress(
        {
            location: vscode.ProgressLocation.Notification,
            title: `Fetching PR #${prNumber} comments...`,
            cancellable: false,
        },
        async (progress) => {
            progress.report({ increment: 0 });

            const result = await fetchPRCommentsWithRetry(owner, repo, prNumber);

            if (!result.success) {
                showAndLog(result.error || 'Failed to fetch PR comments', 'error');
                return false;
            }

            progress.report({ increment: 50, message: 'Processing comments...' });

            // Clear existing comments
            commentsByFile.clear();

            // Process and store comments
            for (const comment of result.comments) {
                if (!commentsByFile.has(comment.path)) {
                    commentsByFile.set(comment.path, []);
                }
                commentsByFile.get(comment.path)!.push(comment);
            }

            logInfo(`Stored comments for ${commentsByFile.size} files`);

            progress.report({ increment: 100, message: 'Done!' });

            // Update decorations for current editor
            const editor = vscode.window.activeTextEditor;
            if (editor) {
                updateDecorations(editor, commentsByFile);
            }

            // Show rate limit warning if low
            if (result.rateLimitRemaining !== undefined && result.rateLimitRemaining < 10) {
                showAndLog(
                    `Loaded ${result.comments.length} comments. Warning: API rate limit low (${result.rateLimitRemaining} remaining)`,
                    'warn'
                );
            } else {
                showAndLog(`Loaded ${result.comments.length} PR comments`, 'info');
            }

            return true;
        }
    );
}

export function clearComments(): void {
    commentsByFile.clear();
    const editor = vscode.window.activeTextEditor;
    if (editor) {
        clearDecorations(editor);
    }
    showAndLog('PR comments cleared', 'info');
}
