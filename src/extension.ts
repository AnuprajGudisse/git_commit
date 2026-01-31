import * as vscode from 'vscode';
import { Octokit } from '@octokit/rest';
import { execSync } from 'child_process';

interface PRComment {
    path: string;
    line: number;
    body: string;
    user: string;
    id: number;
}

let decorationType: vscode.TextEditorDecorationType;
const commentsByFile = new Map<string, PRComment[]>();

export function activate(context: vscode.ExtensionContext) {
    console.log('PR Comments Viewer extension is now active');

    // Create decoration type for highlighting commented lines
    decorationType = vscode.window.createTextEditorDecorationType({
        backgroundColor: 'rgba(255, 200, 0, 0.2)',
        isWholeLine: true,
        overviewRulerColor: 'orange',
        overviewRulerLane: vscode.OverviewRulerLane.Right,
        after: {
            contentText: ' 💬',
            color: 'orange'
        }
    });

    // Register fetch command
    const fetchCommand = vscode.commands.registerCommand('pr-comments.fetch', async () => {
        await fetchPRComments();
    });

    // Register clear command
    const clearCommand = vscode.commands.registerCommand('pr-comments.clear', () => {
        clearComments();
    });

    // Listen to active editor changes to update decorations
    vscode.window.onDidChangeActiveTextEditor(editor => {
        if (editor) {
            updateDecorations(editor);
        }
    }, null, context.subscriptions);

    // Listen to text document changes
    vscode.workspace.onDidChangeTextDocument(event => {
        const editor = vscode.window.activeTextEditor;
        if (editor && event.document === editor.document) {
            updateDecorations(editor);
        }
    }, null, context.subscriptions);

    context.subscriptions.push(fetchCommand, clearCommand);

    // Auto-fetch if enabled
    const config = vscode.workspace.getConfiguration('prComments');
    if (config.get('autoFetch')) {
        fetchPRComments();
    }
}

async function fetchPRComments() {
    const config = vscode.workspace.getConfiguration('prComments');
    const token = config.get<string>('githubToken');

    if (!token) {
        vscode.window.showErrorMessage('Please configure your GitHub token in settings (prComments.githubToken)');
        return;
    }

    // Get repository info from git
    const repoInfo = await getRepositoryInfo();
    if (!repoInfo) {
        vscode.window.showErrorMessage('Could not determine repository information. Make sure you are in a Git repository.');
        return;
    }

    const { owner, repo, prNumber } = repoInfo;

    if (!prNumber) {
        vscode.window.showErrorMessage('Could not determine PR number. Make sure you are on a PR branch.');
        return;
    }

    try {
        vscode.window.showInformationMessage(`Fetching PR #${prNumber} comments...`);

        const octokit = new Octokit({ auth: token });

        // Fetch PR review comments
        const { data: comments } = await octokit.pulls.listReviewComments({
            owner,
            repo,
            pull_number: prNumber
        });

        // Clear existing comments
        commentsByFile.clear();

        // Process and store comments
        for (const comment of comments) {
            if (comment.path && comment.line) {
                const prComment: PRComment = {
                    path: comment.path,
                    line: comment.line,
                    body: comment.body || '',
                    user: comment.user?.login || 'Unknown',
                    id: comment.id
                };

                if (!commentsByFile.has(comment.path)) {
                    commentsByFile.set(comment.path, []);
                }
                commentsByFile.get(comment.path)!.push(prComment);
            }
        }

        vscode.window.showInformationMessage(`Loaded ${comments.length} PR comments`);

        // Update decorations for current editor
        const editor = vscode.window.activeTextEditor;
        if (editor) {
            updateDecorations(editor);
        }
    } catch (error) {
        vscode.window.showErrorMessage(`Error fetching PR comments: ${error}`);
        console.error('Error fetching PR comments:', error);
    }
}

function clearComments() {
    commentsByFile.clear();
    const editor = vscode.window.activeTextEditor;
    if (editor) {
        editor.setDecorations(decorationType, []);
    }
    vscode.window.showInformationMessage('PR comments cleared');
}

function updateDecorations(editor: vscode.TextEditor) {
    const workspaceFolder = vscode.workspace.getWorkspaceFolder(editor.document.uri);
    if (!workspaceFolder) {
        return;
    }

    const relativePath = vscode.workspace.asRelativePath(editor.document.uri, false);
    const comments = commentsByFile.get(relativePath);

    if (!comments || comments.length === 0) {
        editor.setDecorations(decorationType, []);
        return;
    }

    const decorations: vscode.DecorationOptions[] = [];

    for (const comment of comments) {
        // Line numbers in VS Code are 0-based, GitHub is 1-based
        const line = comment.line - 1;

        if (line < 0 || line >= editor.document.lineCount) {
            continue;
        }

        const range = editor.document.lineAt(line).range;
        const hoverMessage = new vscode.MarkdownString();
        hoverMessage.appendMarkdown(`**@${comment.user}:**\n\n${comment.body}`);

        decorations.push({
            range,
            hoverMessage
        });
    }

    editor.setDecorations(decorationType, decorations);
}

async function getRepositoryInfo(): Promise<{ owner: string; repo: string; prNumber: number | null } | null> {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
        return null;
    }

    try {
        // Get git remote URL
        const cwd = workspaceFolder.uri.fsPath;

        const remoteUrl = execSync('git config --get remote.origin.url', { cwd, encoding: 'utf8' }).trim();

        // Parse owner and repo from URL
        // Handle both SSH and HTTPS URLs
        const match = remoteUrl.match(/github\.com[:/](.+?)\/(.+?)(\.git)?$/);
        if (!match) {
            return null;
        }

        const owner = match[1];
        const repo = match[2];

        // Get current branch
        const branch = execSync('git rev-parse --abbrev-ref HEAD', { cwd, encoding: 'utf8' }).trim();

        // Try to extract PR number from branch name (common patterns: pr-123, PR-123, 123-feature, etc.)
        const prMatch = branch.match(/(?:pr[_-]?|pull[_-]?)?(\d+)/i);
        const prNumber = prMatch ? parseInt(prMatch[1], 10) : null;

        // If no PR number in branch, try to get it from git config or ask user
        if (!prNumber) {
            const input = await vscode.window.showInputBox({
                prompt: 'Enter PR number',
                placeHolder: '123'
            });

            if (!input) {
                return null;
            }

            const inputPrNumber = parseInt(input, 10);
            if (isNaN(inputPrNumber)) {
                return null;
            }

            return { owner, repo, prNumber: inputPrNumber };
        }

        return { owner, repo, prNumber };
    } catch (error) {
        console.error('Error getting repository info:', error);
        return null;
    }
}

export function deactivate() {
    commentsByFile.clear();
}
