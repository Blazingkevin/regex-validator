export enum JobStatus {
    PENDING = 'PENDING',
    VALIDATING = 'VALIDATING',
    VALID = 'VALID',
    INVALID = 'INVALID',
    FAILED = 'FAILED',
}

export interface Job {
    id: string;
    input: string;
    pattern: string;
    status: JobStatus;
    message?: string;
    attempts: number;
    version: number;
    createdAt: string;
    updatedAt: string;
}

export interface CreateJobRequest {
    input: string;
}

export interface JobUpdate {
    jobId: string;
    status: JobStatus;
    message?: string;
    timestamp?: string;
}

export interface Toast {
    id: number;
    message: string;
    type: 'success' | 'error' | 'warning' | 'info';
}

export type ConnectionState = 'connected' | 'connecting' | 'disconnected';