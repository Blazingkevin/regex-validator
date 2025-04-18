import { Module, Global } from '@nestjs/common';
import { CircuitBreakerService } from './services/circuit-breaker.service';
import { RetryService } from './services/retry.service';
import { RateLimitGuard } from './guards/rate-limit.guard';

@Global()
@Module({
    providers: [CircuitBreakerService, RetryService, RateLimitGuard],
    exports: [CircuitBreakerService, RetryService, RateLimitGuard],
})
export class CommonModule { }