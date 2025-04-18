// src/kafka/kafka-producer.service.ts
import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Kafka, Producer } from 'kafkajs';
import { Job } from '../jobs/schemas/job.schema';
import { RetryService } from '../common/services/retry.service';
import { CircuitBreakerService } from '../common/services/circuit-breaker.service';

@Injectable()
export class KafkaProducerService implements OnModuleInit, OnModuleDestroy {
    private readonly logger = new Logger(KafkaProducerService.name);
    private producer: Producer;

    constructor(
        private configService: ConfigService,
        private retryService: RetryService,
        private circuitBreaker: CircuitBreakerService,
    ) {
        const kafka = new Kafka({
            clientId: 'regex-validator-producer',
            brokers: this.configService.get<string>('KAFKA_BROKERS')!.split(','),
        });

        this.producer = kafka.producer({
            allowAutoTopicCreation: true,
            transactionalId: 'regex-validator-tx',
        });
    }

    async onModuleInit() {
        try {
            await this.retryService.withRetry('kafka-producer-connect', async () => {
                await this.producer.connect();
            }, {
                maxRetries: 5,
                baseDelayMs: 1000,
            });

            this.logger.log('Kafka producer connected');
        } catch (error) {
            this.logger.error(`Failed to connect Kafka producer: ${error.message}`, error.stack);
            throw error;
        }
    }

    async onModuleDestroy() {
        try {
            await this.producer.disconnect();
            this.logger.log('Kafka producer disconnected');
        } catch (error) {
            this.logger.error(`Error disconnecting Kafka producer: ${error.message}`, error.stack);
        }
    }

    async sendJobForProcessing(job: Job) {
        return this.circuitBreaker.execute('kafka-send', async () => {
            return this.retryService.withRetry('send-job-to-kafka', async () => {
                this.logger.log(`Sending job ${job.id} to Kafka`);

                await this.producer.send({
                    topic: 'regex-validation-jobs',
                    messages: [
                        {
                            key: job.id,
                            value: JSON.stringify(job),
                            headers: {
                                'source': 'regex-validator',
                                'timestamp': Date.now().toString(),
                            },
                        },
                    ],
                });

                this.logger.log(`Job ${job.id} sent to Kafka successfully`);
            });
        });
    }

    async send(topic: string, key: string, value: any) {
        return this.circuitBreaker.execute('kafka-send', async () => {
            return this.retryService.withRetry('send-to-kafka', async () => {
                await this.producer.send({
                    topic,
                    messages: [
                        {
                            key,
                            value: JSON.stringify(value),
                            headers: {
                                'source': 'regex-validator',
                                'timestamp': Date.now().toString(),
                            },
                        },
                    ],
                });
            });
        });
    }
}

