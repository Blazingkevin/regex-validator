import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, RedisClientType } from 'redis';
import { RetryService } from '../common/services/retry.service';
import { CircuitBreakerService } from '../common/services/circuit-breaker.service';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
    private readonly logger = new Logger(RedisService.name);
    private client: RedisClientType;
    private publisher: RedisClientType;
    private isReady = false;

    constructor(
        private configService: ConfigService,
        private retryService: RetryService,
        private circuitBreaker: CircuitBreakerService,
    ) { }

    async onModuleInit() {
        try {
            const redisUrl = this.configService.get<string>('REDIS_URL');
            this.logger.log(`Connecting to Redis at ${redisUrl}`);

            await this.retryService.withRetry('redis-connect', async () => {
                this.client = createClient({ url: redisUrl });

                this.client.on('error', (err) => this.logger.error(`Redis client error: ${err.message}`));
                this.client.on('connect', () => this.logger.debug('Redis client connected'));
                this.client.on('ready', () => {
                    this.logger.log('Redis client ready');
                    this.isReady = true;
                });


                this.publisher = this.client.duplicate();
                this.publisher.on('error', (err) => this.logger.error(`Redis publisher error: ${err.message}`));


                await this.client.connect();
                await this.publisher.connect();
            }, {
                maxRetries: 5,
                baseDelayMs: 1000,
            });

            this.logger.log('Redis client connected');
            this.isReady = true;
        } catch (error) {
            this.logger.error(`Failed to connect to Redis: ${error.message}`, error.stack);
            throw error;
        }
    }

    async onModuleDestroy() {
        try {
            if (this.client && this.client.isOpen) {
                await this.client.quit();
            }

            if (this.publisher && this.publisher.isOpen) {
                await this.publisher.quit();
            }

            this.logger.log('Redis connections closed');
        } catch (error) {
            this.logger.error(`Error closing Redis connections: ${error.message}`, error.stack);
        }
    }

    getClient(): RedisClientType {
        return this.client;
    }

    // Utility function to check if Redis is ready before any connection from any calling service
    async waitForReady(timeoutMs = 5000): Promise<boolean> {
        if (this.isReady) return true;

        return new Promise((resolve) => {
            const timeout = setTimeout(() => {
                this.logger.warn('Redis client ready timeout reached');
                resolve(false);
            }, timeoutMs);

            // do quick checks every 100ms if Redis is ready
            const interval = setInterval(() => {
                if (this.isReady) {
                    clearTimeout(timeout);
                    clearInterval(interval);
                    resolve(true);
                }
            }, 100);
        });
    }

    async publishJobUpdate(jobId: string, data: any) {
        await this.waitForReady();

        return this.circuitBreaker.execute('redis-publish', async () => {
            return this.retryService.withRetry('publish-job-update', async () => {
                const jobData = {
                    jobId,
                    ...data,
                    timestamp: new Date().toISOString(),
                };

                // Publish to job-specific channel
                const jobChannel = `job-updates:${jobId}`;
                await this.publisher.publish(jobChannel, JSON.stringify(jobData));

                // publish to global updates channel
                await this.publisher.publish('job-updates', JSON.stringify(jobData));

                this.logger.debug(`Published update for job ${jobId}: ${JSON.stringify(data)}`);
            });
        });
    }

    async subscribe(channel: string, callback: (message: string) => void) {
        await this.waitForReady();

        try {
            this.logger.log(`Creating subscription to channel: ${channel}`);

            const subscriber = this.client.duplicate();

            // error handling for the subscriber
            subscriber.on('error', (err) => {
                this.logger.error(`Redis subscriber error on channel ${channel}: ${err.message}`);
            });

            await subscriber.connect();
            this.logger.log(`Subscriber connected, subscribing to channel: ${channel}`);

            await subscriber.subscribe(channel, (message) => {
                try {
                    callback(message);
                } catch (error) {
                    this.logger.error(`Error in Redis subscription callback: ${error.message}`, error.stack);
                }
            });

            this.logger.log(`Successfully subscribed to Redis channel: ${channel}`);

            // Return a function that can be useed to subscribe
            return async () => {
                this.logger.log(`Unsubscribing from channel: ${channel}`);
                await subscriber.unsubscribe(channel);
                await subscriber.quit();
                this.logger.log(`Unsubscribed from channel: ${channel}`);
            };
        } catch (error) {
            this.logger.error(`Failed to subscribe to Redis channel ${channel}: ${error.message}`, error.stack);
            throw error;
        }
    }

    async set(key: string, value: any, ttl?: number) {
        await this.waitForReady();

        return this.circuitBreaker.execute('redis-set', async () => {
            return this.retryService.withRetry('redis-set-value', async () => {
                const stringValue = typeof value === 'string' ? value : JSON.stringify(value);

                if (ttl) {
                    await this.client.set(key, stringValue, { EX: ttl });
                } else {
                    await this.client.set(key, stringValue);
                }
            });
        });
    }

    async get(key: string) {
        await this.waitForReady();

        return this.circuitBreaker.execute('redis-get', async () => {
            return this.retryService.withRetry('redis-get-value', async () => {
                return this.client.get(key);
            });
        });
    }

    async delete(key: string) {
        await this.waitForReady();

        return this.circuitBreaker.execute('redis-delete', async () => {
            return this.retryService.withRetry('redis-delete-key', async () => {
                return this.client.del(key);
            });
        });
    }
}