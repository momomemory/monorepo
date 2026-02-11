# ─── Momo Monorepo ────────────────────────────────────────────────────────────
# Task runner for the Momo AI memory system.
# Rust server lives in momo/.
# Run `just` to see all available commands.
# ──────────────────────────────────────────────────────────────────────────────

# Default recipe — show available commands
default:
    @just --list

# ─── Development ─────────────────────────────────────────────────────────────

# Run backend and frontend development servers together (auto-reload enabled)
dev:
    #!/usr/bin/env bash
    set -euo pipefail

    cleanup() {
      kill "${backend_pid:-}" "${frontend_pid:-}" 2>/dev/null || true
      wait "${backend_pid:-}" "${frontend_pid:-}" 2>/dev/null || true
    }
    trap cleanup EXIT INT TERM

    just dev-backend &
    backend_pid=$!

    just dev-frontend &
    frontend_pid=$!

    while true; do
      if ! kill -0 "$backend_pid" 2>/dev/null; then
        echo "Backend dev server stopped."
        exit 1
      fi

      if ! kill -0 "$frontend_pid" 2>/dev/null; then
        echo "Frontend dev server stopped."
        exit 1
      fi

      sleep 1
    done

# Run backend development server with automatic rebuild on code changes
dev-backend: build-frontend
    #!/usr/bin/env bash
    set -euo pipefail

    if ! command -v cargo >/dev/null 2>&1; then
      echo "cargo is required for backend development."
      exit 1
    fi

    if ! cargo watch --version >/dev/null 2>&1; then
      echo "cargo-watch is not installed. Installing..."
      cargo install cargo-watch
    fi

    cd momo
    dev_runtime_mode="${MOMO_DEV_RUNTIME_MODE:-all}"
    dev_single_process="${MOMO_DEV_SINGLE_PROCESS:-true}"

    MOMO_RUNTIME_MODE="$dev_runtime_mode" \
      MOMO_SINGLE_PROCESS="$dev_single_process" \
      cargo watch -w src -w tests -w Cargo.toml -w Cargo.lock -x "run"

# Run frontend development server with Vite HMR
dev-frontend:
    #!/usr/bin/env bash
    set -euo pipefail

    if ! command -v bun >/dev/null 2>&1; then
      echo "bun is required for frontend development."
      exit 1
    fi

    # Load backend host/port defaults from momo/.env when present
    if [ -f momo/.env ]; then
      # shellcheck disable=SC1091
      source momo/.env
    fi

    backend_host="${MOMO_HOST:-127.0.0.1}"
    backend_port="${MOMO_PORT:-3000}"
    export VITE_DEV_API_ORIGIN="${VITE_DEV_API_ORIGIN:-http://${backend_host}:${backend_port}}"

    cd momo/frontend
    if [ ! -d node_modules ]; then
      bun install
    fi

    bun run dev

# Run with debug logging
dev-debug:
    cd momo && MOMO_RUNTIME_MODE=all MOMO_SINGLE_PROCESS=true RUST_LOG=momo=debug cargo run

# Run with trace-level logging
dev-trace:
    cd momo && MOMO_RUNTIME_MODE=all MOMO_SINGLE_PROCESS=true RUST_LOG=momo=trace cargo run

# Watch for changes and restart (requires cargo-watch)
# watch:
#     cargo watch -x 'run -p momo'

# ─── Build ───────────────────────────────────────────────────────────────────

# Build frontend bundle for embedding into the Rust binary
build-frontend:
    #!/usr/bin/env bash
    set -euo pipefail

    if ! command -v bun >/dev/null 2>&1; then
      echo "bun is required for frontend build."
      exit 1
    fi

    cd momo/frontend
    if [ ! -d node_modules ]; then
      bun install
    fi
    bun run build

# Build all workspace members (debug)
build: build-frontend
    cd momo && cargo build

# Build optimized release binary
build-release: build-frontend
    cd momo && cargo build --release

# Build only the momo server (release)
build-momo: build-frontend
    cd momo && cargo build --release

# Check code compiles without building
check:
    cd momo && cargo check --all-targets --all-features

# Clean all build artifacts
clean:
    cd momo && cargo clean

# ─── Test ────────────────────────────────────────────────────────────────────

# Run all workspace tests
test:
    cd momo && cargo test --all-features

# Run tests for a specific package
test-package package:
    cd momo && cargo test -p {{ package }} --all-features

# Run tests matching a filter
test-filter filter:
    cd momo && cargo test --all-features -- {{ filter }}

# Run tests with output shown
test-verbose:
    cd momo && cargo test --all-features -- --nocapture

# ─── Lint & Format ───────────────────────────────────────────────────────────

