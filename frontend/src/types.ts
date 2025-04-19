export interface RegexJob {
  id: string;
  input: string;
  pattern: string;
  status: 'validating' | 'valid' | 'invalid';
  timestamp: number;
}

export interface SubmitJobResponse {
  jobId: string;
}