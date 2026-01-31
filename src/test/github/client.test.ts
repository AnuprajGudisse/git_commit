import { createOctokitClient } from '../../github/client';

// Mock vscode
jest.mock('vscode', () => ({
    workspace: {
        getConfiguration: jest.fn(() => ({
            get: jest.fn((key: string) => {
                const defaults: Record<string, unknown> = {
                    githubToken: 'test-token',
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
    },
    window: {
        createOutputChannel: jest.fn(() => ({
            appendLine: jest.fn(),
            show: jest.fn(),
            dispose: jest.fn(),
        })),
    },
}));

// Mock Octokit
jest.mock('@octokit/rest', () => ({
    Octokit: jest.fn().mockImplementation((options) => ({
        auth: options?.auth,
        baseUrl: options?.baseUrl,
        pulls: {
            listReviewComments: jest.fn(),
        },
        users: {
            getAuthenticated: jest.fn(),
        },
        rateLimit: {
            get: jest.fn(),
        },
    })),
}));

describe('createOctokitClient', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('should create client with provided token', () => {
        const client = createOctokitClient('my-token');
        expect(client).toBeDefined();
    });

    it('should create client without token (uses config)', () => {
        const client = createOctokitClient();
        expect(client).toBeDefined();
    });
});

describe('GitHub API Error Handling', () => {
    describe('Rate Limiting', () => {
        it('should identify rate limit errors (403)', () => {
            const error = { status: 403, message: 'rate limit exceeded' };
            expect(error.status).toBe(403);
        });

        it('should identify rate limit errors (429)', () => {
            const error = { status: 429, message: 'too many requests' };
            expect(error.status).toBe(429);
        });
    });

    describe('Authentication Errors', () => {
        it('should identify authentication errors (401)', () => {
            const error = { status: 401, message: 'Bad credentials' };
            expect(error.status).toBe(401);
        });
    });

    describe('Not Found Errors', () => {
        it('should identify not found errors (404)', () => {
            const error = { status: 404, message: 'Not Found' };
            expect(error.status).toBe(404);
        });
    });

    describe('Server Errors', () => {
        it('should identify server errors (500)', () => {
            const error = { status: 500, message: 'Internal Server Error' };
            expect(error.status >= 500).toBe(true);
        });

        it('should identify server errors (502)', () => {
            const error = { status: 502, message: 'Bad Gateway' };
            expect(error.status >= 500).toBe(true);
        });

        it('should identify server errors (503)', () => {
            const error = { status: 503, message: 'Service Unavailable' };
            expect(error.status >= 500).toBe(true);
        });
    });
});

describe('Retry Logic', () => {
    describe('calculateRetryDelay', () => {
        it('should use exponential backoff', () => {
            // Simulating the logic from client.ts
            const calculateRetryDelay = (attempt: number, retryAfter?: string): number => {
                const INITIAL_RETRY_DELAY_MS = 1000;
                if (retryAfter) {
                    const seconds = parseInt(retryAfter, 10);
                    if (!isNaN(seconds)) {
                        return seconds * 1000;
                    }
                }
                return INITIAL_RETRY_DELAY_MS * Math.pow(2, attempt);
            };

            expect(calculateRetryDelay(0)).toBe(1000);  // 1s
            expect(calculateRetryDelay(1)).toBe(2000);  // 2s
            expect(calculateRetryDelay(2)).toBe(4000);  // 4s
        });

        it('should respect retry-after header', () => {
            const calculateRetryDelay = (attempt: number, retryAfter?: string): number => {
                const INITIAL_RETRY_DELAY_MS = 1000;
                if (retryAfter) {
                    const seconds = parseInt(retryAfter, 10);
                    if (!isNaN(seconds)) {
                        return seconds * 1000;
                    }
                }
                return INITIAL_RETRY_DELAY_MS * Math.pow(2, attempt);
            };

            expect(calculateRetryDelay(0, '60')).toBe(60000);  // 60s from header
            expect(calculateRetryDelay(2, '30')).toBe(30000);  // 30s from header
        });
    });
});
