import { replyToComment, createReviewComment, getPRHeadCommit, getPRReviewers } from '../../github/client';

// Mock the config module
jest.mock('../../utils/config', () => ({
    getConfig: jest.fn(() => ({
        githubToken: 'ghp_test_token_12345678901234567890',
        githubEnterpriseUrl: '',
    })),
    getGitHubApiBaseUrl: jest.fn(() => 'https://api.github.com'),
    validateToken: jest.fn(() => ({ valid: true })),
}));

// Mock Octokit
const mockCreateReplyForReviewComment = jest.fn();
const mockCreateReviewComment = jest.fn();
const mockGetPull = jest.fn();
const mockListReviews = jest.fn();

jest.mock('@octokit/rest', () => ({
    Octokit: jest.fn().mockImplementation(() => ({
        pulls: {
            createReplyForReviewComment: mockCreateReplyForReviewComment,
            createReviewComment: mockCreateReviewComment,
            get: mockGetPull,
            listReviews: mockListReviews,
        },
    })),
}));

describe('replyToComment', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('should successfully reply to a comment', async () => {
        mockCreateReplyForReviewComment.mockResolvedValue({
            data: {
                id: 999,
                path: 'src/index.ts',
                line: 10,
                body: 'Thanks for the feedback!',
                user: { login: 'author' },
                created_at: '2024-01-15T12:00:00Z',
                updated_at: '2024-01-15T12:00:00Z',
                in_reply_to_id: 123,
            },
        });

        const result = await replyToComment('owner', 'repo', 42, 123, 'Thanks for the feedback!');

        expect(result.success).toBe(true);
        expect(result.comment).toBeDefined();
        expect(result.comment?.id).toBe(999);
        expect(result.comment?.body).toBe('Thanks for the feedback!');
        expect(result.comment?.inReplyToId).toBe(123);
    });

    it('should fail with empty body', async () => {
        const result = await replyToComment('owner', 'repo', 42, 123, '');

        expect(result.success).toBe(false);
        expect(result.error).toBe('Reply body cannot be empty.');
    });

    it('should fail with whitespace-only body', async () => {
        const result = await replyToComment('owner', 'repo', 42, 123, '   ');

        expect(result.success).toBe(false);
        expect(result.error).toBe('Reply body cannot be empty.');
    });

    it('should handle 401 authentication error', async () => {
        mockCreateReplyForReviewComment.mockRejectedValue({ status: 401 });

        const result = await replyToComment('owner', 'repo', 42, 123, 'Test reply');

        expect(result.success).toBe(false);
        expect(result.error).toContain('Authentication failed');
    });

    it('should handle 403 permission error', async () => {
        mockCreateReplyForReviewComment.mockRejectedValue({ status: 403 });

        const result = await replyToComment('owner', 'repo', 42, 123, 'Test reply');

        expect(result.success).toBe(false);
        expect(result.error).toContain('Permission denied');
    });

    it('should handle 404 not found error', async () => {
        mockCreateReplyForReviewComment.mockRejectedValue({ status: 404 });

        const result = await replyToComment('owner', 'repo', 42, 123, 'Test reply');

        expect(result.success).toBe(false);
        expect(result.error).toContain('not found');
    });

    it('should trim reply body', async () => {
        mockCreateReplyForReviewComment.mockResolvedValue({
            data: {
                id: 999,
                path: 'src/index.ts',
                line: 10,
                body: 'Trimmed reply',
                user: { login: 'author' },
                created_at: '2024-01-15T12:00:00Z',
                updated_at: '2024-01-15T12:00:00Z',
            },
        });

        await replyToComment('owner', 'repo', 42, 123, '  Trimmed reply  ');

        expect(mockCreateReplyForReviewComment).toHaveBeenCalledWith(
            expect.objectContaining({
                body: 'Trimmed reply',
            })
        );
    });
});

