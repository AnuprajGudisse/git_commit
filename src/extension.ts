import * as vscode from 'vscode';
import { fetchPRComments, getCommentsByFile, clearCommentsStorage } from './commands/fetchComments';
import { createDecorationType, updateDecorations, disposeDecorationType, clearDecorations } from './decorators/lineHighlight';
import { getLogger, logInfo, disposeLogger } from './utils/logger';
import { getConfig } from './utils/config';

export function activate(context: vscode.ExtensionContext) {
    logInfo('PR Comments Viewer extension is now active');

    // Create decoration type for highlighting commented lines
    createDecorationType();

    // Register fetch command
    const fetchCommand = vscode.commands.registerCommand('pr-comments.fetch', async () => {
        await fetchPRComments();
    });

    // Register clear command
    const clearCommand = vscode.commands.registerCommand('pr-comments.clear', () => {
        clearCommentsStorage();
        const editor = vscode.window.activeTextEditor;
        if (editor) {
            clearDecorations(editor);
        }
        vscode.window.showInformationMessage('PR comments cleared');
    });

    // Register show log command
    const showLogCommand = vscode.commands.registerCommand('pr-comments.showLog', () => {
        getLogger().show();
    });

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
        }
    }, null, context.subscriptions);

    context.subscriptions.push(fetchCommand, clearCommand, showLogCommand);

    // Auto-fetch if enabled
    const config = getConfig();
    if (config.autoFetch) {
        fetchPRComments();
    }
}


export function deactivate() {
    clearCommentsStorage();
    disposeDecorationType();
    disposeLogger();
}
