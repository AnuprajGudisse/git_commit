import * as vscode from 'vscode';
import { execSync } from 'child_process';
import { RepositoryInfo } from '../models/comment';
import { logInfo, logError, logWarn } from '../utils/logger';

export function parseGitRemoteUrl(remoteUrl: string): { owner: string; repo: string } | null {
    // Handle both SSH and HTTPS URLs
    // SSH: git@github.com:owner/repo.git
    // HTTPS: https://github.com/owner/repo.git
    // GitHub Enterprise: https://github.enterprise.com/owner/repo.git
    const patterns = [
        /github[^/]*[:/]([^/]+)\/([^/]+?)(\.git)?$/i,
        /^([^/]+)\/([^/]+)$/, // Simple owner/repo format
    ];

    for (const pattern of patterns) {
        const match = remoteUrl.match(pattern);
        if (match) {
            return {
                owner: match[1],
                repo: match[2].replace(/\.git$/, ''),
            };
        }
    }

    return null;
}

export function extractPRNumberFromBranch(branchName: string): number | null {
    // Match patterns at start or after delimiter to avoid false positives
    // Patterns: pr-123, PR-123, pull-123, pull_123, 123-feature-name
    const patterns = [
        /^pr[_-]?(\d+)/i,           // pr-123, pr_123, pr123
        /^pull[_-]?(\d+)/i,         // pull-123, pull_123, pull123
        /^(\d+)[_-]/,               // 123-feature-name
        /[_-]pr[_-]?(\d+)/i,        // feature-pr-123
        /[_-]pull[_-]?(\d+)/i,      // feature-pull-123
    ];

    for (const pattern of patterns) {
        const match = branchName.match(pattern);
        if (match) {
            return parseInt(match[1], 10);
        }
    }

    return null;
}

export function getGitRemoteUrl(cwd: string): string | null {
    try {
        const remoteUrl = execSync('git config --get remote.origin.url', { 
            cwd, 
            encoding: 'utf8',
            timeout: 5000,
        }).trim();
        logInfo(`Git remote URL: ${remoteUrl}`);
        return remoteUrl;
    } catch (error) {
        logError(`Failed to get git remote URL: ${error}`);
        return null;
    }
}

export function getCurrentBranch(cwd: string): string | null {
    try {
        const branch = execSync('git rev-parse --abbrev-ref HEAD', { 
            cwd, 
            encoding: 'utf8',
            timeout: 5000,
        }).trim();
        logInfo(`Current branch: ${branch}`);
        return branch;
    } catch (error) {
        logError(`Failed to get current branch: ${error}`);
        return null;
    }
}

export function isGitRepository(cwd: string): boolean {
    try {
        execSync('git rev-parse --is-inside-work-tree', { 
            cwd, 
            encoding: 'utf8',
            timeout: 5000,
        });
        return true;
    } catch {
        return false;
    }
}

export async function getRepositoryInfo(workspaceFolder?: vscode.WorkspaceFolder): Promise<RepositoryInfo | null> {
    const folder = workspaceFolder || vscode.workspace.workspaceFolders?.[0];
    if (!folder) {
        logWarn('No workspace folder found');
        return null;
    }

    const cwd = folder.uri.fsPath;

    if (!isGitRepository(cwd)) {
        logWarn(`Not a git repository: ${cwd}`);
        return null;
    }

    const remoteUrl = getGitRemoteUrl(cwd);
    if (!remoteUrl) {
        return null;
    }

    const parsed = parseGitRemoteUrl(remoteUrl);
    if (!parsed) {
        logError(`Could not parse remote URL: ${remoteUrl}`);
        return null;
    }

    const branch = getCurrentBranch(cwd);
    let prNumber: number | null = null;

    if (branch) {
        prNumber = extractPRNumberFromBranch(branch);
        if (prNumber) {
            logInfo(`Extracted PR number from branch: ${prNumber}`);
        }
    }

    // If no PR number found, prompt user
    if (!prNumber) {
        const input = await vscode.window.showInputBox({
            prompt: 'Enter PR number',
            placeHolder: '123',
            validateInput: (value) => {
                if (!value) {
                    return 'PR number is required';
                }
                const num = parseInt(value, 10);
                if (isNaN(num) || num <= 0) {
                    return 'Please enter a valid positive number';
                }
                return null;
            },
        });

        if (input) {
            prNumber = parseInt(input, 10);
        }
    }

    return {
        owner: parsed.owner,
        repo: parsed.repo,
        prNumber,
    };
}

export function getAllWorkspaceFolders(): readonly vscode.WorkspaceFolder[] {
    return vscode.workspace.workspaceFolders || [];
}

export async function selectWorkspaceFolder(): Promise<vscode.WorkspaceFolder | undefined> {
    const folders = getAllWorkspaceFolders();
    
    if (folders.length === 0) {
        return undefined;
    }
    
    if (folders.length === 1) {
        return folders[0];
    }

    // Multiple folders - let user select
    const items = folders.map(folder => ({
        label: folder.name,
        description: folder.uri.fsPath,
        folder,
    }));

    const selected = await vscode.window.showQuickPick(items, {
        placeHolder: 'Select workspace folder',
    });

    return selected?.folder;
}
