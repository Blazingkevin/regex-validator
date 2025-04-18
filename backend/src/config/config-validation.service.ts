import { Injectable } from '@nestjs/common';
import { plainToClass } from 'class-transformer';
import { IsString, IsNumber, Min, validateSync, IsOptional } from 'class-validator';

export class EnvironmentVariables {
    @IsString()
    REGEX_PATTERN: string;

    @IsNumber()
    @Min(0)
    PROCESSING_DELAY_MS: number;

    @IsString()
    MONGODB_URI: string;

    @IsString()
    KAFKA_BROKERS: string;

    @IsString()
    REDIS_URL: string;

    @IsNumber()
    @Min(1)
    MAX_JOB_ATTEMPTS: number;

    @IsNumber()
    @Min(1000)
    @IsOptional()
    REGEX_TIMEOUT_MS: number = 3000;

    @IsNumber()
    @Min(1)
    @IsOptional()
    CIRCUIT_BREAKER_THRESHOLD: number = 3;

    @IsNumber()
    @Min(1000)
    @IsOptional()
    CIRCUIT_BREAKER_RESET_TIMEOUT: number = 30000;
}

@Injectable()
export class ConfigValidationService {
    static validate(config: Record<string, unknown>) {
        const validatedConfig = plainToClass(
            EnvironmentVariables,
            config,
            { enableImplicitConversion: true },
        );

        const errors = validateSync(validatedConfig, { skipMissingProperties: false });

        if (errors.length > 0) {
            throw new Error(`Config validation error: ${errors.toString()}`);
        }


        // rexgex could be invalid, check to be sure it is valid since without a valid regex the application will not work
        try {
            new RegExp(validatedConfig.REGEX_PATTERN);
        } catch (error) {
            throw new Error(`Invalid REGEX_PATTERN: ${error.message}`);
        }

        return validatedConfig;
    }
}