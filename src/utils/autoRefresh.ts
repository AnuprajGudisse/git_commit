import * as vscode from 'vscode';
import { getConfig } from './config';
import { logInfo, logWarn } from './logger';

let refreshTimer: NodeJS.Timeout | undefined;
let isRefreshing = false;

export interface AutoRefreshCallbacks {
    onRefresh: () => Promise<void>;
    onRefreshComplete?: () => void;
    onRefreshError?: (error: Error) => void;
}

let callbacks: AutoRefreshCallbacks | undefined;

/**
 * Start the auto-refresh timer based on configuration
 */
export function startAutoRefresh(refreshCallbacks: AutoRefreshCallbacks): void {
    callbacks = refreshCallbacks;
    const config = getConfig();
    const intervalMinutes = config.refreshInterval;

    if (intervalMinutes <= 0) {
        logInfo('Auto-refresh disabled (interval is 0)');
        return;
    }

    // Stop any existing timer
    stopAutoRefresh();

    const intervalMs = intervalMinutes * 60 * 1000;
    logInfo(`Starting auto-refresh with ${intervalMinutes} minute interval`);

    refreshTimer = setInterval(async () => {
        await performRefresh();
    }, intervalMs);
}

/**
 * Stop the auto-refresh timer
 */
export function stopAutoRefresh(): void {
    if (refreshTimer) {
        clearInterval(refreshTimer);
        refreshTimer = undefined;
        logInfo('Auto-refresh stopped');
    }
}

/**
 * Check if auto-refresh is currently active
 */
export function isAutoRefreshActive(): boolean {
    return refreshTimer !== undefined;
}

/**
 * Check if a refresh is currently in progress
 */
export function isRefreshInProgress(): boolean {
    return isRefreshing;
}

/**
 * Perform a refresh operation
 */
async function performRefresh(): Promise<void> {
    if (isRefreshing) {
        logWarn('Refresh already in progress, skipping');
        return;
    }

    if (!callbacks) {
        logWarn('No refresh callbacks registered');
        return;
    }

    isRefreshing = true;
    logInfo('Auto-refresh: fetching comments...');

    try {
        await callbacks.onRefresh();
        callbacks.onRefreshComplete?.();
        logInfo('Auto-refresh completed');
    } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        callbacks.onRefreshError?.(err);
        logWarn(`Auto-refresh failed: ${err.message}`);
    } finally {
        isRefreshing = false;
    }
}

/**
 * Update the auto-refresh interval (called when config changes)
 */
export function updateAutoRefreshInterval(): void {
    if (callbacks) {
        // Restart with new interval
        startAutoRefresh(callbacks);
    }
}

/**
 * Get the current refresh interval in minutes
 */
export function getRefreshIntervalMinutes(): number {
    return getConfig().refreshInterval;
}

/**
 * Create a status bar item showing auto-refresh status
 */
export function createAutoRefreshStatusBarItem(): vscode.StatusBarItem {
    const statusBarItem = vscode.window.createStatusBarItem(
        vscode.StatusBarAlignment.Right,
        100
    );
    
    updateStatusBarItem(statusBarItem);
    statusBarItem.command = 'pr-comments.toggleAutoRefresh';
    statusBarItem.show();
    
    return statusBarItem;
}

/**
 * Update the status bar item text
 */
export function updateStatusBarItem(statusBarItem: vscode.StatusBarItem): void {
    const config = getConfig();
    const interval = config.refreshInterval;
    
    if (interval > 0 && isAutoRefreshActive()) {
        statusBarItem.text = `$(sync) PR: ${interval}m`;
        statusBarItem.tooltip = `PR Comments auto-refresh every ${interval} minutes. Click to disable.`;
    } else {
        statusBarItem.text = '$(sync-ignored) PR: Off';
        statusBarItem.tooltip = 'PR Comments auto-refresh disabled. Click to configure.';
    }
}

/**
 * Dispose of auto-refresh resources
 */
export function disposeAutoRefresh(): void {
    stopAutoRefresh();
    callbacks = undefined;
}
