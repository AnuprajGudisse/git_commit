import { PRComment, CommentThread } from '../../models/comment';
import { 
    CommentTreeProvider, 
    FileItem, 
    ThreadItem, 
    CommentItem,
    getCommentTreeProvider,
    disposeCommentTreeProvider 
} from '../../views/commentTreeProvider';

describe('CommentTreeProvider', () => {
    let provider: CommentTreeProvider;

    beforeEach(() => {
        disposeCommentTreeProvider();
        provider = getCommentTreeProvider();
    });

    afterEach(() => {
        disposeCommentTreeProvider();
    });

    describe('setComments', () => {
        it('should store comments and build threads', () => {
            const comments = new Map<string, PRComment[]>();
            comments.set('src/index.ts', [
                { id: 1, path: 'src/index.ts', line: 10, body: 'Comment 1', user: 'user1' },
                { id: 2, path: 'src/index.ts', line: 20, body: 'Comment 2', user: 'user2' },
            ]);

            provider.setComments(comments);

            expect(provider.getTotalCommentCount()).toBe(2);
            expect(provider.getThreadCount()).toBe(2);
        });

        it('should group replies into threads', () => {
            const comments = new Map<string, PRComment[]>();
            comments.set('src/index.ts', [
                { id: 1, path: 'src/index.ts', line: 10, body: 'Root comment', user: 'user1' },
                { id: 2, path: 'src/index.ts', line: 10, body: 'Reply 1', user: 'user2', inReplyToId: 1 },
                { id: 3, path: 'src/index.ts', line: 10, body: 'Reply 2', user: 'user1', inReplyToId: 1 },
            ]);

            provider.setComments(comments);

            expect(provider.getTotalCommentCount()).toBe(3);
            expect(provider.getThreadCount()).toBe(1); // Only 1 thread with 2 replies
        });

        it('should collect unique reviewers', () => {
            const comments = new Map<string, PRComment[]>();
            comments.set('src/index.ts', [
                { id: 1, path: 'src/index.ts', line: 10, body: 'Comment', user: 'alice' },
                { id: 2, path: 'src/index.ts', line: 20, body: 'Comment', user: 'bob' },
                { id: 3, path: 'src/index.ts', line: 30, body: 'Comment', user: 'alice' },
            ]);

            provider.setComments(comments);

            const reviewers = provider.getReviewers();
            expect(reviewers).toHaveLength(2);
            expect(reviewers).toContain('alice');
            expect(reviewers).toContain('bob');
        });
    });

    describe('filtering', () => {
        beforeEach(() => {
            const comments = new Map<string, PRComment[]>();
            comments.set('src/index.ts', [
                { id: 1, path: 'src/index.ts', line: 10, body: 'Comment', user: 'alice', resolved: false },
                { id: 2, path: 'src/index.ts', line: 20, body: 'Comment', user: 'bob', resolved: true },
            ]);
            provider.setComments(comments);
        });

        it('should filter by reviewer', async () => {
            provider.setFilter({ reviewer: 'alice' });
            
            const children = await provider.getChildren();
            expect(children).toHaveLength(1);
            
            const fileItem = children[0] as FileItem;
            expect(fileItem.commentCount).toBe(1);
        });

        it('should filter by resolved status', async () => {
            provider.setFilter({ resolved: false });
            
            const children = await provider.getChildren();
            const fileItem = children[0] as FileItem;
            expect(fileItem.commentCount).toBe(1);
        });

        it('should clear filters', async () => {
            provider.setFilter({ reviewer: 'alice' });
            provider.clearFilter();
            
            const children = await provider.getChildren();
            const fileItem = children[0] as FileItem;
            expect(fileItem.commentCount).toBe(2);
        });
    });

    describe('getChildren', () => {
        beforeEach(() => {
            const comments = new Map<string, PRComment[]>();
            comments.set('src/index.ts', [
                { id: 1, path: 'src/index.ts', line: 10, body: 'Root', user: 'user1' },
                { id: 2, path: 'src/index.ts', line: 10, body: 'Reply', user: 'user2', inReplyToId: 1 },
            ]);
            comments.set('src/utils.ts', [
                { id: 3, path: 'src/utils.ts', line: 5, body: 'Comment', user: 'user1' },
            ]);
            provider.setComments(comments);
        });

        it('should return file items at root level', async () => {
            const children = await provider.getChildren();
            
            expect(children).toHaveLength(2);
            expect(children[0]).toBeInstanceOf(FileItem);
            expect(children[1]).toBeInstanceOf(FileItem);
        });

        it('should return thread items for file', async () => {
            const files = await provider.getChildren();
            const indexFile = files.find(f => (f as FileItem).filePath === 'src/index.ts') as FileItem;
            
            const threads = await provider.getChildren(indexFile);
            
            expect(threads).toHaveLength(1);
            expect(threads[0]).toBeInstanceOf(ThreadItem);
        });

        it('should return comment items for thread with replies', async () => {
            const files = await provider.getChildren();
            const indexFile = files.find(f => (f as FileItem).filePath === 'src/index.ts') as FileItem;
            const threads = await provider.getChildren(indexFile);
            const thread = threads[0] as ThreadItem;
            
            const comments = await provider.getChildren(thread);
            
            expect(comments).toHaveLength(2); // Root + 1 reply
            expect(comments[0]).toBeInstanceOf(CommentItem);
            expect(comments[1]).toBeInstanceOf(CommentItem);
        });
    });

    describe('getTreeItem', () => {
        it('should return the same item', () => {
            const fileItem = new FileItem('test.ts', [], 5);
            expect(provider.getTreeItem(fileItem)).toBe(fileItem);
        });
    });
});

