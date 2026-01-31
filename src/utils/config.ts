import * as vscode from 'vscode';

export interface ExtensionConfig {
    githubToken: string;
    autoFetch: boolean;
    highlightColor: string;
    commentIcon: string;
    showResolved: boolean;
    refreshInterval: number;
    githubEnterpriseUrl: string;
}

const DEFAULT_CONFIG: ExtensionConfig = {
    githubToken: '',
    autoFetch: false,
    highlightColor: 'rgba(255, 200, 0, 0.2)',
    commentIcon: '💬',
    showResolved: true,
    refreshInterval: 0,
    githubEnterpriseUrl: '',
};

export function getConfig(): ExtensionConfig {
    const config = vscode.workspace.getConfiguration('prComments');
    
    return {
        githubToken: config.get<string>('githubToken') || DEFAULT_CONFIG.githubToken,
        autoFetch: config.get<boolean>('autoFetch') ?? DEFAULT_CONFIG.autoFetch,
        highlightColor: config.get<string>('highlightColor') || DEFAULT_CONFIG.highlightColor,
        commentIcon: config.get<string>('commentIcon') || DEFAULT_CONFIG.commentIcon,
        showResolved: config.get<boolean>('showResolved') ?? DEFAULT_CONFIG.showResolved,
        refreshInterval: config.get<number>('refreshInterval') ?? DEFAULT_CONFIG.refreshInterval,
        githubEnterpriseUrl: config.get<string>('githubEnterpriseUrl') || DEFAULT_CONFIG.githubEnterpriseUrl,
    };
}

export function getGitHubApiBaseUrl(): string {
    const config = getConfig();
    if (config.githubEnterpriseUrl) {
        // GitHub Enterprise API is at /api/v3
        const baseUrl = config.githubEnterpriseUrl.replace(/\/$/, '');
        return `${baseUrl}/api/v3`;
    }
    return 'https://api.github.com';
}

export function hasValidToken(): boolean {
    const config = getConfig();
    return !!config.githubToken && config.githubToken.length > 0;
}

export function validateToken(token: string): { valid: boolean; message?: string } {
    if (!token || token.trim().length === 0) {
        return { valid: false, message: 'GitHub token is empty' };
    }
    
    // GitHub tokens have specific formats:
    // - Classic tokens: ghp_xxxx (40 chars after prefix)
    // - Fine-grained tokens: github_pat_xxxx
    // - OAuth tokens: gho_xxxx
    // - User-to-server tokens: ghu_xxxx
    // - Server-to-server tokens: ghs_xxxx
    // - Refresh tokens: ghr_xxxx
    const validPrefixes = ['ghp_', 'github_pat_', 'gho_', 'ghu_', 'ghs_', 'ghr_'];
    const hasValidPrefix = validPrefixes.some(prefix => token.startsWith(prefix));
    
    if (!hasValidPrefix) {
        // Could be an older token format or enterprise token
        if (token.length < 20) {
            return { valid: false, message: 'Token appears too short to be valid' };
        }
    }
    
    return { valid: true };
}
