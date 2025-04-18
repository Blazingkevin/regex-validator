import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Job, JobDocument, JobStatus } from '../schemas/job.schema';
import { v4 as uuidv4 } from 'uuid';
import { CircuitBreakerService } from '../../common/services/circuit-breaker.service';
import { RetryService } from '../../common/services/retry.service';

@Injectable()
export class JobRepository {
    private readonly logger = new Logger(JobRepository.name);

    constructor(
        @InjectModel(Job.name) private jobModel: Model<JobDocument>,
        private circuitBreaker: CircuitBreakerService,
        private retryService: RetryService,
    ) { }

    async create(input: string, pattern: string): Promise<Job> {
        return this.circuitBreaker.execute('mongodb-create', async () => {
            return this.retryService.withRetry('create-job', async () => {
                const job = new this.jobModel({
                    id: uuidv4(),
                    input,
                    pattern,
                    status: JobStatus.PENDING,
                    attempts: 0,
                    version: 0,
                    createdAt: new Date(),
                });

                return await job.save();
            });
        });
    }

    async updateStatus(
        jobId: string,
        status: JobStatus,
        message?: string,
    ): Promise<Job | null> {
        return this.circuitBreaker.execute('mongodb-update', async () => {
            return this.retryService.withRetry('update-job-status', async () => {
                return this.jobModel.findOneAndUpdate(
                    { id: jobId },
                    {
                        $set: { status, message, updatedAt: new Date() },
                        $inc: { version: 1 },
                    },
                    { new: true },
                ).exec();
            });
        });
    }

    async incrementAttempt(jobId: string): Promise<Job | null> {
        return this.circuitBreaker.execute('mongodb-update', async () => {
            return this.retryService.withRetry('increment-job-attempt', async () => {
                return this.jobModel.findOneAndUpdate(
                    { id: jobId },
                    { $inc: { attempts: 1, version: 1 } },
                    { new: true },
                ).exec();
            });
        });
    }

    async findById(jobId: string): Promise<Job | null> {
        return this.circuitBreaker.execute('mongodb-find', async () => {
            return this.retryService.withRetry('find-job-by-id', async () => {
                return this.jobModel.findOne({ id: jobId }).exec();
            });
        });
    }

    async findAll(): Promise<Job[]> {
        return this.circuitBreaker.execute('mongodb-find-all', async () => {
            return this.retryService.withRetry('find-all-jobs', async () => {
                return this.jobModel.find().sort({ createdAt: -1 }).exec();
            });
        });
    }

    async findStaleValidatingJobs(minutesOld: number): Promise<Job[]> {
        return this.circuitBreaker.execute('mongodb-find-stale', async () => {
            return this.retryService.withRetry('find-stale-jobs', async () => {
                const cutoffTime = new Date();
                cutoffTime.setMinutes(cutoffTime.getMinutes() - minutesOld);

                return this.jobModel.find({
                    status: JobStatus.VALIDATING,
                    updatedAt: { $lt: cutoffTime },
                }).exec();
            });
        });
    }
}