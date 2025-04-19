import { Injectable, Logger } from '@nestjs/common';

export interface RetryOptions {
    maxRetries: number;
    baseDelayMs: number;
    isRetryable?: (error: Error) => boolean;
}

@Injectable()
export class RetryService {
    private readonly logger = new Logger(RetryService.name);

    // Simple network errors should be retryable
    private defaultIsRetryable(error: Error): boolean {
        // sample retryable messages
        // this was picked from the common error thrown by database and some third-party nodejs services
        // particular to solve issues that are common during application startup phase where a service might not be ready
        const retryableMessages = [
            'ECONNREFUSED', 'ETIMEDOUT', 'ECONNRESET', 'ENOTFOUND',
            'Connection refused', 'timeout', 'Timeout',
            'temporarily unavailable', 'Too many requests'
        ];

        return retryableMessages.some(msg => error.message.includes(msg));
    }

    async withRetry<T>(
        operation: string,
        fn: () => Promise<T>,
        options: RetryOptions = { maxRetries: 3, baseDelayMs: 1000 }
    ): Promise<T> {
        const { maxRetries, baseDelayMs, isRetryable = this.defaultIsRetryable } = options;
        let retries = 0;

        while (true) {
            try {
                return await fn();
            } catch (error) {
                retries++;

                if (retries > maxRetries || !isRetryable(error)) {
                    this.logger.error(
                        `Operation "${operation}" failed permanently after ${retries} attempts: ${error.message}`,
                        error.stack
                    );
                    throw error;
                }

                const delay = baseDelayMs * Math.pow(2, retries - 1);
                this.logger.warn(
                    `Operation "${operation}" failed (attempt ${retries}/${maxRetries}), retrying in ${delay}ms: ${error.message}`
                );

                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    }
}