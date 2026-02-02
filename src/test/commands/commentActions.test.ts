/**
 * Tests for commentActions module
 * 
 * Note: These tests focus on the pure functions (setCurrentRepoInfo/getCurrentRepoInfo)
 * which don't require complex VS Code mocking. The command functions are better tested
 * through integration tests in the VS Code Extension Development Host.
 */

// Simple mock for the module's dependencies
jest.mock('vscode', () => ({
    window: {
        showInformationMessage: jest.fn(),
        showWarningMessage: jest.fn(),
        showErrorMessage: jest.fn(),
        showInputBox: jest.fn(),
        showQuickPick: jest.fn(),
        activeTextEditor: undefined,
        withProgress: jest.fn(),
    },
    workspace: {
        workspaceFolders: [],
        asRelativePath: jest.fn(),
        openTextDocument: jest.fn(),
    },
    commands: {
        executeCommand: jest.fn(),
    },
    Uri: {
        joinPath: jest.fn(),
    },
    ProgressLocation: {
        Notification: 15,
    },
    Range: jest.fn(),
    Selection: jest.fn(),
}));

jest.mock('../../github/client', () => ({
    replyToComment: jest.fn(),
    createReviewComment: jest.fn(),
    getPRHeadCommit: jest.fn(),
}));

jest.mock('../../views/commentTreeProvider', () => ({
    getCommentTreeProvider: jest.fn(() => ({
        getReviewers: jest.fn(() => ['alice', 'bob']),
        setFilter: jest.fn(),
        clearFilter: jest.fn(),
        getTotalCommentCount: jest.fn(() => 10),
        getThreadCount: jest.fn(() => 5),
    })),
    ThreadItem: class {},
    CommentItem: class {},
}));

jest.mock('../../utils/logger', () => ({
    showAndLog: jest.fn(),
    logInfo: jest.fn(),
    logError: jest.fn(),
}));

import { setCurrentRepoInfo, getCurrentRepoInfo } from '../../commands/commentActions';

describe('setCurrentRepoInfo and getCurrentRepoInfo', () => {
    beforeEach(() => {
        setCurrentRepoInfo(null);
    });

    it('should store and retrieve repo info', () => {
        const repoInfo = { owner: 'octocat', repo: 'hello-world', prNumber: 42 };
        
        setCurrentRepoInfo(repoInfo);
        const result = getCurrentRepoInfo();
        
        expect(result).toEqual(repoInfo);
    });

    it('should return null when not set', () => {
        const result = getCurrentRepoInfo();
        
        expect(result).toBeNull();
    });

    it('should clear repo info when set to null', () => {
        setCurrentRepoInfo({ owner: 'test', repo: 'test', prNumber: 1 });
        setCurrentRepoInfo(null);
        
        const result = getCurrentRepoInfo();
        
        expect(result).toBeNull();
    });

    it('should update repo info', () => {
        setCurrentRepoInfo({ owner: 'old', repo: 'old', prNumber: 1 });
        setCurrentRepoInfo({ owner: 'new', repo: 'new', prNumber: 2 });
        
        const result = getCurrentRepoInfo();
        
        expect(result?.owner).toBe('new');
        expect(result?.repo).toBe('new');
        expect(result?.prNumber).toBe(2);
    });

    it('should handle multiple updates', () => {
        for (let i = 1; i <= 5; i++) {
            setCurrentRepoInfo({ owner: `owner${i}`, repo: `repo${i}`, prNumber: i });
        }
        
        const result = getCurrentRepoInfo();
        
        expect(result?.owner).toBe('owner5');
        expect(result?.prNumber).toBe(5);
    });
});

describe('replyToCommentCommand', () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { showAndLog } = require('../../utils/logger');

    beforeEach(() => {
        jest.clearAllMocks();
        setCurrentRepoInfo(null);
    });

    it('should fail when no PR is loaded', async () => {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const { replyToCommentCommand } = require('../../commands/commentActions');
        
        const result = await replyToCommentCommand();
        
        expect(result).toBe(false);
        expect(showAndLog).toHaveBeenCalledWith(
            'No PR loaded. Please fetch PR comments first.',
            'error'
        );
    });
});

describe('addCommentCommand', () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { showAndLog } = require('../../utils/logger');

    beforeEach(() => {
        jest.clearAllMocks();
        setCurrentRepoInfo(null);
    });

    it('should fail when no PR is loaded', async () => {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const { addCommentCommand } = require('../../commands/commentActions');
        
        const result = await addCommentCommand();
        
        expect(result).toBe(false);
        expect(showAndLog).toHaveBeenCalledWith(
            'No PR loaded. Please fetch PR comments first.',
            'error'
        );
    });

    it('should fail when no active editor', async () => {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const { addCommentCommand } = require('../../commands/commentActions');
        setCurrentRepoInfo({ owner: 'test', repo: 'test', prNumber: 1 });
        
        const result = await addCommentCommand();
        
        expect(result).toBe(false);
        expect(showAndLog).toHaveBeenCalledWith('No active editor', 'error');
    });
});
