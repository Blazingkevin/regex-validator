import { Module } from '@nestjs/common';
import { ConfigModule as NestConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule } from './config/config.module';
import { CommonModule } from './common/common.module';
import { JobsModule } from './jobs/jobs.module';
import { KafkaModule } from './kafka/kafka.module';
import { RedisModule } from './redis/redis.module';
import { ConfigService } from '@nestjs/config';

@Module({
  imports: [
    ConfigModule,
    NestConfigModule.forRoot({
      isGlobal: true,
    }),
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        uri: configService.get<string>('MONGODB_URI'),
        useNewUrlParser: true,
        useUnifiedTopology: true,
      }),
    }),
    CommonModule,
    JobsModule,
    KafkaModule,
    RedisModule,
  ],
})
export class AppModule {}