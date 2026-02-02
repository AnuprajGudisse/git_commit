import * as vscode from 'vscode';
import { PRComment } from '../models/comment';
import { getConfig, getValidatedHighlightColor } from '../utils/config';

let decorationType: vscode.TextEditorDecorationType | undefined;

export function createDecorationType(): vscode.TextEditorDecorationType {
    const config = getConfig();
    
    decorationType = vscode.window.createTextEditorDecorationType({
        backgroundColor: getValidatedHighlightColor(),
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

function escapeMarkdown(text: string): string {
    // Escape special markdown characters to prevent injection
    return text
        .replace(/\\/g, '\\\\')
        .replace(/\*/g, '\\*')
        .replace(/_/g, '\\_')
        .replace(/\[/g, '\\[')
        .replace(/\]/g, '\\]')
        .replace(/\(/g, '\\(')
        .replace(/\)/g, '\\)')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

function createHoverMessage(comment: PRComment): vscode.MarkdownString {
    const hoverMessage = new vscode.MarkdownString();
    // Set to false to prevent command execution from comment content
    hoverMessage.isTrusted = false;
    hoverMessage.supportHtml = false;
    
    // Header with user and timestamp - escape user to prevent injection
    const safeUser = escapeMarkdown(comment.user);
    let header = `**@${safeUser}**`;
    
    // Add author association badge if available
    if (comment.authorAssociation && comment.authorAssociation !== 'NONE') {
        const badge = getAuthorBadge(comment.authorAssociation);
        if (badge) {
            header += ` ${badge}`;
        }
    }
    
    if (comment.createdAt) {
        const date = new Date(comment.createdAt);
        header += ` • ${date.toLocaleDateString()} ${date.toLocaleTimeString()}`;
    }
    
    hoverMessage.appendMarkdown(header + '\n\n');
    
    // Show diff context if available
    if (comment.diffHunk) {
        hoverMessage.appendMarkdown('```diff\n');
        // Show last few lines of diff hunk for context
        const diffLines = comment.diffHunk.split('\n');
        const contextLines = diffLines.slice(-5); // Last 5 lines
        hoverMessage.appendMarkdown(contextLines.join('\n'));
        hoverMessage.appendMarkdown('\n```\n\n');
    }
    
    hoverMessage.appendMarkdown('---\n\n');
    // Comment body is from GitHub API - render as-is but untrusted
    // GitHub already sanitizes markdown, and isTrusted=false prevents command links
    hoverMessage.appendMarkdown(comment.body);
    
    // Show reply indicator
    if (comment.inReplyToId) {
        hoverMessage.appendMarkdown('\n\n*↳ Reply to thread*');
    }
    
    return hoverMessage;
}

function getAuthorBadge(association: string): string {
    switch (association) {
        case 'OWNER':
            return '👑';
        case 'MEMBER':
            return '🏢';
        case 'COLLABORATOR':
            return '🤝';
        case 'CONTRIBUTOR':
            return '✨';
        case 'FIRST_TIME_CONTRIBUTOR':
            return '🆕';
        case 'FIRST_TIMER':
            return '🎉';
        default:
            return '';
    }
}

export function clearDecorations(editor: vscode.TextEditor): void {
    editor.setDecorations(getDecorationType(), []);
}