# Format all code
fmt:
    cd momo && cargo fmt --all

# Check formatting without modifying
fmt-check:
    cd momo && cargo fmt --all -- --check

# Run clippy linting on all targets
lint:
    cd momo && cargo clippy --all-targets --all-features -- -D warnings

# Run clippy and auto-fix where possible
lint-fix:
    cd momo && cargo clippy --all-targets --all-features --fix --allow-dirty

# ─── Documentation ───────────────────────────────────────────────────────────

# Generate and open documentation
docs:
    cd momo && cargo doc --no-deps --open

# Generate docs without opening
docs-build:
    cd momo && cargo doc --no-deps

# ─── Database ────────────────────────────────────────────────────────────────

# Run database migrations
migrate:
    cd momo && cargo run -- migrate

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
    cd momo && cargo build

    # Start server on dedicated port
    MOMO_HOST=127.0.0.1 MOMO_PORT=3100 MOMO_API_KEYS=test-key \
      ./momo/target/debug/momo &
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
# Publish all plugins (OpenCode, OpenClaw, Pi)
publish-plugins:
    @echo "Use one of:"
    @echo "  just release-plugin-opencode <version>"
    @echo "  just release-plugin-openclaw <version>"
    @echo "  just release-plugin-pi <version>"
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
    VERSION="$VERSION" bun -e 'const fs = require("node:fs"); const pkg = JSON.parse(fs.readFileSync("package.json", "utf8")); pkg.version = process.env.VERSION; fs.writeFileSync("package.json", JSON.stringify(pkg, null, 2) + "\n");'
    # Stage and commit package.json change
    git add package.json
    git commit -m "chore(sdk): bump to $VERSION"
    git push origin main
    # Push subrepo to its upstream (this creates a commit on the subrepo remote)
    cd ../..
    echo "Pushing sdks/typescript subrepo upstream"
    git subrepo push sdks/typescript
    git push origin main
    # Create tag on mirror repo using its latest main commit SHA
    echo "Creating tag v$VERSION on momomemory/sdk-typescript mirror repo"
    SHA=$(gh api repos/momomemory/sdk-typescript/commits/main --jq '.sha')
    gh api repos/momomemory/sdk-typescript/git/refs -X POST -f ref="refs/tags/v${VERSION}" -f sha="$SHA"
    echo "You can view the mirror actions: https://github.com/momomemory/sdk-typescript/actions"
# Release the OpenCode plugin to the mirror and create a tag on the mirror repo.
# Usage: just release-plugin-opencode 0.1.4
release-plugin-opencode version:
    #!/usr/bin/env bash
    set -euo pipefail

    if [ -z "${1:-}" ]; then
      echo "Usage: just release-plugin-opencode <version>  (e.g. just release-plugin-opencode 0.1.4)"
      exit 1
    fi

    VERSION="$1"

    echo "Bumping plugins/opencode-momo/package.json to $VERSION"
    cd plugins/opencode-momo

    VERSION="$VERSION" bun -e 'const fs = require("node:fs"); const pkg = JSON.parse(fs.readFileSync("package.json", "utf8")); pkg.version = process.env.VERSION; fs.writeFileSync("package.json", JSON.stringify(pkg, null, 2) + "\n");'

    git add package.json
    git commit -m "chore(opencode-momo): bump version to $VERSION"

    git push origin main

    cd ../..
    echo "Pushing plugins/opencode-momo subrepo upstream"
    git subrepo push plugins/opencode-momo

    git push origin main

    echo "Creating tag v$VERSION on momomemory/opencode-momo mirror repo"
    SHA=$(gh api repos/momomemory/opencode-momo/commits/main --jq '.sha')
    gh api repos/momomemory/opencode-momo/git/refs -X POST -f ref="refs/tags/v${VERSION}" -f sha="$SHA"

    echo "Release complete. Mirror tag: https://github.com/momomemory/opencode-momo/releases/tag/v${VERSION}"
    echo "You can view the mirror actions: https://github.com/momomemory/opencode-momo/actions"

