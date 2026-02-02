import { CommentThread, ReplyResult, FilterOptions } from '../../models/comment';

describe('CommentThread interface', () => {
    it('should create a valid CommentThread', () => {
        const thread: CommentThread = {
            id: 123,
            path: 'src/index.ts',
            line: 42,
            rootComment: {
                id: 123,
                path: 'src/index.ts',
                line: 42,
                body: 'This needs refactoring',
                user: 'reviewer1',
            },
            replies: [
                {
                    id: 124,
                    path: 'src/index.ts',
                    line: 42,
                    body: 'I agree, will fix',
                    user: 'author',
                    inReplyToId: 123,
                },
            ],
            resolved: false,
            participants: ['reviewer1', 'author'],
        };

        expect(thread.id).toBe(123);
        expect(thread.path).toBe('src/index.ts');
        expect(thread.line).toBe(42);
        expect(thread.rootComment.user).toBe('reviewer1');
        expect(thread.replies).toHaveLength(1);
        expect(thread.resolved).toBe(false);
        expect(thread.participants).toContain('reviewer1');
        expect(thread.participants).toContain('author');
    });

    it('should support empty replies array', () => {
        const thread: CommentThread = {
            id: 1,
            path: 'test.ts',
            line: 1,
            rootComment: {
                id: 1,
                path: 'test.ts',
                line: 1,
                body: 'Comment',
                user: 'user1',
            },
            replies: [],
            resolved: false,
            participants: ['user1'],
        };

        expect(thread.replies).toHaveLength(0);
    });

    it('should support resolved threads', () => {
        const thread: CommentThread = {
            id: 1,
            path: 'test.ts',
            line: 1,
            rootComment: {
                id: 1,
                path: 'test.ts',
                line: 1,
                body: 'Fixed',
                user: 'user1',
            },
            replies: [],
            resolved: true,
            participants: ['user1'],
        };

        expect(thread.resolved).toBe(true);
    });
});

describe('ReplyResult interface', () => {
    it('should create a successful ReplyResult', () => {
        const result: ReplyResult = {
            success: true,
            comment: {
                id: 999,
                path: 'src/index.ts',
                line: 10,
                body: 'Reply content',
                user: 'author',
                inReplyToId: 123,
            },
        };

        expect(result.success).toBe(true);
        expect(result.comment).toBeDefined();
        expect(result.comment?.id).toBe(999);
        expect(result.error).toBeUndefined();
    });

    it('should create a failed ReplyResult', () => {
        const result: ReplyResult = {
            success: false,
            error: 'Permission denied',
        };

        expect(result.success).toBe(false);
        expect(result.comment).toBeUndefined();
        expect(result.error).toBe('Permission denied');
    });
});

describe('FilterOptions interface', () => {
    it('should create filter with reviewer', () => {
        const filter: FilterOptions = {
            reviewer: 'alice',
        };

        expect(filter.reviewer).toBe('alice');
        expect(filter.resolved).toBeUndefined();
        expect(filter.file).toBeUndefined();
    });

    it('should create filter with resolved status', () => {
        const filter: FilterOptions = {
            resolved: false,
        };

        expect(filter.resolved).toBe(false);
    });

    it('should create filter with file pattern', () => {
        const filter: FilterOptions = {
            file: 'src/',
        };

        expect(filter.file).toBe('src/');
    });

    it('should create combined filter', () => {
        const filter: FilterOptions = {
            reviewer: 'bob',
            resolved: true,
            file: 'test/',
        };

        expect(filter.reviewer).toBe('bob');
        expect(filter.resolved).toBe(true);
        expect(filter.file).toBe('test/');
    });

    it('should support empty filter', () => {
        const filter: FilterOptions = {};

        expect(filter.reviewer).toBeUndefined();
        expect(filter.resolved).toBeUndefined();
        expect(filter.file).toBeUndefined();
    });
});
