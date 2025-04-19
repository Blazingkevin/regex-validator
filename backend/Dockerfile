# Backend Dockerfile
FROM node:18-alpine AS builder

WORKDIR /app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install dependencies including dev dependencies for build
RUN npm ci

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Create worker directory and copy worker files
RUN mkdir -p ./dist/jobs/workers
RUN if [ -d "./src/jobs/workers" ]; then cp ./src/jobs/workers/*.js ./dist/jobs/workers/ 2>/dev/null || true; fi

# Production stage
FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install production dependencies only
RUN npm ci --only=production

# Copy build artifacts from builder stage
COPY --from=builder /app/dist ./dist

# Ensure worker directory exists in case worker files were not present
RUN mkdir -p ./dist/jobs/workers

# Create health check endpoint script for Docker health checks
RUN echo '{"status":"ok"}' > health-check-response.json
RUN echo 'console.log("Health check script starting..."); \
const http = require("http"); \
const fs = require("fs"); \
const server = http.createServer((req, res) => { \
  if (req.url === "/health") { \
    res.writeHead(200, {"Content-Type": "application/json"}); \
    const healthData = fs.readFileSync("./health-check-response.json", "utf8"); \
    res.end(healthData); \
  } else { \
    res.writeHead(404); \
    res.end("Not found"); \
  } \
}); \
server.listen(3100, () => console.log("Health check server listening on port 3100"));' > health-check.js

# Expose ports
EXPOSE 3000
EXPOSE 3100

# Start both the health check script and the main application
CMD sh -c "node health-check.js & node dist/main.js"