# Release the OpenClaw plugin to the mirror and create a tag on the mirror repo.
# Usage: just release-plugin-openclaw 0.1.1
release-plugin-openclaw version:
    #!/usr/bin/env bash
    set -euo pipefail

    if [ -z "${1:-}" ]; then
      echo "Usage: just release-plugin-openclaw <version>  (e.g. just release-plugin-openclaw 0.1.1)"
      exit 1
    fi

    VERSION="$1"

    echo "Bumping plugins/openclaw-momo/package.json to $VERSION"
    cd plugins/openclaw-momo

    VERSION="$VERSION" bun -e 'const fs = require("node:fs"); const pkg = JSON.parse(fs.readFileSync("package.json", "utf8")); pkg.version = process.env.VERSION; fs.writeFileSync("package.json", JSON.stringify(pkg, null, 2) + "\n");'

    git add package.json
    git commit -m "chore(openclaw-momo): bump version to $VERSION"

    git push origin main

    cd ../..
    echo "Pushing plugins/openclaw-momo subrepo upstream"
    git subrepo push plugins/openclaw-momo

    git push origin main

    echo "Creating tag v$VERSION on momomemory/openclaw-momo mirror repo"
    SHA=$(gh api repos/momomemory/openclaw-momo/commits/main --jq '.sha')
    gh api repos/momomemory/openclaw-momo/git/refs -X POST -f ref="refs/tags/v${VERSION}" -f sha="$SHA"

    echo "Release complete. Mirror tag: https://github.com/momomemory/openclaw-momo/releases/tag/v${VERSION}"
    echo "You can view the mirror actions: https://github.com/momomemory/openclaw-momo/actions"

# Release the Pi plugin to the mirror and create a tag on the mirror repo.
# Usage: just release-plugin-pi 0.1.3
release-plugin-pi version:
    #!/usr/bin/env bash
    set -euo pipefail

    if [ -z "${1:-}" ]; then
      echo "Usage: just release-plugin-pi <version>  (e.g. just release-plugin-pi 0.1.3)"
      exit 1
    fi

    VERSION="$1"

    echo "Bumping plugins/pi-momo/package.json to $VERSION"
    cd plugins/pi-momo

    VERSION="$VERSION" bun -e 'const fs = require("node:fs"); const pkg = JSON.parse(fs.readFileSync("package.json", "utf8")); pkg.version = process.env.VERSION; fs.writeFileSync("package.json", JSON.stringify(pkg, null, 2) + "\n");'

    git add package.json
    git commit -m "chore(pi-momo): bump version to $VERSION"

    git push origin main

    cd ../..
    echo "Pushing plugins/pi-momo subrepo upstream"
    git subrepo push plugins/pi-momo

    git push origin main

    echo "Creating tag v$VERSION on momomemory/pi-momo mirror repo"
    SHA=$(gh api repos/momomemory/pi-momo/commits/main --jq '.sha')
    gh api repos/momomemory/pi-momo/git/refs -X POST -f ref="refs/tags/v${VERSION}" -f sha="$SHA"

    echo "Release complete. Mirror tag: https://github.com/momomemory/pi-momo/releases/tag/v${VERSION}"
    echo "You can view the mirror actions: https://github.com/momomemory/pi-momo/actions"

# Release the core Momo server mirror and create a tag on the mirror repo.
# Usage: just release-momo 0.3.1
release-momo version:
    #!/usr/bin/env bash
    set -euo pipefail

    if [ -z "${1:-}" ]; then
      echo "Usage: just release-momo <version>  (e.g. just release-momo 0.3.1)"
      exit 1
    fi

    VERSION="$1"

    echo "Bumping momo/Cargo.toml version to $VERSION"
    tmp_file=$(mktemp)
    awk -v version="$VERSION" 'BEGIN{done=0} { if (!done && $0 ~ /^version = "/) { print "version = \"" version "\""; done=1 } else { print } }' momo/Cargo.toml > "$tmp_file"
    mv "$tmp_file" momo/Cargo.toml

    git add momo/Cargo.toml
    git commit -m "chore(momo): bump version to $VERSION"

    git push origin main

    echo "Pushing momo subrepo upstream"
    git subrepo push momo

    git push origin main

    echo "Creating tag v$VERSION on momomemory/momo mirror repo"
    SHA=$(gh api repos/momomemory/momo/commits/main --jq '.sha')
    gh api repos/momomemory/momo/git/refs -X POST -f ref="refs/tags/v${VERSION}" -f sha="$SHA"

    echo "Release complete. Mirror tag: https://github.com/momomemory/momo/releases/tag/v${VERSION}"
    echo "You can view the mirror actions: https://github.com/momomemory/momo/actions"

# ─── Dependencies & Security ────────────────────────────────────────────────

# Update workspace dependencies
update:
    cd momo && cargo update

# Run security audit (requires cargo-audit)
audit:
    cd momo && cargo audit

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
    @echo "  • Bun           — https://bun.sh/"
    @echo ""
    @echo "Optional:"
    @echo "  • Tesseract     — OCR support"
    @echo "  • cargo-watch   — backend auto-reload (auto-installed by just dev)"
    @echo "  • cargo-audit   — security auditing"
    @echo "  • Docker        — containerized deployment"
    @echo "  • git-subrepo   — subrepo management"
    @echo ""
    @echo "Run 'just dev' to start backend + frontend dev servers."
