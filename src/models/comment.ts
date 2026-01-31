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