describe('createReviewComment', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('should successfully create a review comment', async () => {
        mockCreateReviewComment.mockResolvedValue({
            data: {
                id: 888,
                path: 'src/utils.ts',
                line: 25,
                body: 'New comment',
                user: { login: 'reviewer' },
                created_at: '2024-01-15T12:00:00Z',
                updated_at: '2024-01-15T12:00:00Z',
            },
        });

        const result = await createReviewComment(
            'owner', 'repo', 42, 'src/utils.ts', 25, 'New comment', 'abc123'
        );

        expect(result.success).toBe(true);
        expect(result.comment).toBeDefined();
        expect(result.comment?.id).toBe(888);
        expect(result.comment?.path).toBe('src/utils.ts');
        expect(result.comment?.line).toBe(25);
    });

    it('should fail with empty body', async () => {
        const result = await createReviewComment(
            'owner', 'repo', 42, 'src/utils.ts', 25, '', 'abc123'
        );

        expect(result.success).toBe(false);
        expect(result.error).toBe('Comment body cannot be empty.');
    });

    it('should handle 422 invalid location error', async () => {
        mockCreateReviewComment.mockRejectedValue({ status: 422 });

        const result = await createReviewComment(
            'owner', 'repo', 42, 'src/utils.ts', 25, 'Comment', 'abc123'
        );

        expect(result.success).toBe(false);
        expect(result.error).toContain('Invalid comment location');
    });

    it('should pass correct parameters to API', async () => {
        mockCreateReviewComment.mockResolvedValue({
            data: {
                id: 888,
                path: 'src/utils.ts',
                line: 25,
                body: 'Test',
                user: { login: 'reviewer' },
                created_at: '2024-01-15T12:00:00Z',
                updated_at: '2024-01-15T12:00:00Z',
            },
        });

        await createReviewComment(
            'owner', 'repo', 42, 'src/utils.ts', 25, 'Test comment', 'commit123'
        );

        expect(mockCreateReviewComment).toHaveBeenCalledWith({
            owner: 'owner',
            repo: 'repo',
            pull_number: 42,
            body: 'Test comment',
            commit_id: 'commit123',
            path: 'src/utils.ts',
            line: 25,
        });
    });
});

describe('getPRHeadCommit', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('should return the head commit SHA', async () => {
        mockGetPull.mockResolvedValue({
            data: {
                head: { sha: 'abc123def456' },
            },
        });

        const result = await getPRHeadCommit('owner', 'repo', 42);

        expect(result).toBe('abc123def456');
    });

    it('should return null on error', async () => {
        mockGetPull.mockRejectedValue(new Error('API error'));

        const result = await getPRHeadCommit('owner', 'repo', 42);

        expect(result).toBeNull();
    });

    it('should call API with correct parameters', async () => {
        mockGetPull.mockResolvedValue({
            data: { head: { sha: 'abc123' } },
        });

        await getPRHeadCommit('owner', 'repo', 42);

        expect(mockGetPull).toHaveBeenCalledWith({
            owner: 'owner',
            repo: 'repo',
            pull_number: 42,
        });
    });
});

describe('getPRReviewers', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('should return list of unique reviewers', async () => {
        mockListReviews.mockResolvedValue({
            data: [
                { user: { login: 'alice' } },
                { user: { login: 'bob' } },
                { user: { login: 'alice' } }, // Duplicate
            ],
        });

        const result = await getPRReviewers('owner', 'repo', 42);

        expect(result).toHaveLength(2);
        expect(result).toContain('alice');
        expect(result).toContain('bob');
    });

    it('should return sorted list', async () => {
        mockListReviews.mockResolvedValue({
            data: [
                { user: { login: 'charlie' } },
                { user: { login: 'alice' } },
                { user: { login: 'bob' } },
            ],
        });

        const result = await getPRReviewers('owner', 'repo', 42);

        expect(result).toEqual(['alice', 'bob', 'charlie']);
    });

    it('should return empty array on error', async () => {
        mockListReviews.mockRejectedValue(new Error('API error'));

        const result = await getPRReviewers('owner', 'repo', 42);

        expect(result).toEqual([]);
    });

    it('should handle reviews without user', async () => {
        mockListReviews.mockResolvedValue({
            data: [
                { user: { login: 'alice' } },
                { user: null },
                { user: { login: 'bob' } },
            ],
        });

        const result = await getPRReviewers('owner', 'repo', 42);

        expect(result).toHaveLength(2);
        expect(result).toContain('alice');
        expect(result).toContain('bob');
    });
});
