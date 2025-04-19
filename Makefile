# Makefile for Real-Time Regex Validator

# Default target
.PHONY: default
default: help

# Help target
.PHONY: help
help:
	@echo "Real-Time Regex Validator"
	@echo "--------------------------"
	@echo "Available commands:"
	@echo "  make start         - Start the application (same as docker compose up --build)"
	@echo "  make start-detach  - Start the application in detached mode"
	@echo "  make stop          - Stop the application"
	@echo "  make restart       - Restart the application"
	@echo "  make logs          - Show logs from all containers"
	@echo "  make logs-backend  - Show logs from backend container"
	@echo "  make logs-frontend - Show logs from frontend container"
	@echo "  make clean         - Stop and remove containers, networks, volumes, and images"
	@echo "  make status        - Show status of containers"
	@echo "  make test-api      - Test the backend API with a sample request"
	@echo "  make help          - Show this help message"

# Start the application
.PHONY: start
start:
	@echo "Starting the application..."
	docker compose up --build

# Start the application in detached mode
.PHONY: start-detach
start-detach:
	@echo "Starting the application in detached mode..."
	docker compose up -d --build

# Stop the application
.PHONY: stop
stop:
	@echo "Stopping the application..."
	docker compose down

# Restart the application
.PHONY: restart
restart:
	@echo "Restarting the application..."
	docker compose down
	docker compose up -d --build

# Show logs from all containers
.PHONY: logs
logs:
	docker compose logs -f

# Show logs from backend container
.PHONY: logs-backend
logs-backend:
	docker compose logs -f backend

# Show logs from frontend container
.PHONY: logs-frontend
logs-frontend:
	docker compose logs -f frontend

# Clean up
.PHONY: clean
clean:
	@echo "Cleaning up..."
	docker compose down -v --rmi local

# Show status of containers
.PHONY: status
status:
	docker compose ps

# Test the API with a sample request
.PHONY: test-api
test-api:
	@echo "Testing API with a sample request..."
	@curl -X POST http://localhost:61234/api/jobs \
		-H "Content-Type: application/json" \
		-d '{"input": "test123"}' \
		-s | jq || echo "Failed to test API. Make sure the application is running and jq is installed."