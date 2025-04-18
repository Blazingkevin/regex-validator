import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JobRepository } from '../repositories/job.repository';
import { Job, JobStatus } from '../schemas/job.schema';
import { CreateJobDto } from '../dto/create-job.dto';
import { KafkaProducerService } from '../../kafka/kafka-producer.service';
import { RedisService } from '../../redis/redis.service';

@Injectable()
export class JobService {
    private readonly logger = new Logger(JobService.name);

    constructor(
        private jobRepository: JobRepository,
        private kafkaProducer: KafkaProducerService,
        private redisService: RedisService,
        private configService: ConfigService,
    ) { }

    async createJob(createJobDto: CreateJobDto): Promise<Job> {
        try {
            // fetch regex pattern from config
            const pattern = this.configService.get<string>('REGEX_PATTERN');
            this.logger.log(`Creating job with pattern: ${pattern}`);

            // dreate job in database with PENDING status
            const job = await this.jobRepository.create(createJobDto.input, pattern!);
            this.logger.log(`Created job with ID: ${job.id}`);

            try {
                // Publish to Kafka for processing
                await this.kafkaProducer.sendJobForProcessing(job);
                this.logger.log(`Job ${job.id} sent to Kafka for processing`);

                // Update status to VALIDATING
                const updatedJob = await this.jobRepository.updateStatus(
                    job.id,
                    JobStatus.VALIDATING,
                );

                // Notify clients of the status change
                await this.redisService.publishJobUpdate(job.id, {
                    status: JobStatus.VALIDATING,
                });

                return updatedJob || job;
            } catch (kafkaError) {
                // if Kafka publish fails
                this.logger.error(
                    `Failed to send job ${job.id} to Kafka: ${kafkaError.message}`,
                    kafkaError.stack,
                );

                // Update job status to FAILED
                const failedJob = await this.jobRepository.updateStatus(
                    job.id,
                    JobStatus.FAILED,
                    'Failed to queue job for processing',
                );

                // Notify clients of the failure
                await this.redisService.publishJobUpdate(job.id, {
                    status: JobStatus.FAILED,
                    message: 'Failed to queue job for processing',
                });

                throw kafkaError;
            }
        } catch (error) {
            this.logger.error(`Job creation failed: ${error.message}`, error.stack);
            throw error;
        }
    }

    async getAllJobs(): Promise<Job[]> {
        return this.jobRepository.findAll();
    }

    async getJobById(id: string): Promise<Job | null> {
        return this.jobRepository.findById(id);
    }
} 