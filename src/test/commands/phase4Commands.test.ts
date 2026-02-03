/**
 * Tests for Phase 4 commands
 */

jest.mock('vscode');

// Mock the GitHub client
jest.mock('../../github/client', () => ({
    resolveThread: jest.fn(),
    unresolveThread: jest.fn(),
    fetchIssueComments: jest.fn(),
    createIssueComment: jest.fn(),
    listOpenPRs: jest.fn(),
    fetchCommentsWithThreads: jest.fn(),
}));

// Mock commentActions
jest.mock('../../commands/commentActions', () => ({
    getCurrentRepoInfo: jest.fn(),
}));

// Mock logger
jest.mock('../../utils/logger', () => ({
    logInfo: jest.fn(),
    logError: jest.fn(),
}));

import {
    setThreadMap,
    getThreadMap,
    getIssueComments,
    getLoadedPRs,
    clearPhase4State,
} from '../../commands/phase4Commands';

describe('Phase 4 Commands - State Management', () => {
    beforeEach(() => {
        clearPhase4State();
    });

    describe('setThreadMap / getThreadMap', () => {
        it('should set and get thread map', () => {
            const map = new Map<number, { threadId: string; resolved: boolean }>();
            map.set(1, { threadId: 'thread-1', resolved: false });
            map.set(2, { threadId: 'thread-2', resolved: true });

            setThreadMap(map);
            const result = getThreadMap();

            expect(result.size).toBe(2);
            expect(result.get(1)?.threadId).toBe('thread-1');
            expect(result.get(1)?.resolved).toBe(false);
            expect(result.get(2)?.resolved).toBe(true);
        });

        it('should return empty map initially', () => {
            const result = getThreadMap();
            expect(result.size).toBe(0);
        });
    });

    describe('getIssueComments', () => {
        it('should return empty array initially', () => {
            const result = getIssueComments();
            expect(result).toEqual([]);
        });
    });

    describe('getLoadedPRs', () => {
        it('should return empty map initially', () => {
            const result = getLoadedPRs();
            expect(result.size).toBe(0);
        });
    });

    describe('clearPhase4State', () => {
        it('should clear all state', () => {
            // Set some state
            const map = new Map<number, { threadId: string; resolved: boolean }>();
            map.set(1, { threadId: 'thread-1', resolved: false });
            setThreadMap(map);

            // Clear state
            clearPhase4State();

            // Verify cleared
            expect(getThreadMap().size).toBe(0);
            expect(getIssueComments()).toEqual([]);
            expect(getLoadedPRs().size).toBe(0);
        });
    });
});

describe('Phase 4 Commands - Thread Resolution', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        clearPhase4State();
    });

    describe('resolveThreadCommand', () => {
        it('should show error when no PR loaded', async () => {
            const { getCurrentRepoInfo } = require('../../commands/commentActions');
            getCurrentRepoInfo.mockReturnValue(null);

            const { resolveThreadCommand } = require('../../commands/phase4Commands');
            await resolveThreadCommand();

            const vscode = require('vscode');
            expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
                expect.stringContaining('No PR loaded')
            );
        });

        it('should show info when no unresolved threads', async () => {
            const { getCurrentRepoInfo } = require('../../commands/commentActions');
            getCurrentRepoInfo.mockReturnValue({ owner: 'test', repo: 'repo', prNumber: 42 });

            // Empty thread map
            setThreadMap(new Map());

            const { resolveThreadCommand } = require('../../commands/phase4Commands');
            await resolveThreadCommand();

            const vscode = require('vscode');
            expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
                expect.stringContaining('No unresolved threads')
            );
        });
    });

    describe('unresolveThreadCommand', () => {
        it('should show error when no PR loaded', async () => {
            const { getCurrentRepoInfo } = require('../../commands/commentActions');
            getCurrentRepoInfo.mockReturnValue(null);

            const { unresolveThreadCommand } = require('../../commands/phase4Commands');
            await unresolveThreadCommand();

            const vscode = require('vscode');
            expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
                expect.stringContaining('No PR loaded')
            );
        });

        it('should show info when no resolved threads', async () => {
            const { getCurrentRepoInfo } = require('../../commands/commentActions');
            getCurrentRepoInfo.mockReturnValue({ owner: 'test', repo: 'repo', prNumber: 42 });

            // Empty thread map
            setThreadMap(new Map());

            const { unresolveThreadCommand } = require('../../commands/phase4Commands');
            await unresolveThreadCommand();

            const vscode = require('vscode');
            expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
                expect.stringContaining('No resolved threads')
            );
        });
    });
});

