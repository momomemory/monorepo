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
build-sdks: sdk-ts-build
    @echo "All SDK builds complete."

# Test all SDKs
test-sdks: sdk-ts-test
    @echo "All SDK tests complete."

# ─── TypeScript SDK helpers ─────────────────────────────────────────────────

# Generate TypeScript SDK from live OpenAPI spec
sdk-ts-codegen:
    #!/usr/bin/env bash
    set -euo pipefail

    # Build the server
    cargo build -p momo

    # Start server on dedicated port
    MOMO_HOST=127.0.0.1 MOMO_PORT=3100 MOMO_API_KEYS=test-key \
      ./target/debug/momo &
    SERVER_PID=$!

    # Ensure cleanup on exit
    trap "kill $SERVER_PID 2>/dev/null || true; wait $SERVER_PID 2>/dev/null || true" EXIT

    # Wait for server to be ready (max 30s)
    echo "Waiting for server..."
    for i in $(seq 1 30); do
      if curl -sSf http://127.0.0.1:3100/api/v1/health > /dev/null 2>&1; then
        echo "Server ready."
        break
      fi
      if [ "$i" -eq 30 ]; then
        echo "ERROR: Server did not start within 30s"
        exit 1
      fi
      sleep 1
    done

    # Fetch OpenAPI spec
    mkdir -p sdks/typescript/openapi
    curl -sSf http://127.0.0.1:3100/api/v1/openapi.json -o sdks/typescript/openapi/openapi.json
    echo "OpenAPI spec saved to sdks/typescript/openapi/openapi.json"

    # Run SDK codegen
    cd sdks/typescript && bun run codegen
    echo "SDK codegen complete."


# Build TypeScript SDK
sdk-ts-build:
    cd sdks/typescript && bun run build


# Run TypeScript SDK tests
sdk-ts-test:
    cd sdks/typescript && bun test

# Publish all SDKs (currently TypeScript only)
# NOTE: This wrapper delegates to release-sdk-ts which performs the full
# release flow (version bump, commit, push, subrepo push, and mirror tag).
publish-sdks version:
    @echo "Use 'just release-sdk-ts <version>' to publish the TypeScript SDK."
    @echo "Example: just release-sdk-ts 0.3.0"
    @echo "This wrapper exists for backwards compatibility and will not publish directly."
    
# Release the TypeScript SDK to the mirror and create a tag on the mirror repo.
# Usage: just release-sdk-ts 0.3.0
release-sdk-ts version:
    #!/usr/bin/env bash
    set -euo pipefail

    if [ -z "${1:-}" ]; then
      echo "Usage: just release-sdk-ts <version>  (e.g. just release-sdk-ts 0.3.0)"
      exit 1
    fi

    VERSION="$1"

    echo "Bumping sdks/typescript/package.json to $VERSION"
    cd sdks/typescript

    # Update package.json without creating a git tag
    npm version "$VERSION" --no-git-tag-version

    # Stage and commit package.json change
    git add package.json
    git commit -m "chore(sdk): bump to $VERSION"

    # Push to origin main
    git push origin main

    # Push subrepo to its upstream (this creates a commit on the subrepo remote)
    cd ../..
    echo "Pushing sdks/typescript subrepo upstream"
    git subrepo push sdks/typescript

    # Ensure any new commits from subrepo push are pushed to origin main
    git push origin main

    # Create tag on mirror repo using its latest main commit SHA
    echo "Creating tag v$VERSION on momomemory/sdk-typescript mirror repo"
    SHA=$(gh api repos/momomemory/sdk-typescript/commits/main --jq '.sha')
    gh api repos/momomemory/sdk-typescript/git/refs -X POST -f ref="refs/tags/v${VERSION}" -f sha="$SHA"

    echo "Release complete. Mirror tag: https://github.com/momomemory/sdk-typescript/releases/tag/v${VERSION}"
    echo "You can view the mirror actions: https://github.com/momomemory/sdk-typescript/actions"

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
