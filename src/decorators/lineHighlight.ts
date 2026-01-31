import * as vscode from 'vscode';
import { PRComment } from '../models/comment';
import { getConfig } from '../utils/config';

let decorationType: vscode.TextEditorDecorationType | undefined;

export function createDecorationType(): vscode.TextEditorDecorationType {
    const config = getConfig();
    
    decorationType = vscode.window.createTextEditorDecorationType({
        backgroundColor: config.highlightColor,
        isWholeLine: true,
        overviewRulerColor: 'orange',
        overviewRulerLane: vscode.OverviewRulerLane.Right,
        after: {
            contentText: ` ${config.commentIcon}`,
            color: 'orange',
        },
    });

    return decorationType;
}

export function getDecorationType(): vscode.TextEditorDecorationType {
    if (!decorationType) {
        return createDecorationType();
    }
    return decorationType;
}

export function disposeDecorationType(): void {
    if (decorationType) {
        decorationType.dispose();
        decorationType = undefined;
    }
}

export function updateDecorations(
    editor: vscode.TextEditor,
    commentsByFile: Map<string, PRComment[]>
): void {
    const workspaceFolder = vscode.workspace.getWorkspaceFolder(editor.document.uri);
    if (!workspaceFolder) {
        return;
    }

    const relativePath = vscode.workspace.asRelativePath(editor.document.uri, false);
    const comments = commentsByFile.get(relativePath);
    const config = getConfig();

    if (!comments || comments.length === 0) {
        editor.setDecorations(getDecorationType(), []);
        return;
    }

    // Filter resolved comments if configured
    const filteredComments = config.showResolved 
        ? comments 
        : comments.filter(c => !c.resolved);

    const decorations: vscode.DecorationOptions[] = [];

    for (const comment of filteredComments) {
        // Line numbers in VS Code are 0-based, GitHub is 1-based
        const line = comment.line - 1;

        if (line < 0 || line >= editor.document.lineCount) {
            continue;
        }

        const range = editor.document.lineAt(line).range;
        const hoverMessage = createHoverMessage(comment);

        decorations.push({
            range,
            hoverMessage,
        });
    }

    editor.setDecorations(getDecorationType(), decorations);
}

function createHoverMessage(comment: PRComment): vscode.MarkdownString {
    const hoverMessage = new vscode.MarkdownString();
    hoverMessage.isTrusted = true;
    
    // Header with user and timestamp
    let header = `**@${comment.user}**`;
    if (comment.createdAt) {
        const date = new Date(comment.createdAt);
        header += ` • ${date.toLocaleDateString()} ${date.toLocaleTimeString()}`;
    }
    
    hoverMessage.appendMarkdown(header + '\n\n');
    hoverMessage.appendMarkdown('---\n\n');
    hoverMessage.appendMarkdown(comment.body);
    
    return hoverMessage;
}

export function clearDecorations(editor: vscode.TextEditor): void {
    editor.setDecorations(getDecorationType(), []);
}
