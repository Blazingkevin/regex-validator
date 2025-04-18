// src/jobs/consumers/job-consumer.service.ts
import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Consumer, Kafka, KafkaMessage } from 'kafkajs';
import { JobProcessorService } from '../services/job-processor.service';
import { JobRepository } from '../repositories/job.repository';
import { JobStatus } from '../schemas/job.schema';
import { KafkaProducerService } from '../../kafka/kafka-producer.service';
import { RetryService } from '../../common/services/retry.service';

@Injectable()
export class JobConsumerService implements OnModuleInit {
    private readonly logger = new Logger(JobConsumerService.name);
    private consumer: Consumer;
    private readonly maxJobAttempts: number;

    constructor(
        private configService: ConfigService,
        private jobProcessor: JobProcessorService,
        private jobRepository: JobRepository,
        private kafkaProducer: KafkaProducerService,
        private retryService: RetryService,
    ) {
        this.maxJobAttempts = this.configService.get<number>('MAX_JOB_ATTEMPTS', 3);

        const kafka = new Kafka({
            clientId: 'regex-validator-consumer',
            brokers: this.configService.get<string>('KAFKA_BROKERS')!.split(','),
        });

        this.consumer = kafka.consumer({
            groupId: 'regex-validator-group',
            retry: {
                initialRetryTime: 100,
                retries: 8
            }
        });
    }

    async onModuleInit() {
        try {
            await this.retryService.withRetry('kafka-consumer-connect', async () => {
                await this.consumer.connect();
                this.logger.log('Kafka consumer connected');
            }, {
                maxRetries: 5,
                baseDelayMs: 1000,
            });

            await this.retryService.withRetry('kafka-consumer-subscribe', async () => {
                await this.consumer.subscribe({
                    topic: 'regex-validation-jobs',
                    fromBeginning: false,
                });
                this.logger.log('Subscribed to regex-validation-jobs topic');
            });

            await this.consumer.run({
                eachMessage: async ({ topic, partition, message }) => {
                    try {
                        const messageId = message.key?.toString() || 'unknown';
                        this.logger.log(`Processing message ${messageId} from partition ${partition}`);

                        const jobData = JSON.parse(message.value?.toString() || '{}');
                        await this.processJobMessage(jobData);
                    } catch (error) {
                        this.logger.error(
                            `Error processing Kafka message: ${error.message}`,
                            error.stack,
                        );
                    }
                },
            });

            this.logger.log('Kafka consumer started');

            // Check for stale jobs on startup (jobs that might have been interrupted
            // during previous shutdown)
            await this.recoverStaleJobs();
        } catch (error) {
            this.logger.error(
                `Failed to initialize Kafka consumer: ${error.message}`,
                error.stack,
            );
            throw error;
        }
    }

    private async processJobMessage(jobData: any) {
        if (!jobData || !jobData.id) {
            this.logger.warn('Received invalid job data without ID');
            return;
        }

        try {
            // Check if job exists and is not already processed
            const job = await this.jobRepository.findById(jobData.id);

            if (!job) {
                this.logger.warn(`Job ${jobData.id} not found in database`);
                return;
            }

            // Skip already completed jobs
            if (
                job.status === JobStatus.VALID ||
                job.status === JobStatus.INVALID ||
                job.status === JobStatus.FAILED
            ) {
                this.logger.warn(
                    `Job ${job.id} already processed with status ${job.status}, skipping`,
                );
                return;
            }

            // Process the job
            await this.jobProcessor.processJob(job);
        } catch (error) {
            this.logger.error(
                `Failed to process job ${jobData.id}: ${error.message}`,
                error.stack,
            );

            // Attempt to move to DLQ if processing fails
            await this.moveToDeadLetterQueue(jobData);

            // Update job status to failed
            try {
                await this.jobRepository.updateStatus(
                    jobData.id,
                    JobStatus.FAILED,
                    `Processing error: ${error.message}`
                );
            } catch (updateError) {
                this.logger.error(
                    `Failed to update job status after error: ${updateError.message}`,
                    updateError.stack
                );
            }
        }
    }

    private async moveToDeadLetterQueue(jobData: any) {
        try {
            await this.retryService.withRetry('move-to-dlq', async () => {
                await this.kafkaProducer.send(
                    'regex-validation-jobs-dlq',
                    jobData.id,
                    {
                        ...jobData,
                        error: 'Moved to DLQ after processing failure',
                        movedToDlqAt: new Date().toISOString(),
                    }
                );
            });
            this.logger.log(`Job ${jobData.id} moved to Dead Letter Queue`);
        } catch (error) {
            this.logger.error(`Failed to move job ${jobData.id} to DLQ: ${error.message}`, error.stack);
        }
    }

    private async recoverStaleJobs() {
        try {
            // Find jobs that have been stuck in VALIDATING for more than 5 minutes
            const staleJobs = await this.jobRepository.findStaleValidatingJobs(5);

            this.logger.log(`Found ${staleJobs.length} stale jobs to recover`);

            for (const job of staleJobs) {
                // Increment attempt count
                const updatedJob = await this.jobRepository.incrementAttempt(job.id);

                if (!updatedJob) {
                    this.logger.warn(`Failed to increment attempt for stale job ${job.id}`);
                    continue;
                }

                if (updatedJob.attempts >= this.maxJobAttempts) {
                    // If max attempts reached, mark as failed
                    await this.jobRepository.updateStatus(
                        job.id,
                        JobStatus.FAILED,
                        'Max retry attempts reached',
                    );

                    this.logger.warn(`Job ${job.id} failed after ${updatedJob.attempts} attempts`);
                } else {
                    // Otherwise, requeue the job for processing
                    this.logger.log(`Requeuing stale job ${job.id} (attempt ${updatedJob.attempts})`);
                    await this.kafkaProducer.sendJobForProcessing(updatedJob);
                }
            }
        } catch (error) {
            this.logger.error(
                `Failed to recover stale jobs: ${error.message}`,
                error.stack,
            );
        }
    }
}