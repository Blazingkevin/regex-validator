import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JobRepository } from '../repositories/job.repository';
import { Job, JobStatus } from '../schemas/job.schema';
// import { RedisService } from '../../redis/redis.service';
import { Worker } from 'worker_threads';
import * as path from 'path';
import * as fs from 'fs';
import { RedisService } from 'src/redis/redis.service';

@Injectable()
export class JobProcessorService {
    private readonly logger = new Logger(JobProcessorService.name);
    private readonly regexTimeoutMs: number;

    constructor(
        private jobRepository: JobRepository,
        private redisService: RedisService,
        private configService: ConfigService,
    ) {
        this.regexTimeoutMs = this.configService.get<number>('REGEX_TIMEOUT_MS', 3000);
        this.ensureWorkerFileExists();
    }

    // Ensure the worker file exists - create it if needed
    private ensureWorkerFileExists() {
        const workerContent = `
            const { parentPort, workerData } = require('worker_threads');

            try {
                const { pattern, input } = workerData;
                const regex = new RegExp(pattern);
                const isMatch = regex.test(input);
                
                parentPort.postMessage({ isMatch });
            } catch (error) {
                parentPort.postMessage({ 
                    isMatch: false, 
                    error: \`Regex error: \${error.message}\` 
                });
            }
        `;

        const workerDir = path.resolve(__dirname, '../workers');
        const workerPath = path.resolve(workerDir, 'regex-worker.js');

        // Create directory if it doesn't exist
        if (!fs.existsSync(workerDir)) {
            fs.mkdirSync(workerDir, { recursive: true });
        }

        // Create worker file if it doesn't exist
        if (!fs.existsSync(workerPath)) {
            fs.writeFileSync(workerPath, workerContent);
        }
    }

    async processJob(job: Job): Promise<Job | null> {
        try {
            this.logger.log(`Processing job ${job.id}`);

            // Update job status to VALIDATING and notify clients
            await this.jobRepository.updateStatus(job.id, JobStatus.VALIDATING);
            await this.redisService.publishJobUpdate(job.id, {
                status: JobStatus.VALIDATING,
            });

            // Artificial delay as specified in requirements
            const delay = this.configService.get<number>('PROCESSING_DELAY_MS');
            await new Promise(resolve => setTimeout(resolve, delay));

            // Safely validate the regex
            const result = await this.safeRegexMatch(job.pattern, job.input);

            // Update status based on result
            const newStatus = result.isMatch ? JobStatus.VALID : JobStatus.INVALID;

            this.logger.log(`Job ${job.id} validation result: ${newStatus}`);

            const updatedJob = await this.jobRepository.updateStatus(
                job.id,
                newStatus,
                result.error,
            );

            // Publish update to Redis
            await this.redisService.publishJobUpdate(job.id, {
                status: newStatus,
                message: result.error,
            });

            return updatedJob;
        } catch (error) {
            this.logger.error(`Error processing job ${job.id}: ${error.message}`, error.stack);

            // Update job status to FAILED
            const failedJob = await this.jobRepository.updateStatus(
                job.id,
                JobStatus.FAILED,
                `Processing error: ${error.message}`,
            );

            // Publish failure to Redis
            await this.redisService.publishJobUpdate(job.id, {
                status: JobStatus.FAILED,
                message: `Processing error: ${error.message}`,
            });

            return failedJob;
        }
    }

    /**
     * Safely run regex matching in a separate worker thread with timeout
     * This protects against catastrophic backtracking
     */
    private async safeRegexMatch(
        pattern: string,
        input: string,
    ): Promise<{ isMatch: boolean; error?: string }> {
        return new Promise((resolve) => {
            try {
                const workerPath = path.resolve(__dirname, '../workers/regex-worker.js');

                // create worker with input data
                const worker = new Worker(workerPath, {
                    workerData: { pattern, input },
                });

                // timeout to prevent hanging on catastrophic backtracking
                const timeout = setTimeout(() => {
                    worker.terminate();
                    this.logger.warn(`Regex processing timed out after ${this.regexTimeoutMs}ms`);
                    resolve({ isMatch: false, error: 'Regex processing timed out' });
                }, this.regexTimeoutMs);

                // hsndle successful result
                worker.on('message', (result) => {
                    clearTimeout(timeout);
                    resolve(result);
                });

                // hndle error from worker
                worker.on('error', (err) => {
                    clearTimeout(timeout);
                    this.logger.error(`Worker error: ${err.message}`, err.stack);
                    resolve({ isMatch: false, error: `Worker error: ${err.message}` });
                });

                // Handle case of unusual exit
                worker.on('exit', (code) => {
                    if (code !== 0) {
                        clearTimeout(timeout);
                        this.logger.error(`Worker exited with code ${code}`);
                        resolve({ isMatch: false, error: `Worker exited with code ${code}` });
                    }
                });
            } catch (error) {
                this.logger.error(`Error setting up regex worker: ${error.message}`, error.stack);
                resolve({ isMatch: false, error: `Setup error: ${error.message}` });
            }
        });
    }
}