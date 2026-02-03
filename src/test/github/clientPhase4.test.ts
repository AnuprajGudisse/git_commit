/**
 * Tests for Phase 4 GitHub client functions
 */

// Mock the config module
jest.mock('../../utils/config', () => ({
    getConfig: jest.fn(() => ({
        githubToken: 'test-token',
        githubEnterpriseUrl: '',
    })),
    getGitHubApiBaseUrl: jest.fn(() => 'https://api.github.com'),
    validateToken: jest.fn(() => true),
}));

// Mock the logger module
jest.mock('../../utils/logger', () => ({
    logInfo: jest.fn(),
    logError: jest.fn(),
    logWarn: jest.fn(),
}));

// Mock Octokit
const mockGraphql = jest.fn();
const mockIssuesListComments = jest.fn();
const mockIssuesCreateComment = jest.fn();
const mockPullsList = jest.fn();

jest.mock('@octokit/rest', () => ({
    Octokit: jest.fn().mockImplementation(() => ({
        graphql: mockGraphql,
        issues: {
            listComments: mockIssuesListComments,
            createComment: mockIssuesCreateComment,
        },
        pulls: {
            list: mockPullsList,
        },
    })),
}));

import {
    resolveThread,
    unresolveThread,
    fetchIssueComments,
    createIssueComment,
    listOpenPRs,
    fetchCommentsWithThreads,
} from '../../github/client';

