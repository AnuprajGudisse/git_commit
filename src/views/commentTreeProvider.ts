import * as vscode from 'vscode';
import { PRComment, CommentThread, FilterOptions } from '../models/comment';

export type CommentTreeItem = FileItem | ThreadItem | CommentItem;

export class FileItem extends vscode.TreeItem {
    constructor(
        public readonly filePath: string,
        public readonly threads: CommentThread[],
        public readonly commentCount: number
    ) {
        super(filePath, vscode.TreeItemCollapsibleState.Collapsed);
        this.description = `${commentCount} comment${commentCount !== 1 ? 's' : ''}`;
        this.iconPath = new vscode.ThemeIcon('file');
        this.contextValue = 'file';
        this.tooltip = `${filePath}\n${commentCount} comment${commentCount !== 1 ? 's' : ''} in ${threads.length} thread${threads.length !== 1 ? 's' : ''}`;
    }
}

export class ThreadItem extends vscode.TreeItem {
    constructor(
        public readonly thread: CommentThread,
        public readonly filePath: string
    ) {
        super(
            `Line ${thread.line}: ${thread.rootComment.user}`,
            thread.replies.length > 0 
                ? vscode.TreeItemCollapsibleState.Collapsed 
                : vscode.TreeItemCollapsibleState.None
        );
        
        const replyCount = thread.replies.length;
        this.description = replyCount > 0 
            ? `${replyCount} repl${replyCount !== 1 ? 'ies' : 'y'}` 
            : '';
        
        this.iconPath = thread.resolved 
            ? new vscode.ThemeIcon('check', new vscode.ThemeColor('testing.iconPassed'))
            : new vscode.ThemeIcon('comment-discussion');
        
        this.contextValue = thread.resolved ? 'thread-resolved' : 'thread';
        this.tooltip = this.createTooltip();
        
        // Command to go to the line
        this.command = {
            command: 'pr-comments.goToComment',
            title: 'Go to Comment',
            arguments: [filePath, thread.line]
        };
    }

    private createTooltip(): vscode.MarkdownString {
        const md = new vscode.MarkdownString();
        md.isTrusted = false;
        md.appendMarkdown(`**@${this.thread.rootComment.user}**\n\n`);
        md.appendMarkdown(this.thread.rootComment.body.substring(0, 200));
        if (this.thread.rootComment.body.length > 200) {
            md.appendMarkdown('...');
        }
        return md;
    }
}

export class CommentItem extends vscode.TreeItem {
    constructor(
        public readonly comment: PRComment,
        public readonly filePath: string,
        public readonly isReply: boolean = false
    ) {
        super(
            `${isReply ? '↳ ' : ''}${comment.user}`,
            vscode.TreeItemCollapsibleState.None
        );
        
        this.description = this.formatDate(comment.createdAt);
        this.iconPath = new vscode.ThemeIcon('comment');
        this.contextValue = 'comment';
        this.tooltip = this.createTooltip();
        
        this.command = {
            command: 'pr-comments.goToComment',
            title: 'Go to Comment',
            arguments: [filePath, comment.line]
        };
    }

    private formatDate(dateStr?: string): string {
        if (!dateStr) return '';
        const date = new Date(dateStr);
        return date.toLocaleDateString();
    }

    private createTooltip(): vscode.MarkdownString {
        const md = new vscode.MarkdownString();
        md.isTrusted = false;
        md.appendMarkdown(`**@${this.comment.user}**`);
        if (this.comment.createdAt) {
            const date = new Date(this.comment.createdAt);
            md.appendMarkdown(` • ${date.toLocaleString()}`);
        }
        md.appendMarkdown('\n\n---\n\n');
        md.appendMarkdown(this.comment.body);
        return md;
    }
}

export class CommentTreeProvider implements vscode.TreeDataProvider<CommentTreeItem> {
    private _onDidChangeTreeData = new vscode.EventEmitter<CommentTreeItem | undefined | null | void>();
    readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

    private threads: Map<string, CommentThread[]> = new Map();
    private filterOptions: FilterOptions = {};
    private reviewers: Set<string> = new Set();

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    setComments(commentsByFile: Map<string, PRComment[]>): void {
        this.threads.clear();
        this.reviewers.clear();

        for (const [filePath, comments] of commentsByFile) {
            const fileThreads = this.buildThreads(comments);
            this.threads.set(filePath, fileThreads);
            
            // Collect reviewers
            for (const comment of comments) {
                this.reviewers.add(comment.user);
            }
        }

        this.refresh();
    }

