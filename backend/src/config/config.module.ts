import { Module } from '@nestjs/common';
import { ConfigModule as NestConfigModule } from '@nestjs/config';
import { ConfigValidationService } from './config-validation.service';

@Module({
    imports: [
        NestConfigModule.forRoot({
            validate: (config) => ConfigValidationService.validate(config),
            isGlobal: true,
        }),
    ],
    providers: [ConfigValidationService],
    exports: [ConfigValidationService],
})
export class ConfigModule { }