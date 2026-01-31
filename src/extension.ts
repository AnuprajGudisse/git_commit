import * as vscode from 'vscode';
import { fetchPRComments, getCommentsByFile, clearCommentsStorage } from './commands/fetchComments';
import { createDecorationType, updateDecorations, disposeDecorationType, clearDecorations } from './decorators/lineHighlight';
import { getLogger, logInfo, disposeLogger } from './utils/logger';
import { getConfig } from './utils/config';
import { getCommentTreeProvider, disposeCommentTreeProvider } from './views/commentTreeProvider';
import {
    replyToCommentCommand,
    addCommentCommand,
    filterByReviewerCommand,
    filterByStatusCommand,
    clearFiltersCommand,
    goToCommentCommand,
    refreshCommentsCommand,
    showStatsCommand,
    setCurrentRepoInfo,
    getCurrentRepoInfo,
} from './commands/commentActions';
import {
    startAutoRefresh,
    stopAutoRefresh,
    updateAutoRefreshInterval,
    createAutoRefreshStatusBarItem,
    updateStatusBarItem,
    disposeAutoRefresh,
} from './utils/autoRefresh';

let statusBarItem: vscode.StatusBarItem | undefined;

export function activate(context: vscode.ExtensionContext) {
    logInfo('PR Comments Viewer extension is now active');

    // Create decoration type for highlighting commented lines
    createDecorationType();

    // Register TreeView
    const treeProvider = getCommentTreeProvider();
    const treeView = vscode.window.createTreeView('prCommentsView', {
        treeDataProvider: treeProvider,
        showCollapseAll: true,
    });
    context.subscriptions.push(treeView);

    // Register fetch command with TreeView update
    const fetchCommand = vscode.commands.registerCommand('pr-comments.fetch', async () => {
        const result = await fetchPRComments();
        if (result) {
            // Update TreeView with comments
            treeProvider.setComments(getCommentsByFile());
            // Show TreeView
            vscode.commands.executeCommand('setContext', 'prComments.hasComments', true);
        }
    });

    // Register clear command
    const clearCommand = vscode.commands.registerCommand('pr-comments.clear', () => {
        clearCommentsStorage();
        setCurrentRepoInfo(null);
        const editor = vscode.window.activeTextEditor;
        if (editor) {
            clearDecorations(editor);
        }
        treeProvider.setComments(new Map());
        vscode.commands.executeCommand('setContext', 'prComments.hasComments', false);
        vscode.commands.executeCommand('setContext', 'prComments.hasRepoInfo', false);
        vscode.window.showInformationMessage('PR comments cleared');
    });

    // Register show log command
    const showLogCommand = vscode.commands.registerCommand('pr-comments.showLog', () => {
        getLogger().show();
    });

    // Phase 2 commands
    const replyCommand = vscode.commands.registerCommand('pr-comments.reply', replyToCommentCommand);
    const addCommentCmd = vscode.commands.registerCommand('pr-comments.addComment', addCommentCommand);
    const filterByReviewerCmd = vscode.commands.registerCommand('pr-comments.filterByReviewer', filterByReviewerCommand);
    const filterByStatusCmd = vscode.commands.registerCommand('pr-comments.filterByStatus', filterByStatusCommand);
    const clearFiltersCmd = vscode.commands.registerCommand('pr-comments.clearFilters', clearFiltersCommand);
    const goToCommentCmd = vscode.commands.registerCommand('pr-comments.goToComment', goToCommentCommand);
    const refreshCmd = vscode.commands.registerCommand('pr-comments.refresh', refreshCommentsCommand);
    const showStatsCmd = vscode.commands.registerCommand('pr-comments.showStats', showStatsCommand);

    // Listen to active editor changes to update decorations
    vscode.window.onDidChangeActiveTextEditor(editor => {
        if (editor) {
            updateDecorations(editor, getCommentsByFile());
        }
    }, null, context.subscriptions);

    // Listen to text document changes
    vscode.workspace.onDidChangeTextDocument(event => {
        const editor = vscode.window.activeTextEditor;
        if (editor && event.document === editor.document) {
            updateDecorations(editor, getCommentsByFile());
        }
    }, null, context.subscriptions);

    // Listen to configuration changes
    vscode.workspace.onDidChangeConfiguration(event => {
        if (event.affectsConfiguration('prComments')) {
            // Recreate decoration type with new settings
            disposeDecorationType();
            createDecorationType();
            
            // Update decorations in active editor
            const editor = vscode.window.activeTextEditor;
            if (editor) {
                updateDecorations(editor, getCommentsByFile());
            }

            // Update auto-refresh if interval changed
            if (event.affectsConfiguration('prComments.refreshInterval')) {
                updateAutoRefreshInterval();
                if (statusBarItem) {
                    updateStatusBarItem(statusBarItem);
                }
            }
        }
    }, null, context.subscriptions);

    // Toggle auto-refresh command
    const toggleAutoRefreshCmd = vscode.commands.registerCommand('pr-comments.toggleAutoRefresh', async () => {
        const config = vscode.workspace.getConfiguration('prComments');
        const currentInterval = config.get<number>('refreshInterval') || 0;
        
        if (currentInterval > 0) {
            // Disable auto-refresh
            await config.update('refreshInterval', 0, vscode.ConfigurationTarget.Global);
            stopAutoRefresh();
            vscode.window.showInformationMessage('PR Comments auto-refresh disabled');
        } else {
            // Enable with default 5 minutes
            const input = await vscode.window.showInputBox({
                prompt: 'Enter refresh interval in minutes',
                value: '5',
                validateInput: (value) => {
                    const num = parseInt(value, 10);
                    if (isNaN(num) || num < 1) {
                        return 'Please enter a positive number';
                    }
                    return null;
                },
            });
            
            if (input) {
                const interval = parseInt(input, 10);
                await config.update('refreshInterval', interval, vscode.ConfigurationTarget.Global);
                startAutoRefresh({
                    onRefresh: async () => {
                        if (getCurrentRepoInfo()) {
                            await fetchPRComments();
                            treeProvider.setComments(getCommentsByFile());
                        }
                    },
                });
                vscode.window.showInformationMessage(`PR Comments will refresh every ${interval} minutes`);
            }
        }
        
        if (statusBarItem) {
            updateStatusBarItem(statusBarItem);
        }
    });

    // Next/Previous comment navigation
    const nextCommentCmd = vscode.commands.registerCommand('pr-comments.nextComment', () => {
        navigateToComment('next');
    });

    const prevCommentCmd = vscode.commands.registerCommand('pr-comments.previousComment', () => {
        navigateToComment('previous');
    });

    context.subscriptions.push(
        fetchCommand,
        clearCommand,
        showLogCommand,
        replyCommand,
        addCommentCmd,
        filterByReviewerCmd,
        filterByStatusCmd,
        clearFiltersCmd,
        goToCommentCmd,
        refreshCmd,
        showStatsCmd,
        toggleAutoRefreshCmd,
        nextCommentCmd,
        prevCommentCmd
    );

    // Create status bar item for auto-refresh
    statusBarItem = createAutoRefreshStatusBarItem();
    context.subscriptions.push(statusBarItem);

    // Auto-fetch if enabled
    const config = getConfig();
    if (config.autoFetch) {
        fetchPRComments().then(() => {
            treeProvider.setComments(getCommentsByFile());
            vscode.commands.executeCommand('setContext', 'prComments.hasComments', true);
        });
    }

    // Start auto-refresh if configured
    if (config.refreshInterval > 0) {
        startAutoRefresh({
            onRefresh: async () => {
                if (getCurrentRepoInfo()) {
                    await fetchPRComments();
                    treeProvider.setComments(getCommentsByFile());
                }
            },
        });
    }
}

