import { Injectable, CanActivate, ExecutionContext, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { Observable } from 'rxjs';

@Injectable()
export class RateLimitGuard implements CanActivate {
    private readonly logger = new Logger(RateLimitGuard.name);
    private requestMap = new Map<string, number[]>();
    private readonly requestLimit = 10;
    private readonly timeWindow = 60000;

    canActivate(
        context: ExecutionContext,
    ): boolean | Promise<boolean> | Observable<boolean> {
        const request = context.switchToHttp().getRequest();
        const clientId = request.ip || 'unknown-client';

        const now = Date.now();
        const requestTimes = this.requestMap.get(clientId) || [];

        // keep requests from within the time window
        const recentRequests = requestTimes.filter(time => now - time < this.timeWindow);

        if (recentRequests.length >= this.requestLimit) {
            this.logger.warn(`Rate limit exceeded for client ${clientId}`);
            throw new HttpException(
                'Too many requests, please try again later',
                HttpStatus.TOO_MANY_REQUESTS
            );
        }

        // Add current request and update the map
        recentRequests.push(now);
        this.requestMap.set(clientId, recentRequests);

        return true;
    }
}