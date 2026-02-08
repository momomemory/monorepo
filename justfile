# Momo Monorepo

# Default recipe - show available commands
default:
    @just --list

# === Development ===

# Run the Momo server in development mode
dev:
    cd momo && cargo run

# Run with verbose logging
dev-debug:
    cd momo && RUST_LOG=momo=debug cargo run

# Build the release binary
build:
    cd momo && cargo build --release

# Run all tests
test:
    cd momo && cargo test

# Run clippy linting
lint:
    cd momo && cargo clippy --all-targets --all-features

# Format code
fmt:
    cd momo && cargo fmt

# Check code without building
check:
    cd momo && cargo check

# Clean build artifacts
clean:
    cd momo && cargo clean
    rm -rf target/

# === Docker ===

# Build Docker image
docker-build:
    cd momo && docker build -t momo .

# Run Docker container
docker-run:
    docker run -p 3000:3000 -v ./data:/data momo

# === Database ===

# Run database migrations (if using migrations tool)
migrate:
    cd momo && cargo run -- migrate

# Reset database (DANGER: deletes all data)
db-reset:
    rm -f momo.db momo.db-shm momo.db-wal
    @echo "Database reset. Run 'just dev' to start fresh."

# === SDK Development ===

# Build all SDKs
build-sdks:
    @echo "Building SDKs..."
    # TypeScript SDK
    # cd sdks/typescript && npm run build
    # Python SDK
    # cd sdks/python && python setup.py build
    # Go SDK
    # cd sdks/go && go build ./...
    @echo "SDK builds not yet implemented"

# Test all SDKs
test-sdks:
    @echo "Testing SDKs..."
    @echo "SDK tests not yet implemented"

# Publish all SDKs
publish-sdks:
    @echo "Publishing SDKs..."
    @echo "SDK publishing not yet implemented"

# === Project Management ===

# Update dependencies
update:
    cd momo && cargo update

# Run security audit
audit:
    cd momo && cargo audit

# Generate documentation
docs:
    cd momo && cargo doc --no-deps --open

# === Utilities ===

# Check project health (lint, test, check)
health: fmt lint check test
    @echo "Health check complete!"

# Full CI pipeline simulation
ci: clean fmt lint test build
    @echo "CI simulation complete!"

# Setup development environment
setup:
    @echo "Setting up development environment..."
    @echo "Make sure you have Rust installed: https://rustup.rs"
    @echo "Run 'just dev' to start the server"
