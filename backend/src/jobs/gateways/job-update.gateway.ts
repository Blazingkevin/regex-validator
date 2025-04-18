// src/jobs/gateways/job-update.gateway.ts
import {
    WebSocketGateway,
    WebSocketServer,
    OnGatewayInit,
    OnGatewayConnection,
    OnGatewayDisconnect,
    SubscribeMessage,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { RedisService } from '../../redis/redis.service';
import { JobRepository } from '../repositories/job.repository';

@WebSocketGateway({
    cors: {
        origin: '*',
        methods: ['GET', 'POST'],
        credentials: true,
    },
})
export class JobUpdateGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
    @WebSocketServer() server: Server;
    private readonly logger = new Logger(JobUpdateGateway.name);
    private redisUnsubscribe: (() => Promise<void>) | null = null;
    private clientCount = 0;

    constructor(
        private redisService: RedisService,
        private jobRepository: JobRepository,
    ) { }

    async afterInit() {
        try {
        
            this.redisUnsubscribe = await this.redisService.subscribe('job-updates', (message) => {
                try {
                    const jobUpdate = JSON.parse(message);
                    this.server.emit('jobUpdate', jobUpdate);
                    this.logger.debug(`Broadcasted job update for job ${jobUpdate.jobId}`);
                } catch (error) {
                    this.logger.error(`Error parsing Redis message: ${error.message}`, error.stack);
                }
            });

            this.logger.log('WebSocket gateway initialized');
        } catch (error) {
            this.logger.error(`Failed to initialize WebSocket gateway: ${error.message}`, error.stack);
        }
    }

    async handleConnection(client: Socket) {
        this.clientCount++;
        this.logger.log(`Client connected: ${client.id}, total clients: ${this.clientCount}`);

        // Attach event listeners for client
        client.on('error', (error) => {
            this.logger.error(`Socket error for client ${client.id}: ${error.message}`);
        });
    }

    async handleDisconnect(client: Socket) {
        this.clientCount--;
        this.logger.log(`Client disconnected: ${client.id}, remaining clients: ${this.clientCount}`);
    }

    @SubscribeMessage('SYNC_JOBS')
    async handleSyncJobs(client: Socket, payload: any) {
        try {
            this.logger.log(`Client ${client.id} requested job sync`);

            // Fetch all jobs from repository
            const jobs = await this.jobRepository.findAll();

            // Send jobs to the requesting client
            client.emit('jobsSync', jobs);

            this.logger.log(`Sent ${jobs.length} jobs to client ${client.id}`);
        } catch (error) {
            this.logger.error(`Error handling SYNC_JOBS: ${error.message}`, error.stack);
            client.emit('error', { message: 'Failed to sync jobs' });
        }
    }

    @SubscribeMessage('SUBSCRIBE_JOB')
    async handleSubscribeToJob(client: Socket, jobId: string) {
        try {
            this.logger.log(`Client ${client.id} subscribed to job ${jobId}`);

            // Join the job-specific room
            client.join(`job:${jobId}`);

            // Fetch current job state
            const job = await this.jobRepository.findById(jobId);

            if (job) {
                client.emit('jobDetail', job);
            } else {
                client.emit('error', { message: `Job ${jobId} not found` });
            }
        } catch (error) {
            this.logger.error(`Error handling SUBSCRIBE_JOB: ${error.message}`, error.stack);
            client.emit('error', { message: 'Failed to subscribe to job' });
        }
    }

    @SubscribeMessage('UNSUBSCRIBE_JOB')
    handleUnsubscribeFromJob(client: Socket, jobId: string) {
        this.logger.log(`Client ${client.id} unsubscribed from job ${jobId}`);
        client.leave(`job:${jobId}`);
    }

    onModuleDestroy() {
        if (this.redisUnsubscribe) {
            this.redisUnsubscribe()
                .then(() => this.logger.log('Unsubscribed from Redis'))
                .catch(error => this.logger.error(`Error unsubscribing from Redis: ${error.message}`));
        }
    }
}