    private buildThreads(comments: PRComment[]): CommentThread[] {
        const threadMap = new Map<number, CommentThread>();
        const replyMap = new Map<number, PRComment[]>();

        // First pass: identify root comments and collect replies
        for (const comment of comments) {
            if (comment.inReplyToId) {
                const replies = replyMap.get(comment.inReplyToId) || [];
                replies.push(comment);
                replyMap.set(comment.inReplyToId, replies);
            } else {
                threadMap.set(comment.id, {
                    id: comment.id,
                    path: comment.path,
                    line: comment.line,
                    rootComment: comment,
                    replies: [],
                    resolved: comment.resolved || false,
                    participants: [comment.user]
                });
            }
        }

        // Second pass: attach replies to threads
        for (const [rootId, replies] of replyMap) {
            const thread = threadMap.get(rootId);
            if (thread) {
                thread.replies = replies.sort((a, b) => 
                    new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime()
                );
                // Add reply authors to participants
                for (const reply of replies) {
                    if (!thread.participants.includes(reply.user)) {
                        thread.participants.push(reply.user);
                    }
                }
            }
        }

        // Sort threads by line number
        return Array.from(threadMap.values()).sort((a, b) => a.line - b.line);
    }

    setFilter(options: FilterOptions): void {
        this.filterOptions = options;
        this.refresh();
    }

    clearFilter(): void {
        this.filterOptions = {};
        this.refresh();
    }

    getReviewers(): string[] {
        return Array.from(this.reviewers).sort();
    }

    getTreeItem(element: CommentTreeItem): vscode.TreeItem {
        return element;
    }

    getChildren(element?: CommentTreeItem): Thenable<CommentTreeItem[]> {
        if (!element) {
            // Root level: show files
            return Promise.resolve(this.getFileItems());
        }

        if (element instanceof FileItem) {
            // File level: show threads
            return Promise.resolve(this.getThreadItems(element));
        }

        if (element instanceof ThreadItem) {
            // Thread level: show replies
            return Promise.resolve(this.getCommentItems(element));
        }

        return Promise.resolve([]);
    }

    private getFileItems(): FileItem[] {
        const items: FileItem[] = [];

        for (const [filePath, fileThreads] of this.threads) {
            const filteredThreads = this.filterThreads(fileThreads);
            
            if (filteredThreads.length === 0) continue;
            
            // Apply file filter
            if (this.filterOptions.file && !filePath.includes(this.filterOptions.file)) {
                continue;
            }

            const commentCount = filteredThreads.reduce(
                (sum, t) => sum + 1 + t.replies.length, 
                0
            );

            items.push(new FileItem(filePath, filteredThreads, commentCount));
        }

        return items.sort((a, b) => a.filePath.localeCompare(b.filePath));
    }

    private getThreadItems(fileItem: FileItem): ThreadItem[] {
        const filteredThreads = this.filterThreads(fileItem.threads);
        return filteredThreads.map(thread => new ThreadItem(thread, fileItem.filePath));
    }

    private getCommentItems(threadItem: ThreadItem): CommentItem[] {
        const items: CommentItem[] = [];
        
        // Add root comment
        items.push(new CommentItem(threadItem.thread.rootComment, threadItem.filePath, false));
        
        // Add replies
        for (const reply of threadItem.thread.replies) {
            items.push(new CommentItem(reply, threadItem.filePath, true));
        }

        return items;
    }

    private filterThreads(threads: CommentThread[]): CommentThread[] {
        return threads.filter(thread => {
            // Filter by reviewer
            if (this.filterOptions.reviewer) {
                const hasReviewer = thread.participants.includes(this.filterOptions.reviewer);
                if (!hasReviewer) return false;
            }

            // Filter by resolved status
            if (this.filterOptions.resolved !== undefined) {
                if (thread.resolved !== this.filterOptions.resolved) return false;
            }

            return true;
        });
    }

    getParent(_element: CommentTreeItem): vscode.ProviderResult<CommentTreeItem> {
        // Not implementing parent navigation for now
        return null;
    }

    getTotalCommentCount(): number {
        let count = 0;
        for (const threads of this.threads.values()) {
            for (const thread of threads) {
                count += 1 + thread.replies.length;
            }
        }
        return count;
    }

    getThreadCount(): number {
        let count = 0;
        for (const threads of this.threads.values()) {
            count += threads.length;
        }
        return count;
    }
}

// Singleton instance
let treeProvider: CommentTreeProvider | undefined;

export function getCommentTreeProvider(): CommentTreeProvider {
    if (!treeProvider) {
        treeProvider = new CommentTreeProvider();
    }
    return treeProvider;
}

export function disposeCommentTreeProvider(): void {
    treeProvider = undefined;
}
