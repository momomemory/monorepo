# ─── Momo Monorepo ────────────────────────────────────────────────────────────
# Task runner for the Momo AI memory system.
# Cargo workspace root with momo/ as a git-subrepo.
# Run `just` to see all available commands.
# ──────────────────────────────────────────────────────────────────────────────

# Default recipe — show available commands
default:
    @just --list

# ─── Development ─────────────────────────────────────────────────────────────

# Run the Momo server in development mode
dev:
    cargo run -p momo

# Run with debug logging
dev-debug:
    RUST_LOG=momo=debug cargo run -p momo

# Run with trace-level logging
dev-trace:
    RUST_LOG=momo=trace cargo run -p momo

# Watch for changes and restart (requires cargo-watch)
# watch:
#     cargo watch -x 'run -p momo'

# ─── Build ───────────────────────────────────────────────────────────────────

# Build all workspace members (debug)
build:
    cargo build

# Build optimized release binary
build-release:
    cargo build --release

# Build only the momo server (release)
build-momo:
    cargo build -p momo --release

# Check code compiles without building
check:
    cargo check --all-targets --all-features

# Clean all build artifacts
clean:
    cargo clean

# ─── Test ────────────────────────────────────────────────────────────────────

# Run all workspace tests
test:
    cargo test --all-features

# Run tests for a specific package
test-package package:
    cargo test -p {{ package }} --all-features

# Run tests matching a filter
test-filter filter:
    cargo test --all-features -- {{ filter }}

# Run tests with output shown
test-verbose:
    cargo test --all-features -- --nocapture

# ─── Lint & Format ───────────────────────────────────────────────────────────

# Format all code
fmt:
    cargo fmt --all

# Check formatting without modifying
fmt-check:
    cargo fmt --all -- --check

# Run clippy linting on all targets
lint:
    cargo clippy --all-targets --all-features -- -D warnings

# Run clippy and auto-fix where possible
lint-fix:
    cargo clippy --all-targets --all-features --fix --allow-dirty

# ─── Documentation ───────────────────────────────────────────────────────────

# Generate and open documentation
docs:
    cargo doc --workspace --no-deps --open

# Generate docs without opening
docs-build:
    cargo doc --workspace --no-deps

# ─── Database ────────────────────────────────────────────────────────────────

# Run database migrations
migrate:
    cargo run -p momo -- migrate

# Reset database (DANGER: deletes all data)
db-reset:
    rm -f momo.db momo.db-shm momo.db-wal
    @echo "Database reset. Run 'just dev' to start fresh."

# ─── Docker ──────────────────────────────────────────────────────────────────

# Build Docker image for momo
docker-build:
    docker build -t momo momo/

# Run momo in Docker
docker-run:
    docker run -p 3000:3000 -v ./data:/data momo

# Build and run in Docker
docker-up: docker-build docker-run

# ─── Git Subrepo Management ─────────────────────────────────────────────────

# Show status of all git subrepos
subrepo-status:
    git subrepo status --all

# Pull updates from a subrepo's upstream
subrepo-pull name:
    git subrepo pull {{ name }}

# Push changes to a subrepo's upstream
subrepo-push name:
    git subrepo push {{ name }}

# Pull all subrepos from their upstreams
subrepo-pull-all:
    git subrepo pull --all

# Push all subrepos (pull first to avoid conflicts)
subrepo-push-all: subrepo-pull-all
    git subrepo push --all

# Check if a subrepo is clean
subrepo-clean name:
    git subrepo clean {{ name }}

# ─── SDK Development ────────────────────────────────────────────────────────

# Build all SDKs
build-sdks:
    @echo "SDK builds not yet implemented"
    # TypeScript SDK
    # cd sdks/typescript && npm run build
    # Python SDK
    # cd sdks/python && python -m build
    # Go SDK
    # cd sdks/go && go build ./...

# Test all SDKs
test-sdks:
    @echo "SDK tests not yet implemented"
    # cd sdks/typescript && npm test
    # cd sdks/python && pytest
    # cd sdks/go && go test ./...

# Publish all SDKs
publish-sdks:
    @echo "SDK publishing not yet implemented"
    # cd sdks/typescript && npm publish
    # cd sdks/python && twine upload dist/*
    # cd sdks/go — publish via git tag

# ─── Dependencies & Security ────────────────────────────────────────────────

# Update workspace dependencies
update:
    cargo update

# Run security audit (requires cargo-audit)
audit:
    cargo audit

# ─── CI & Health ─────────────────────────────────────────────────────────────

# Quick health check — format, lint, check, test
health: fmt lint check test
    @echo "✓ Health check passed"

# Full CI pipeline — clean slate build with strict checks
ci: fmt-check lint test build-release
    @echo "✓ CI pipeline passed"

# ─── Setup ───────────────────────────────────────────────────────────────────

# Show development environment requirements
setup:
    @echo "Momo Development Environment"
    @echo "────────────────────────────"
    @echo "Required:"
    @echo "  • Rust 1.75+    — https://rustup.rs"
    @echo "  • just          — cargo install just"
    @echo ""
    @echo "Optional:"
    @echo "  • Tesseract     — OCR support"
    @echo "  • cargo-watch   — auto-reload (just watch)"
    @echo "  • cargo-audit   — security auditing"
    @echo "  • Docker        — containerized deployment"
    @echo "  • git-subrepo   — subrepo management"
    @echo ""
    @echo "Run 'just dev' to start the server."