describe('FileItem', () => {
    it('should create with correct properties', () => {
        const threads: CommentThread[] = [
            {
                id: 1,
                path: 'test.ts',
                line: 10,
                rootComment: { id: 1, path: 'test.ts', line: 10, body: 'Test', user: 'user1' },
                replies: [],
                resolved: false,
                participants: ['user1'],
            },
        ];
        
        const item = new FileItem('test.ts', threads, 3);
        
        expect(item.filePath).toBe('test.ts');
        expect(item.threads).toBe(threads);
        expect(item.commentCount).toBe(3);
        expect(item.description).toBe('3 comments');
        expect(item.contextValue).toBe('file');
    });

    it('should use singular for 1 comment', () => {
        const item = new FileItem('test.ts', [], 1);
        expect(item.description).toBe('1 comment');
    });
});

describe('ThreadItem', () => {
    it('should create with correct properties for unresolved thread', () => {
        const thread: CommentThread = {
            id: 1,
            path: 'test.ts',
            line: 10,
            rootComment: { id: 1, path: 'test.ts', line: 10, body: 'Test', user: 'reviewer' },
            replies: [],
            resolved: false,
            participants: ['reviewer'],
        };
        
        const item = new ThreadItem(thread, 'test.ts');
        
        expect(item.thread).toBe(thread);
        expect(item.filePath).toBe('test.ts');
        expect(item.contextValue).toBe('thread');
        expect(item.label).toBe('Line 10: reviewer');
    });

    it('should show resolved context for resolved thread', () => {
        const thread: CommentThread = {
            id: 1,
            path: 'test.ts',
            line: 10,
            rootComment: { id: 1, path: 'test.ts', line: 10, body: 'Test', user: 'reviewer' },
            replies: [],
            resolved: true,
            participants: ['reviewer'],
        };
        
        const item = new ThreadItem(thread, 'test.ts');
        
        expect(item.contextValue).toBe('thread-resolved');
    });

    it('should show reply count in description', () => {
        const thread: CommentThread = {
            id: 1,
            path: 'test.ts',
            line: 10,
            rootComment: { id: 1, path: 'test.ts', line: 10, body: 'Test', user: 'reviewer' },
            replies: [
                { id: 2, path: 'test.ts', line: 10, body: 'Reply 1', user: 'author', inReplyToId: 1 },
                { id: 3, path: 'test.ts', line: 10, body: 'Reply 2', user: 'reviewer', inReplyToId: 1 },
            ],
            resolved: false,
            participants: ['reviewer', 'author'],
        };
        
        const item = new ThreadItem(thread, 'test.ts');
        
        expect(item.description).toBe('2 replies');
    });

    it('should use singular for 1 reply', () => {
        const thread: CommentThread = {
            id: 1,
            path: 'test.ts',
            line: 10,
            rootComment: { id: 1, path: 'test.ts', line: 10, body: 'Test', user: 'reviewer' },
            replies: [
                { id: 2, path: 'test.ts', line: 10, body: 'Reply', user: 'author', inReplyToId: 1 },
            ],
            resolved: false,
            participants: ['reviewer', 'author'],
        };
        
        const item = new ThreadItem(thread, 'test.ts');
        
        expect(item.description).toBe('1 reply');
    });
});

describe('CommentItem', () => {
    it('should create with correct properties', () => {
        const comment: PRComment = {
            id: 1,
            path: 'test.ts',
            line: 10,
            body: 'Test comment',
            user: 'reviewer',
            createdAt: '2024-01-15T10:00:00Z',
        };
        
        const item = new CommentItem(comment, 'test.ts', false);
        
        expect(item.comment).toBe(comment);
        expect(item.filePath).toBe('test.ts');
        expect(item.isReply).toBe(false);
        expect(item.contextValue).toBe('comment');
        expect(item.label).toBe('reviewer');
    });

    it('should prefix reply with arrow', () => {
        const comment: PRComment = {
            id: 2,
            path: 'test.ts',
            line: 10,
            body: 'Reply',
            user: 'author',
            inReplyToId: 1,
        };
        
        const item = new CommentItem(comment, 'test.ts', true);
        
        expect(item.label).toBe('↳ author');
        expect(item.isReply).toBe(true);
    });
});

describe('getCommentTreeProvider singleton', () => {
    beforeEach(() => {
        disposeCommentTreeProvider();
    });

    it('should return same instance', () => {
        const provider1 = getCommentTreeProvider();
        const provider2 = getCommentTreeProvider();
        
        expect(provider1).toBe(provider2);
    });

    it('should create new instance after dispose', () => {
        const provider1 = getCommentTreeProvider();
        disposeCommentTreeProvider();
        const provider2 = getCommentTreeProvider();
        
        expect(provider1).not.toBe(provider2);
    });
});
