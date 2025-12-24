.PHONY: dev dev-backend dev-frontend dev-pdf-ingestion-service install clean help setup generate-pdf-sdk

# Default target
.DEFAULT_GOAL := help

# Constants
PDF_SDK_OUTPUT_DIR = packages/backend/src/pdf-ingestion-service-client

# First-time setup: install dependencies and generate SDK
setup:
	@echo "🔧 Running first-time setup..."
	@$(MAKE) install
	@$(MAKE) generate-pdf-sdk
	@echo "✅ Setup complete! Run 'make dev' to start all services."

# Generate TypeScript SDK from PDF ingestion service
generate-pdf-sdk:
	@echo "📝 Generating TypeScript SDK from PDF ingestion service..."
	@echo "   Starting PDF ingestion service temporarily..."
	@cd packages/pdf-ingestion-service && uv run fastapi run main.py --host 0.0.0.0 --port 8000 & echo $$! > /tmp/pdf-ingestion-service.pid
	@echo "   Waiting for service to be ready..."
	@sleep 5
	@echo "   Generating SDK..."
	@bun run openapi-ts
	@echo "   Stopping temporary PDF service..."
	@kill `cat /tmp/pdf-ingestion-service.pid` 2>/dev/null || true
	@rm -f /tmp/pdf-ingestion-service.pid
	@sleep 2
	@echo "✅ SDK generated successfully!"

# Start all services in parallel (auto-generates SDK if missing)
dev:
	@if [ ! -d "$(PDF_SDK_OUTPUT_DIR)" ]; then \
		echo "⚠️  SDK not found. Generating..."; \
		$(MAKE) generate-pdf-sdk; \
	fi
	@echo "🚀 Starting all services..."
	@$(MAKE) -j2 _dev-js-services dev-pdf-ingestion-service

# Internal target: Start JS/TS services via bun workspaces
_dev-js-services:
	@bun dev

# Start backend (Bun/Elysia)
dev-backend:
	@echo "🦊 Starting backend on port 3000..."
	@cd packages/backend && bun dev

# Start frontend (React/Vite)
dev-frontend:
	@echo "⚛️  Starting admin console on port 5173..."
	@cd packages/admin-console && bun dev

# Start PDF ingestion service (Python)
dev-pdf-ingestion-service:
	@echo "🐍 Starting PDF ingestion service..."
	@cd packages/pdf-ingestion-service && uv run fastapi run main.py

# Install dependencies for all services
install:
	@echo "📦 Installing dependencies..."
	@bun install
	@cd packages/pdf-ingestion-service && uv sync

# Clean build artifacts and dependencies
clean:
	@echo "🧹 Cleaning..."
	@rm -rf node_modules
	@rm -rf packages/*/node_modules
	@rm -rf packages/*/.next
	@rm -rf packages/*/dist
	@find . -type d -name "__pycache__" -exec rm -rf {} +
	@find . -type d -name "*.egg-info" -exec rm -rf {} +

# Show help
help:
	@echo "Available commands:"
	@echo "  make setup               - First-time setup (install + generate SDK)"
	@echo "  make dev                 - Start all services"
	@echo "  make dev-backend         - Start backend only"
	@echo "  make dev-frontend        - Start frontend only"
	@echo "  make dev-pdf-ingestion-service   - Start PDF ingestion service only"
	@echo "  make generate-pdf-sdk    - Generate TypeScript SDK from PDF service"
	@echo "  make install             - Install all dependencies"
	@echo "  make clean               - Clean build artifacts"