describe('Phase 4 GitHub Client Functions', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('resolveThread', () => {
        it('should resolve a thread successfully', async () => {
            mockGraphql.mockResolvedValueOnce({
                resolveReviewThread: {
                    thread: { isResolved: true },
                },
            });

            const result = await resolveThread('owner', 'repo', 'thread-id-123');

            expect(result.success).toBe(true);
            expect(mockGraphql).toHaveBeenCalledWith(
                expect.stringContaining('resolveReviewThread'),
                { threadId: 'thread-id-123' }
            );
        });

        it('should handle authentication errors', async () => {
            mockGraphql.mockRejectedValueOnce({ status: 401 });

            const result = await resolveThread('owner', 'repo', 'thread-id-123');

            expect(result.success).toBe(false);
            expect(result.error).toContain('Authentication');
        });

        it('should handle permission errors', async () => {
            mockGraphql.mockRejectedValueOnce({ status: 403 });

            const result = await resolveThread('owner', 'repo', 'thread-id-123');

            expect(result.success).toBe(false);
            expect(result.error).toContain('Permission');
        });

        it('should return error when no token configured', async () => {
            const { getConfig } = require('../../utils/config');
            getConfig.mockReturnValueOnce({ githubToken: '' });

            const result = await resolveThread('owner', 'repo', 'thread-id-123');

            expect(result.success).toBe(false);
            expect(result.error).toContain('token');
        });
    });

    describe('unresolveThread', () => {
        it('should unresolve a thread successfully', async () => {
            mockGraphql.mockResolvedValueOnce({
                unresolveReviewThread: {
                    thread: { isResolved: false },
                },
            });

            const result = await unresolveThread('owner', 'repo', 'thread-id-123');

            expect(result.success).toBe(true);
            expect(mockGraphql).toHaveBeenCalledWith(
                expect.stringContaining('unresolveReviewThread'),
                { threadId: 'thread-id-123' }
            );
        });

        it('should handle errors', async () => {
            mockGraphql.mockRejectedValueOnce(new Error('API error'));

            const result = await unresolveThread('owner', 'repo', 'thread-id-123');

            expect(result.success).toBe(false);
            expect(result.error).toBe('API error');
        });
    });

    describe('fetchIssueComments', () => {
        it('should fetch issue comments successfully', async () => {
            mockIssuesListComments.mockResolvedValueOnce({
                data: [
                    {
                        id: 1,
                        body: 'First comment',
                        user: { login: 'user1' },
                        created_at: '2024-01-01T00:00:00Z',
                        updated_at: '2024-01-01T00:00:00Z',
                        author_association: 'MEMBER',
                    },
                    {
                        id: 2,
                        body: 'Second comment',
                        user: { login: 'user2' },
                        created_at: '2024-01-02T00:00:00Z',
                        author_association: 'CONTRIBUTOR',
                    },
                ],
            });

            const result = await fetchIssueComments('owner', 'repo', 42);

            expect(result.success).toBe(true);
            expect(result.comments).toHaveLength(2);
            expect(result.comments[0].user).toBe('user1');
            expect(result.comments[0].body).toBe('First comment');
            expect(result.comments[1].user).toBe('user2');
        });

        it('should handle empty comments', async () => {
            mockIssuesListComments.mockResolvedValueOnce({ data: [] });

            const result = await fetchIssueComments('owner', 'repo', 42);

            expect(result.success).toBe(true);
            expect(result.comments).toHaveLength(0);
        });

        it('should handle API errors', async () => {
            mockIssuesListComments.mockRejectedValueOnce(new Error('Network error'));

            const result = await fetchIssueComments('owner', 'repo', 42);

            expect(result.success).toBe(false);
            expect(result.error).toBe('Network error');
        });

        it('should return error when no token configured', async () => {
            const { getConfig } = require('../../utils/config');
            getConfig.mockReturnValueOnce({ githubToken: '' });

            const result = await fetchIssueComments('owner', 'repo', 42);

            expect(result.success).toBe(false);
            expect(result.error).toContain('token');
        });
    });

    describe('createIssueComment', () => {
        it('should create an issue comment successfully', async () => {
            mockIssuesCreateComment.mockResolvedValueOnce({
                data: {
                    id: 999,
                    body: 'New comment',
                    user: { login: 'testuser' },
                    created_at: '2024-01-01T00:00:00Z',
                    updated_at: '2024-01-01T00:00:00Z',
                },
            });

            const result = await createIssueComment('owner', 'repo', 42, 'New comment');

            expect(result.success).toBe(true);
            expect(result.comment?.id).toBe(999);
            expect(result.comment?.body).toBe('New comment');
        });

        it('should reject empty comment body', async () => {
            const result = await createIssueComment('owner', 'repo', 42, '');

            expect(result.success).toBe(false);
            expect(result.error).toContain('empty');
        });

        it('should reject whitespace-only comment body', async () => {
            const result = await createIssueComment('owner', 'repo', 42, '   ');

            expect(result.success).toBe(false);
            expect(result.error).toContain('empty');
        });

        it('should handle API errors', async () => {
            mockIssuesCreateComment.mockRejectedValueOnce(new Error('Failed to post'));

            const result = await createIssueComment('owner', 'repo', 42, 'Test comment');

            expect(result.success).toBe(false);
            expect(result.error).toBe('Failed to post');
        });
    });

    describe('listOpenPRs', () => {
        it('should list open PRs successfully', async () => {
            mockPullsList.mockResolvedValueOnce({
                data: [
                    {
                        number: 1,
                        title: 'First PR',
                        state: 'open',
                        user: { login: 'author1' },
                        created_at: '2024-01-01T00:00:00Z',
                        updated_at: '2024-01-02T00:00:00Z',
                        head: { ref: 'feature-branch' },
                        base: { ref: 'main' },
                        draft: false,
                    },
                    {
                        number: 2,
                        title: 'Draft PR',
                        state: 'open',
                        user: { login: 'author2' },
                        created_at: '2024-01-03T00:00:00Z',
                        updated_at: '2024-01-04T00:00:00Z',
                        head: { ref: 'draft-branch' },
                        base: { ref: 'main' },
                        draft: true,
                    },
                ],
            });

            const result = await listOpenPRs('owner', 'repo');

            expect(result.success).toBe(true);
            expect(result.prs).toHaveLength(2);
            expect(result.prs[0].number).toBe(1);
            expect(result.prs[0].title).toBe('First PR');
            expect(result.prs[0].draft).toBe(false);
            expect(result.prs[1].draft).toBe(true);
        });

        it('should handle empty PR list', async () => {
            mockPullsList.mockResolvedValueOnce({ data: [] });

            const result = await listOpenPRs('owner', 'repo');

            expect(result.success).toBe(true);
            expect(result.prs).toHaveLength(0);
        });

        it('should handle API errors', async () => {
            mockPullsList.mockRejectedValueOnce(new Error('API error'));

            const result = await listOpenPRs('owner', 'repo');

            expect(result.success).toBe(false);
            expect(result.error).toBe('API error');
        });

        it('should return error when no token configured', async () => {
            const { getConfig } = require('../../utils/config');
            getConfig.mockReturnValueOnce({ githubToken: '' });

            const result = await listOpenPRs('owner', 'repo');

            expect(result.success).toBe(false);
            expect(result.error).toContain('token');
        });
    });

    describe('fetchCommentsWithThreads', () => {
        it('should fetch comments with thread info successfully', async () => {
            mockGraphql.mockResolvedValueOnce({
                repository: {
                    pullRequest: {
                        reviewThreads: {
                            nodes: [
                                {
                                    id: 'thread-1',
                                    isResolved: false,
                                    comments: {
                                        nodes: [
                                            {
                                                databaseId: 101,
                                                path: 'src/file.ts',
                                                line: 10,
                                                body: 'Comment 1',
                                                author: { login: 'user1' },
                                                createdAt: '2024-01-01T00:00:00Z',
                                                updatedAt: '2024-01-01T00:00:00Z',
                                                replyTo: null,
                                                diffHunk: '@@ -1,3 +1,4 @@',
                                                commit: { oid: 'abc123' },
                                                authorAssociation: 'MEMBER',
                                            },
                                        ],
                                    },
                                },
                                {
                                    id: 'thread-2',
                                    isResolved: true,
                                    comments: {
                                        nodes: [
                                            {
                                                databaseId: 102,
                                                path: 'src/other.ts',
                                                line: 20,
                                                body: 'Resolved comment',
                                                author: { login: 'user2' },
                                                createdAt: '2024-01-02T00:00:00Z',
                                                updatedAt: '2024-01-02T00:00:00Z',
                                                replyTo: null,
                                                diffHunk: '@@ -5,3 +5,4 @@',
                                                commit: { oid: 'def456' },
                                                authorAssociation: 'CONTRIBUTOR',
                                            },
                                        ],
                                    },
                                },
                            ],
                        },
                    },
                },
            });

            const result = await fetchCommentsWithThreads('owner', 'repo', 42);

            expect(result.success).toBe(true);
            expect(result.comments).toHaveLength(2);
            expect(result.threads.size).toBe(2);

            // Check first comment
            expect(result.comments[0].id).toBe(101);
            expect(result.comments[0].resolved).toBe(false);

            // Check second comment
            expect(result.comments[1].id).toBe(102);
            expect(result.comments[1].resolved).toBe(true);

            // Check thread mappings
            expect(result.threads.get(101)?.threadId).toBe('thread-1');
            expect(result.threads.get(101)?.resolved).toBe(false);
            expect(result.threads.get(102)?.threadId).toBe('thread-2');
            expect(result.threads.get(102)?.resolved).toBe(true);
        });

        it('should handle empty threads', async () => {
            mockGraphql.mockResolvedValueOnce({
                repository: {
                    pullRequest: {
                        reviewThreads: {
                            nodes: [],
                        },
                    },
                },
            });

            const result = await fetchCommentsWithThreads('owner', 'repo', 42);

            expect(result.success).toBe(true);
            expect(result.comments).toHaveLength(0);
            expect(result.threads.size).toBe(0);
        });

        it('should handle API errors', async () => {
            mockGraphql.mockRejectedValueOnce(new Error('GraphQL error'));

            const result = await fetchCommentsWithThreads('owner', 'repo', 42);

            expect(result.success).toBe(false);
            expect(result.error).toBe('GraphQL error');
        });

        it('should return error when no token configured', async () => {
            const { getConfig } = require('../../utils/config');
            getConfig.mockReturnValueOnce({ githubToken: '' });

            const result = await fetchCommentsWithThreads('owner', 'repo', 42);

            expect(result.success).toBe(false);
            expect(result.error).toContain('token');
        });
    });
});
