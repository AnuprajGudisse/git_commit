/**
 * Tests for auto-refresh functionality
 */

// Mock vscode
jest.mock('vscode', () => ({
    window: {
        createStatusBarItem: jest.fn(() => ({
            text: '',
            tooltip: '',
            command: '',
            show: jest.fn(),
            dispose: jest.fn(),
        })),
    },
    StatusBarAlignment: {
        Right: 2,
    },
}));

// Mock config
jest.mock('../../utils/config', () => ({
    getConfig: jest.fn(() => ({
        refreshInterval: 5,
    })),
}));

// Mock logger
jest.mock('../../utils/logger', () => ({
    logInfo: jest.fn(),
    logWarn: jest.fn(),
}));

import {
    startAutoRefresh,
    stopAutoRefresh,
    isAutoRefreshActive,
    isRefreshInProgress,
    disposeAutoRefresh,
    getRefreshIntervalMinutes,
    createAutoRefreshStatusBarItem,
    updateStatusBarItem,
} from '../../utils/autoRefresh';

describe('Auto-refresh functionality', () => {
    beforeEach(() => {
        jest.useFakeTimers();
        disposeAutoRefresh();
    });

    afterEach(() => {
        jest.useRealTimers();
        disposeAutoRefresh();
    });

    describe('startAutoRefresh', () => {
        it('should start the refresh timer', () => {
            const onRefresh = jest.fn().mockResolvedValue(undefined);
            
            startAutoRefresh({ onRefresh });
            
            expect(isAutoRefreshActive()).toBe(true);
        });

        it('should call onRefresh at the configured interval', async () => {
            const onRefresh = jest.fn().mockResolvedValue(undefined);
            
            startAutoRefresh({ onRefresh });
            
            // Fast-forward 5 minutes
            jest.advanceTimersByTime(5 * 60 * 1000);
            
            // Allow promises to resolve
            await Promise.resolve();
            
            expect(onRefresh).toHaveBeenCalledTimes(1);
        });

        it('should call onRefresh multiple times', async () => {
            const onRefresh = jest.fn().mockResolvedValue(undefined);
            
            startAutoRefresh({ onRefresh });
            
            // Fast-forward 5 minutes and flush promises for each interval
            for (let i = 0; i < 3; i++) {
                jest.advanceTimersByTime(5 * 60 * 1000);
                await Promise.resolve();
                await Promise.resolve(); // Extra tick for async completion
            }
            
            expect(onRefresh).toHaveBeenCalledTimes(3);
        });

        it('should call onRefreshComplete after successful refresh', async () => {
            const onRefresh = jest.fn().mockResolvedValue(undefined);
            const onRefreshComplete = jest.fn();
            
            startAutoRefresh({ onRefresh, onRefreshComplete });
            
            jest.advanceTimersByTime(5 * 60 * 1000);
            await Promise.resolve();
            
            expect(onRefreshComplete).toHaveBeenCalled();
        });

        it('should call onRefreshError on failure', async () => {
            const error = new Error('API error');
            const onRefresh = jest.fn().mockRejectedValue(error);
            const onRefreshError = jest.fn();
            
            startAutoRefresh({ onRefresh, onRefreshError });
            
            jest.advanceTimersByTime(5 * 60 * 1000);
            await Promise.resolve();
            await Promise.resolve(); // Extra tick for catch block
            
            expect(onRefreshError).toHaveBeenCalledWith(error);
        });
    });

    describe('stopAutoRefresh', () => {
        it('should stop the refresh timer', () => {
            const onRefresh = jest.fn().mockResolvedValue(undefined);
            
            startAutoRefresh({ onRefresh });
            expect(isAutoRefreshActive()).toBe(true);
            
            stopAutoRefresh();
            expect(isAutoRefreshActive()).toBe(false);
        });

        it('should prevent further refresh calls', async () => {
            const onRefresh = jest.fn().mockResolvedValue(undefined);
            
            startAutoRefresh({ onRefresh });
            stopAutoRefresh();
            
            jest.advanceTimersByTime(10 * 60 * 1000);
            await Promise.resolve();
            
            expect(onRefresh).not.toHaveBeenCalled();
        });
    });

    describe('isAutoRefreshActive', () => {
        it('should return false initially', () => {
            expect(isAutoRefreshActive()).toBe(false);
        });

        it('should return true after starting', () => {
            startAutoRefresh({ onRefresh: jest.fn() });
            expect(isAutoRefreshActive()).toBe(true);
        });

        it('should return false after stopping', () => {
            startAutoRefresh({ onRefresh: jest.fn() });
            stopAutoRefresh();
            expect(isAutoRefreshActive()).toBe(false);
        });
    });

    describe('isRefreshInProgress', () => {
        it('should return false when not refreshing', () => {
            expect(isRefreshInProgress()).toBe(false);
        });
    });

    describe('getRefreshIntervalMinutes', () => {
        it('should return the configured interval', () => {
            expect(getRefreshIntervalMinutes()).toBe(5);
        });
    });

    describe('createAutoRefreshStatusBarItem', () => {
        it('should create a status bar item', () => {
            // eslint-disable-next-line @typescript-eslint/no-var-requires
            const vscode = require('vscode');
            
            const item = createAutoRefreshStatusBarItem();
            
            expect(vscode.window.createStatusBarItem).toHaveBeenCalled();
            expect(item.show).toHaveBeenCalled();
            expect(item.command).toBe('pr-comments.toggleAutoRefresh');
        });
    });

    describe('updateStatusBarItem', () => {
        it('should update text for active auto-refresh', () => {
            const statusBarItem = {
                text: '',
                tooltip: '',
            };
            
            startAutoRefresh({ onRefresh: jest.fn() });
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            updateStatusBarItem(statusBarItem as any);
            
            expect(statusBarItem.text).toContain('5m');
        });

        it('should update text for inactive auto-refresh', () => {
            const statusBarItem = {
                text: '',
                tooltip: '',
            };
            
            stopAutoRefresh();
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            updateStatusBarItem(statusBarItem as any);
            
            expect(statusBarItem.text).toContain('Off');
        });
    });

    describe('disposeAutoRefresh', () => {
        it('should stop timer and clear callbacks', () => {
            startAutoRefresh({ onRefresh: jest.fn() });
            
            disposeAutoRefresh();
            
            expect(isAutoRefreshActive()).toBe(false);
        });
    });
});

describe('Auto-refresh with zero interval', () => {
    beforeEach(() => {
        jest.useFakeTimers();
        disposeAutoRefresh();
        
        // Mock config to return 0 interval
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const { getConfig } = require('../../utils/config');
        getConfig.mockReturnValue({ refreshInterval: 0 });
    });

    afterEach(() => {
        jest.useRealTimers();
        
        // Reset mock
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const { getConfig } = require('../../utils/config');
        getConfig.mockReturnValue({ refreshInterval: 5 });
    });

    it('should not start timer when interval is 0', () => {
        const onRefresh = jest.fn();
        
        startAutoRefresh({ onRefresh });
        
        expect(isAutoRefreshActive()).toBe(false);
    });
});
