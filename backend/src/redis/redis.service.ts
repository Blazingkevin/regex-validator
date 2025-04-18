import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config'
import { createClient, RedisClientType } from 'redis'
import { RetryService } from '../common/services/retry.service'
import { CircuitBreakerService } from '../common/services/circuit-breaker.service'

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client: RedisClientType;
  private publisher: RedisClientType;

  constructor(
    private configService: ConfigService,
    private retryService: RetryService,
    private circuitBreaker: CircuitBreakerService,
  ) {}

  async onModuleInit() {
    try {
      const redisUrl = this.configService.get<string>('REDIS_URL');
      
      await this.retryService.withRetry('redis-connect', async () => {
        this.client = createClient({ url: redisUrl });
        this.publisher = this.client.duplicate();
        
        await this.client.connect();
        await this.publisher.connect();
      });
      
      this.logger.log('Redis client connected');
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

  async publishJobUpdate(jobId: string, data: any) {
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
        
        // Also publish to global updates channel
        await this.publisher.publish('job-updates', JSON.stringify(jobData));
        
        this.logger.debug(`Published update for job ${jobId}: ${JSON.stringify(data)}`);
      });
    });
  }

  async subscribe(channel: string, callback: (message: string) => void) {
    try {
      const subscriber = this.client.duplicate();
      await subscriber.connect();
      
      await subscriber.subscribe(channel, (message) => {
        try {
          callback(message);
        } catch (error) {
          this.logger.error(`Error in Redis subscription callback: ${error.message}`, error.stack);
        }
      });
      
      this.logger.log(`Subscribed to Redis channel: ${channel}`);
      
      // Return unsubscribe function
      return async () => {
        await subscriber.unsubscribe(channel);
        await subscriber.quit();
      };
    } catch (error) {
      this.logger.error(`Failed to subscribe to Redis channel ${channel}: ${error.message}`, error.stack);
      throw error;
    }
  }

  async set(key: string, value: any, ttl?: number) {
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
    return this.circuitBreaker.execute('redis-get', async () => {
      return this.retryService.withRetry('redis-get-value', async () => {
        return this.client.get(key);
      });
    });
  }

  async delete(key: string) {
    return this.circuitBreaker.execute('redis-delete', async () => {
      return this.retryService.withRetry('redis-delete-key', async () => {
        return this.client.del(key);
      });
    });
  }
}

