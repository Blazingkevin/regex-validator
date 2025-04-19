import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export type BreakerState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export interface CircuitBreakerOptions {
    failureThreshold: number;
    resetTimeout: number;
}

interface BreakerInfo {
    failureCount: number;
    lastFailureTime: number | null;
    state: BreakerState;
    options: CircuitBreakerOptions;
}

@Injectable()
export class CircuitBreakerService {
    private readonly logger = new Logger(CircuitBreakerService.name);
    private breakers = new Map<string, BreakerInfo>(); // in production setting, it should be kept in redis
    private defaultOptions: CircuitBreakerOptions;

    constructor(private configService: ConfigService) {
        this.defaultOptions = {
            failureThreshold: configService.get<number>('CIRCUIT_BREAKER_THRESHOLD', 3),
            resetTimeout: configService.get<number>('CIRCUIT_BREAKER_RESET_TIMEOUT', 30000),
        };
    }

    private getBreaker(serviceName: string): BreakerInfo {
        if (!this.breakers.has(serviceName)) {
            this.breakers.set(serviceName, {
                failureCount: 0,
                lastFailureTime: null,
                state: 'CLOSED',
                options: this.defaultOptions,
            });
        }
        return this.breakers.get(serviceName)!;
    }

    async execute<T>(serviceName: string, fn: () => Promise<T>): Promise<T> {
        const breaker = this.getBreaker(serviceName);

        if (breaker.state === 'OPEN') {
            // Check if circuit should go into HALF_OPEN state
            const now = Date.now();
            if (breaker.lastFailureTime && now - breaker.lastFailureTime > breaker.options.resetTimeout) {
                this.logger.log(`Circuit for ${serviceName} transitioning from OPEN to HALF_OPEN`);
                breaker.state = 'HALF_OPEN';
            } else {
                this.logger.warn(`Circuit for ${serviceName} is OPEN, rejecting request`);
                throw new Error(`Circuit is OPEN for ${serviceName}`);
            }
        }

        try {
            const result = await fn();

            // since the service function run without error, we should transition circuit state to CLOSED if it's HALF_OPEN
            if (breaker.state === 'HALF_OPEN') {
                this.logger.log(`Circuit for ${serviceName} transitioning from HALF_OPEN to CLOSED`);
                breaker.state = 'CLOSED';
                breaker.failureCount = 0;
            }

            return result;
        } catch (error) {
            // If the service function fails, we should increment the failure count
            // and possibly transition to OPEN state if the threshold is reached
            breaker.failureCount++;
            breaker.lastFailureTime = Date.now();

            if (breaker.failureCount >= breaker.options.failureThreshold) {
                this.logger.warn(
                    `Circuit for ${serviceName} transitioning to OPEN after ${breaker.failureCount} failures`
                );
                breaker.state = 'OPEN';
            }

            throw error;
        }
    }
}