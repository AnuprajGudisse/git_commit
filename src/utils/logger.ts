import * as vscode from 'vscode';

let outputChannel: vscode.OutputChannel | undefined;

export function getLogger(): vscode.OutputChannel {
    if (!outputChannel) {
        outputChannel = vscode.window.createOutputChannel('PR Comments Viewer');
    }
    return outputChannel;
}

export function log(message: string, level: 'info' | 'warn' | 'error' = 'info'): void {
    const timestamp = new Date().toISOString();
    const prefix = level.toUpperCase().padEnd(5);
    const formattedMessage = `[${timestamp}] [${prefix}] ${message}`;
    
    getLogger().appendLine(formattedMessage);
    
    if (level === 'error') {
        console.error(formattedMessage);
    } else if (level === 'warn') {
        console.warn(formattedMessage);
    } else {
        console.log(formattedMessage);
    }
}

export function logInfo(message: string): void {
    log(message, 'info');
}

export function logWarn(message: string): void {
    log(message, 'warn');
}

export function logError(message: string): void {
    log(message, 'error');
}

export function showAndLog(message: string, level: 'info' | 'warn' | 'error' = 'info'): void {
    log(message, level);
    
    switch (level) {
        case 'error':
            vscode.window.showErrorMessage(message);
            break;
        case 'warn':
            vscode.window.showWarningMessage(message);
            break;
        default:
            vscode.window.showInformationMessage(message);
    }
}

export function disposeLogger(): void {
    if (outputChannel) {
        outputChannel.dispose();
        outputChannel = undefined;
    }
}
