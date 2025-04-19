# Real-Time Regex Validator

## Purpose & Workflow

I built this distributed application to validate text strings against regular expressions in real-time. The workflow is simple but powerful:

1. A user submits a text string through the web interface
2. The system processes it asynchronously against a configurable regex pattern
3. The user sees real-time status updates as processing occurs
4. All job history is persisted and displayed

## Architecture Overview

This project uses a modern microservices architecture with several specialized components:

- **React Frontend**: TypeScript-based UI with real-time WebSocket updates
- **NestJS Backend**: RESTful API with asynchronous processing capabilities
- **MongoDB**: Persistent storage for all job data
- **Kafka**: Message queue for reliable asynchronous job processing
- **Redis**: Pub/Sub mechanism for real-time event broadcasting
- **Docker**: Containerization for consistent deployment

Each component has specific responsibilities:

- **Frontend**: User interaction, status display, and WebSocket communication
- **Backend API**: Job creation, validation, and orchestration
- **Backend Worker**: Async processing isolated from request handling
- **MongoDB**: Durable storage with transaction support
- **Kafka**: Reliable message delivery with replay capabilities
- **Redis**: Low-latency real-time event distribution

## Real-Time Update Mechanism

I implemented a robust real-time update system using:

1. **Redis Pub/Sub**: When a job status changes, the backend publishes an event to Redis channels
2. **WebSocket Gateway**: A NestJS gateway subscribes to Redis and forwards events to connected clients
3. **Socket.IO Client**: The frontend maintains a connection that receives these updates
4. **React Context**: Updates are immediately reflected in the UI through centralized state management

This creates a seamless experience where users see status changes instantly without page refreshes.

## Error Handling & Fault Tolerance

I built several layers of reliability into the system:

### Circuit Breaker Pattern
To prevent cascading failures, I implemented circuit breakers for external service calls. When a service repeatedly fails, the circuit "opens" to prevent further calls, automatically resetting after a configurable timeout.

### Retry Mechanism with Exponential Backoff
For retryable errors (network issues, timeouts), the system automatically retries operations with increasing delays between attempts.

### Dead Letter Queue
Failed Kafka messages that can't be processed are sent to a dedicated DLQ topic for later analysis or replay.

### Isolation of Regex Processing
To prevent catastrophic backtracking (a regex vulnerability), I implemented regex validation in separate worker threads with strict timeouts. This ensures that even problematic regex patterns won't crash the system.

### Transaction Management
Since traditional ACID transactions aren't available across distributed services, I implemented a saga-like pattern:
1. Job creation in MongoDB with initial PENDING status
2. Kafka message publication
3. Status update to VALIDATING
4. Compensating transactions if any step fails

### Stale Job Recovery
On system restart, the worker detects and recovers jobs that were interrupted during processing.

## Statelessness Considerations

While the backend aims to be stateless, there are some stateful aspects that could be improved:

1. **WebSocket Connections**: The Socket.IO gateway maintains connection state in-memory. In a multi-instance deployment, this would require sticky sessions or a shared connection store.

2. **Rate Limiting**: The current implementation stores rate limit counters in-memory. For true statelessness, this should use Redis or another distributed cache.

3. **Circuit Breaker State**: Circuit breaker states are maintained in-memory. In a scaled deployment, these states would not be shared across instances.

4. **Worker Thread Management**: Worker threads for regex processing are managed per-instance, which could lead to uneven resource utilization in a clustered deployment.

These limitations could be addressed by:

1. Implementing a Redis-based Socket.IO adapter for shared connection state
2. Moving rate limiting state to Redis
3. Centralizing circuit breaker state in a shared cache
4. Implementing a dedicated worker service with dynamic scaling

## Future Improvements

I've identified several areas where the system could be enhanced:

1. **Redis-Based Rate Limiting**: The current in-memory rate limiting implementation wouldn't work across multiple instances. A better approach would be to use Redis instead of an in-memory Map for storing rate limiting data.

2. **Unused WebSocket Features**: I implemented job-specific subscription capabilities in the backend (`SUBSCRIBE_JOB` and `UNSUBSCRIBE_JOB` handlers) that aren't currently used by the frontend. These could be utilized for more targeted job monitoring.

## Deployment & Scaling

### Cloud Deployment (AWS)

This system is designed for easy deployment on AWS:

- **Frontend**: Serve as static assets from S3 behind CloudFront CDN
- **Backend API**: Deploy on ECS Fargate with load balancing
- **Worker Processes**: Run on ECS with auto-scaling based on Kafka lag
- **MongoDB**: Use DocumentDB or MongoDB Atlas
- **Kafka**: Amazon MSK (Managed Streaming for Kafka)
- **Redis**: ElastiCache for Redis

### Scaling Considerations

- **Horizontal Scaling**: All components can scale horizontally for increased load
- **Statelessness**: API servers are mostly stateless, with the noted exceptions
- **Worker Pools**: Kafka consumer groups enable parallel processing
- **Persistence Layer**: MongoDB sharding for data distribution
- **Config Management**: Use AWS Parameter Store or Secrets Manager

## Running the Project

The entire application can be started with a single command:

```bash
docker compose up --build
```

I've also included a Makefile for convenience with several utility commands, though this is optional as the single command above is sufficient to start the entire system.

Use the included Makefile for common operations:

```bash
make start          # Start all containers
make stop           # Stop all containers
make logs           # View all logs
make logs-backend   # View backend logs only
make logs-frontend  # View frontend logs only
make status         # Check container status
make test-api       # Test API with a sample request
make restart        # Restart all containers
make clean          # Remove all containers and volumes
make start-detach   # Start application in detached mode
```

## Edge Cases Addressed

1. **Network Resilience**: Handles temporary network outages with retry mechanisms
2. **Service Outages**: Circuit breakers prevent cascading failures if dependencies fail
3. **Regex DoS**: Worker thread isolation with timeouts prevents server hangs
4. **Process Crashes**: Job status tracking ensures no work is lost during restarts
5. **WebSocket Reconnection**: Automatic reconnection with session recovery on the frontend
6. **Input Validation**: Frontend and backend validation prevents malicious inputs
7. **Rate Limiting**: Prevents API abuse with per-client rate limiting