describe('Phase 4 Commands - Conversation', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        clearPhase4State();
    });

    describe('showConversationCommand', () => {
        it('should show error when no PR loaded', async () => {
            const { getCurrentRepoInfo } = require('../../commands/commentActions');
            getCurrentRepoInfo.mockReturnValue(null);

            const { showConversationCommand } = require('../../commands/phase4Commands');
            await showConversationCommand();

            const vscode = require('vscode');
            expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
                expect.stringContaining('No PR loaded')
            );
        });
    });

    describe('addConversationCommentCommand', () => {
        it('should show error when no PR loaded', async () => {
            const { getCurrentRepoInfo } = require('../../commands/commentActions');
            getCurrentRepoInfo.mockReturnValue(null);

            const { addConversationCommentCommand } = require('../../commands/phase4Commands');
            await addConversationCommentCommand();

            const vscode = require('vscode');
            expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
                expect.stringContaining('No PR loaded')
            );
        });
    });
});

describe('Phase 4 Commands - Multi-PR Support', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        clearPhase4State();
    });

    describe('switchPRCommand', () => {
        it('should show error when no repository detected', async () => {
            const { getCurrentRepoInfo } = require('../../commands/commentActions');
            getCurrentRepoInfo.mockReturnValue(null);

            const { switchPRCommand } = require('../../commands/phase4Commands');
            await switchPRCommand();

            const vscode = require('vscode');
            expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
                expect.stringContaining('No repository detected')
            );
        });
    });
});

describe('Phase 4 Commands - Thread Statistics', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        clearPhase4State();
    });

    describe('showThreadStatsCommand', () => {
        it('should show error when no PR loaded', async () => {
            const { getCurrentRepoInfo } = require('../../commands/commentActions');
            getCurrentRepoInfo.mockReturnValue(null);

            const { showThreadStatsCommand } = require('../../commands/phase4Commands');
            await showThreadStatsCommand();

            const vscode = require('vscode');
            expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
                expect.stringContaining('No PR loaded')
            );
        });

        it('should show statistics when PR loaded', async () => {
            const { getCurrentRepoInfo } = require('../../commands/commentActions');
            getCurrentRepoInfo.mockReturnValue({ owner: 'test', repo: 'repo', prNumber: 42 });

            // Set up thread map with some resolved and unresolved threads
            const map = new Map<number, { threadId: string; resolved: boolean }>();
            map.set(1, { threadId: 'thread-1', resolved: false });
            map.set(2, { threadId: 'thread-2', resolved: true });
            map.set(3, { threadId: 'thread-3', resolved: true });
            setThreadMap(map);

            const { showThreadStatsCommand } = require('../../commands/phase4Commands');
            await showThreadStatsCommand();

            const vscode = require('vscode');
            expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
                expect.stringContaining('Total Threads: 3'),
                expect.any(Object)
            );
        });
    });
});

describe('Phase 4 Commands - Toggle Resolution', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        clearPhase4State();
    });

    describe('toggleThreadResolutionCommand', () => {
        it('should show error when no item selected', async () => {
            const { toggleThreadResolutionCommand } = require('../../commands/phase4Commands');
            await toggleThreadResolutionCommand();

            const vscode = require('vscode');
            expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
                expect.stringContaining('No thread selected')
            );
        });

        it('should show error when item has no commentId', async () => {
            const { toggleThreadResolutionCommand } = require('../../commands/phase4Commands');
            await toggleThreadResolutionCommand({});

            const vscode = require('vscode');
            expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
                expect.stringContaining('No thread selected')
            );
        });
    });
});
