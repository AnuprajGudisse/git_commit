import { validateToken } from '../../utils/config';

// Mock vscode module
jest.mock('vscode', () => ({
    workspace: {
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
    },
}));

describe('validateToken', () => {
    describe('Valid tokens', () => {
        it('should accept classic personal access token (ghp_)', () => {
            const result = validateToken('ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx');
            expect(result.valid).toBe(true);
        });

        it('should accept fine-grained token (github_pat_)', () => {
            const result = validateToken('github_pat_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx');
            expect(result.valid).toBe(true);
        });

        it('should accept OAuth token (gho_)', () => {
            const result = validateToken('gho_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx');
            expect(result.valid).toBe(true);
        });

        it('should accept user-to-server token (ghu_)', () => {
            const result = validateToken('ghu_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx');
            expect(result.valid).toBe(true);
        });

        it('should accept server-to-server token (ghs_)', () => {
            const result = validateToken('ghs_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx');
            expect(result.valid).toBe(true);
        });

        it('should accept refresh token (ghr_)', () => {
            const result = validateToken('ghr_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx');
            expect(result.valid).toBe(true);
        });

        it('should accept older format tokens (long enough)', () => {
            // Older tokens don't have prefixes but are 40 chars
            const result = validateToken('1234567890123456789012345678901234567890');
            expect(result.valid).toBe(true);
        });
    });

    describe('Invalid tokens', () => {
        it('should reject empty string', () => {
            const result = validateToken('');
            expect(result.valid).toBe(false);
            expect(result.message).toBe('GitHub token is empty');
        });

        it('should reject whitespace only', () => {
            const result = validateToken('   ');
            expect(result.valid).toBe(false);
            expect(result.message).toBe('GitHub token is empty');
        });

        it('should reject very short tokens without valid prefix', () => {
            const result = validateToken('abc123');
            expect(result.valid).toBe(false);
            expect(result.message).toBe('Token appears too short to be valid');
        });

        it('should reject tokens shorter than 20 chars without valid prefix', () => {
            const result = validateToken('1234567890123456789');
            expect(result.valid).toBe(false);
        });
    });

    describe('Edge cases', () => {
        it('should handle null-like values gracefully', () => {
            const result = validateToken(undefined as unknown as string);
            expect(result.valid).toBe(false);
        });

        it('should accept tokens at minimum length threshold', () => {
            // 20 characters should be valid
            const result = validateToken('12345678901234567890');
            expect(result.valid).toBe(true);
        });
    });
});
