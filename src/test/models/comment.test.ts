import { PRComment, RepositoryInfo, FetchResult } from '../../models/comment';

describe('PRComment interface', () => {
    it('should create a valid PRComment object', () => {
        const comment: PRComment = {
            path: 'src/index.ts',
            line: 42,
            body: 'This looks good!',
            user: 'reviewer',
            id: 12345,
        };

        expect(comment.path).toBe('src/index.ts');
        expect(comment.line).toBe(42);
        expect(comment.body).toBe('This looks good!');
        expect(comment.user).toBe('reviewer');
        expect(comment.id).toBe(12345);
    });

    it('should support optional fields', () => {
        const comment: PRComment = {
            path: 'src/index.ts',
            line: 10,
            body: 'Comment body',
            user: 'user1',
            id: 1,
            createdAt: '2024-01-15T10:00:00Z',
            updatedAt: '2024-01-15T11:00:00Z',
            inReplyToId: 100,
            resolved: false,
        };

        expect(comment.createdAt).toBe('2024-01-15T10:00:00Z');
        expect(comment.updatedAt).toBe('2024-01-15T11:00:00Z');
        expect(comment.inReplyToId).toBe(100);
        expect(comment.resolved).toBe(false);
    });

    it('should handle resolved comments', () => {
        const comment: PRComment = {
            path: 'src/test.ts',
            line: 5,
            body: 'Fixed!',
            user: 'author',
            id: 999,
            resolved: true,
        };

        expect(comment.resolved).toBe(true);
    });
});

describe('RepositoryInfo interface', () => {
    it('should create a valid RepositoryInfo object', () => {
        const repoInfo: RepositoryInfo = {
            owner: 'octocat',
            repo: 'hello-world',
            prNumber: 123,
        };

        expect(repoInfo.owner).toBe('octocat');
        expect(repoInfo.repo).toBe('hello-world');
        expect(repoInfo.prNumber).toBe(123);
    });

    it('should handle null PR number', () => {
        const repoInfo: RepositoryInfo = {
            owner: 'octocat',
            repo: 'hello-world',
            prNumber: null,
        };

        expect(repoInfo.prNumber).toBeNull();
    });
});

describe('FetchResult interface', () => {
    it('should create a successful FetchResult', () => {
        const result: FetchResult = {
            success: true,
            comments: [
                {
                    path: 'src/index.ts',
                    line: 1,
                    body: 'Test comment',
                    user: 'tester',
                    id: 1,
                },
            ],
            rateLimitRemaining: 4999,
            rateLimitReset: new Date('2024-01-15T12:00:00Z'),
        };

        expect(result.success).toBe(true);
        expect(result.comments).toHaveLength(1);
        expect(result.rateLimitRemaining).toBe(4999);
        expect(result.error).toBeUndefined();
    });

    it('should create a failed FetchResult', () => {
        const result: FetchResult = {
            success: false,
            comments: [],
            error: 'Authentication failed',
        };

        expect(result.success).toBe(false);
        expect(result.comments).toHaveLength(0);
        expect(result.error).toBe('Authentication failed');
    });

    it('should handle rate limit information', () => {
        const resetDate = new Date('2024-01-15T12:00:00Z');
        const result: FetchResult = {
            success: true,
            comments: [],
            rateLimitRemaining: 10,
            rateLimitReset: resetDate,
        };

        expect(result.rateLimitRemaining).toBe(10);
        expect(result.rateLimitReset).toEqual(resetDate);
    });
});