/**
 * Navigate to next or previous comment in the current file
 */
function navigateToComment(direction: 'next' | 'previous'): void {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
        vscode.window.showWarningMessage('No active editor');
        return;
    }

    const relativePath = vscode.workspace.asRelativePath(editor.document.uri, false);
    const comments = getCommentsByFile().get(relativePath);

    if (!comments || comments.length === 0) {
        vscode.window.showInformationMessage('No comments in this file');
        return;
    }

    const currentLine = editor.selection.active.line + 1; // Convert to 1-based
    const sortedLines = [...new Set(comments.map(c => c.line))].sort((a, b) => a - b);

    let targetLine: number | undefined;

    if (direction === 'next') {
        targetLine = sortedLines.find(line => line > currentLine);
        if (!targetLine) {
            // Wrap to first comment
            targetLine = sortedLines[0];
        }
    } else {
        // Find previous
        for (let i = sortedLines.length - 1; i >= 0; i--) {
            if (sortedLines[i] < currentLine) {
                targetLine = sortedLines[i];
                break;
            }
        }
        if (!targetLine) {
            // Wrap to last comment
            targetLine = sortedLines[sortedLines.length - 1];
        }
    }

    if (targetLine) {
        const lineIndex = targetLine - 1; // Convert to 0-based
        const range = new vscode.Range(lineIndex, 0, lineIndex, 0);
        editor.selection = new vscode.Selection(range.start, range.start);
        editor.revealRange(range, vscode.TextEditorRevealType.InCenter);
        logInfo(`Navigated to comment at line ${targetLine}`);
    }
}


export function deactivate() {
    clearCommentsStorage();
    disposeDecorationType();
    disposeLogger();
    disposeCommentTreeProvider();
    disposeAutoRefresh();
}
