import { parseGitRemoteUrl, extractPRNumberFromBranch } from '../../git/repository';

describe('parseGitRemoteUrl', () => {
    describe('HTTPS URLs', () => {
        it('should parse standard HTTPS URL', () => {
            const result = parseGitRemoteUrl('https://github.com/owner/repo.git');
            expect(result).toEqual({ owner: 'owner', repo: 'repo' });
        });

        it('should parse HTTPS URL without .git suffix', () => {
            const result = parseGitRemoteUrl('https://github.com/owner/repo');
            expect(result).toEqual({ owner: 'owner', repo: 'repo' });
        });

        it('should parse GitHub Enterprise HTTPS URL', () => {
            const result = parseGitRemoteUrl('https://github.enterprise.com/owner/repo.git');
            expect(result).toEqual({ owner: 'owner', repo: 'repo' });
        });

        it('should handle repo names with hyphens', () => {
            const result = parseGitRemoteUrl('https://github.com/my-org/my-repo-name.git');
            expect(result).toEqual({ owner: 'my-org', repo: 'my-repo-name' });
        });

        it('should handle repo names with underscores', () => {
            const result = parseGitRemoteUrl('https://github.com/my_org/my_repo.git');
            expect(result).toEqual({ owner: 'my_org', repo: 'my_repo' });
        });
    });

    describe('SSH URLs', () => {
        it('should parse standard SSH URL', () => {
            const result = parseGitRemoteUrl('git@github.com:owner/repo.git');
            expect(result).toEqual({ owner: 'owner', repo: 'repo' });
        });

        it('should parse SSH URL without .git suffix', () => {
            const result = parseGitRemoteUrl('git@github.com:owner/repo');
            expect(result).toEqual({ owner: 'owner', repo: 'repo' });
        });

        it('should parse GitHub Enterprise SSH URL', () => {
            const result = parseGitRemoteUrl('git@github.enterprise.com:owner/repo.git');
            expect(result).toEqual({ owner: 'owner', repo: 'repo' });
        });
    });

    describe('Invalid URLs', () => {
        it('should return null for empty string', () => {
            const result = parseGitRemoteUrl('');
            expect(result).toBeNull();
        });

        it('should return null for non-GitHub URL', () => {
            const result = parseGitRemoteUrl('https://gitlab.com/owner/repo.git');
            expect(result).toBeNull();
        });

        it('should return null for malformed URL', () => {
            const result = parseGitRemoteUrl('not-a-url');
            expect(result).toBeNull();
        });
    });

    describe('Simple owner/repo format', () => {
        it('should parse simple owner/repo format', () => {
            const result = parseGitRemoteUrl('owner/repo');
            expect(result).toEqual({ owner: 'owner', repo: 'repo' });
        });
    });
});

describe('extractPRNumberFromBranch', () => {
    describe('PR prefix patterns', () => {
        it('should extract from pr-123', () => {
            expect(extractPRNumberFromBranch('pr-123')).toBe(123);
        });

        it('should extract from PR-123 (uppercase)', () => {
            expect(extractPRNumberFromBranch('PR-123')).toBe(123);
        });

        it('should extract from pr_123', () => {
            expect(extractPRNumberFromBranch('pr_123')).toBe(123);
        });

        it('should extract from pr123', () => {
            expect(extractPRNumberFromBranch('pr123')).toBe(123);
        });
    });

    describe('Pull prefix patterns', () => {
        it('should extract from pull-123', () => {
            expect(extractPRNumberFromBranch('pull-123')).toBe(123);
        });

        it('should extract from pull_123', () => {
            expect(extractPRNumberFromBranch('pull_123')).toBe(123);
        });

        it('should extract from pull123', () => {
            expect(extractPRNumberFromBranch('pull123')).toBe(123);
        });
    });

    describe('Number prefix patterns', () => {
        it('should extract from 123-feature-name', () => {
            expect(extractPRNumberFromBranch('123-feature-name')).toBe(123);
        });

        it('should extract from 456_bugfix', () => {
            expect(extractPRNumberFromBranch('456_bugfix')).toBe(456);
        });
    });

    describe('Embedded PR patterns', () => {
        it('should extract from feature-pr-123', () => {
            expect(extractPRNumberFromBranch('feature-pr-123')).toBe(123);
        });

        it('should extract from bugfix_pull_456', () => {
            expect(extractPRNumberFromBranch('bugfix_pull_456')).toBe(456);
        });

        it('should extract from fix-pr-789-description', () => {
            expect(extractPRNumberFromBranch('fix-pr-789-description')).toBe(789);
        });
    });

    describe('Non-matching patterns', () => {
        it('should return null for main branch', () => {
            expect(extractPRNumberFromBranch('main')).toBeNull();
        });

        it('should return null for develop branch', () => {
            expect(extractPRNumberFromBranch('develop')).toBeNull();
        });

        it('should return null for feature branch without PR number', () => {
            expect(extractPRNumberFromBranch('feature/add-login')).toBeNull();
        });

        it('should NOT extract from node-20-upgrade (false positive)', () => {
            // This is a version number, not a PR number
            expect(extractPRNumberFromBranch('node-20-upgrade')).toBeNull();
        });

        it('should return null for empty string', () => {
            expect(extractPRNumberFromBranch('')).toBeNull();
        });
    });

    describe('Edge cases', () => {
        it('should handle very large PR numbers', () => {
            expect(extractPRNumberFromBranch('pr-99999')).toBe(99999);
        });

        it('should handle single digit PR numbers', () => {
            expect(extractPRNumberFromBranch('pr-1')).toBe(1);
        });

        it('should extract first match when multiple patterns exist', () => {
            // pr-123 should be matched first
            expect(extractPRNumberFromBranch('pr-123-also-456')).toBe(123);
        });
    });
});
