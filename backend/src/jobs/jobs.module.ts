import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { KafkaModule } from '../kafka/kafka.module';
import { RedisModule } from '../redis/redis.module';
import { Job, JobSchema } from './schemas/job.schema';
import { JobController } from './controllers/job.controller';
import { JobService } from './services/job.service';
import { JobRepository } from './repositories/job.repository';
import { JobProcessorService } from './services/job-processor.service';
import { JobConsumerService } from './consumers/job-consumer.service';
import { JobUpdateGateway } from './gateways/job-update.gateway';

@Module({
    imports: [
        MongooseModule.forFeature([{ name: Job.name, schema: JobSchema }]),
        KafkaModule,
        RedisModule,
    ],
    controllers: [JobController],
    providers: [
        JobService,
        JobRepository,
        JobProcessorService,
        JobConsumerService,
        JobUpdateGateway,
    ],
    exports: [JobService, JobRepository],
})
export class JobsModule { }