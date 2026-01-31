// Mock VS Code API for unit testing

export const window = {
    showInformationMessage: jest.fn(),
    showWarningMessage: jest.fn(),
    showErrorMessage: jest.fn(),
    showInputBox: jest.fn(),
    showQuickPick: jest.fn(),
    createOutputChannel: jest.fn(() => ({
        appendLine: jest.fn(),
        show: jest.fn(),
        dispose: jest.fn(),
    })),
    createTextEditorDecorationType: jest.fn(() => ({
        dispose: jest.fn(),
    })),
    activeTextEditor: undefined,
    onDidChangeActiveTextEditor: jest.fn(),
    withProgress: jest.fn((options, task) => task({ report: jest.fn() })),
};

export const workspace = {
    getConfiguration: jest.fn(() => ({
        get: jest.fn((key: string) => {
            const defaults: Record<string, unknown> = {
                githubToken: '',
                autoFetch: false,
                highlightColor: 'rgba(255, 200, 0, 0.2)',
                commentIcon: '💬',
                showResolved: true,
                refreshInterval: 0,
                githubEnterpriseUrl: '',
            };
            return defaults[key];
        }),
    })),
    workspaceFolders: undefined,
    getWorkspaceFolder: jest.fn(),
    asRelativePath: jest.fn((uri: unknown) => {
        if (typeof uri === 'string') return uri;
        return (uri as { fsPath?: string })?.fsPath || '';
    }),
    onDidChangeTextDocument: jest.fn(),
    onDidChangeConfiguration: jest.fn(),
};

export const commands = {
    registerCommand: jest.fn(),
    executeCommand: jest.fn(),
};

export const Uri = {
    file: jest.fn((path: string) => ({ fsPath: path, scheme: 'file' })),
    parse: jest.fn((uri: string) => ({ fsPath: uri, scheme: 'file' })),
};

export enum OverviewRulerLane {
    Left = 1,
    Center = 2,
    Right = 4,
    Full = 7,
}

export enum ProgressLocation {
    SourceControl = 1,
    Window = 10,
    Notification = 15,
}

export class MarkdownString {
    value: string = '';
    isTrusted: boolean = false;
    
    appendMarkdown(value: string): this {
        this.value += value;
        return this;
    }
    
    appendText(value: string): this {
        this.value += value;
        return this;
    }
}

export interface TextEditor {
    document: {
        uri: { fsPath: string };
        lineCount: number;
        lineAt: (line: number) => { range: { start: { line: number }; end: { line: number } } };
    };
    setDecorations: jest.Mock;
}

export interface WorkspaceFolder {
    uri: { fsPath: string };
    name: string;
    index: number;
}

export interface DecorationOptions {
    range: unknown;
    hoverMessage?: unknown;
}

export type TextEditorDecorationType = {
    dispose: () => void;
};
