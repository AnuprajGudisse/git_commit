export interface PRComment {
    path: string;
    line: number;
    body: string;
    user: string;
    id: number;
    createdAt?: string;
    updatedAt?: string;
    inReplyToId?: number;
    resolved?: boolean;
    // For threading support
    replies?: PRComment[];
    diffHunk?: string;
    commitId?: string;
    // For filtering
    authorAssociation?: string;
}

export interface CommentThread {
    id: number;
    path: string;
    line: number;
    rootComment: PRComment;
    replies: PRComment[];
    resolved: boolean;
    participants: string[];
}

export interface RepositoryInfo {
    owner: string;
    repo: string;
    prNumber: number | null;
}

export interface FetchResult {
    success: boolean;
    comments: PRComment[];
    error?: string;
    rateLimitRemaining?: number;
    rateLimitReset?: Date;
}

export interface ReplyResult {
    success: boolean;
    comment?: PRComment;
    error?: string;
}

export interface FilterOptions {
    reviewer?: string;
    resolved?: boolean;
    file?: string;
}
