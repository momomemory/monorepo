# Momo: Self-Hostable AI Memory System

## Project Identity
- **Momo**: Self-hostable AI memory system. Single Rust binary.
- **Inspiration**: Supermemory clone/evolution.
- **Core Stack**: LibSQL (vector search), FastEmbed (embeddings), Axum (REST).
- **Repo Structure**: Workspace-based monorepo. Core at `momo/` (subrepo). SDKs at `sdks/`.
- **Frontend**: Bun + Preact web console embedded into the Rust binary and served from `/`.

## Architecture Quick Map
- **Entry**: `momo/src/main.rs`. Inits DB, AI, OCR, transcription → Spawns 5 background tasks → Starts Axum.
- **Modules**:
  - `api`: REST v1 endpoints + embedded frontend asset serving.
  - `config`: Env-var based configuration.
  - `db`: Trait-based LibSQL implementation.
  - `embeddings`: FastEmbed (local) or API providers.
  - `intelligence`: High-level AI features/logic.
  - `llm`: Provider abstractions.
  - `ocr`: Tesseract integration.
  - `processing`: Content ingestion pipeline.
  - `search`: Hybrid search + rewrite cache.
  - `services`: Background task managers.
  - `transcription`: Whisper integration.
- **Background Services**: ProcessingPipeline, ForgettingManager, EpisodeDecayManager, InferenceEngine, ProfileRefreshManager.

## Configuration
- **Mechanism**: 100% env-var based. `Config::from_env()` with `Default` impl.
- **Template**: `momo/.env.example`.
- **Provider Pattern**: `provider/model` string format. Splits on first `/`. Fallback to `local`.

## Monorepo Structure
- **Workspace**: Cargo monorepo managing server and multiple SDKs.
- **Core Server**: Located at `momo/`. Git subrepo mirrored at `momomemory/momo`.
- **TypeScript SDK**: Located at `sdks/typescript/`. Git subrepo mirrored at `momomemory/sdk-typescript`.
- **Plugins**: Located at `plugins/opencode-momo/`, `plugins/openclaw-momo/`, and `plugins/pi-momo/` with mirrors `momomemory/opencode-momo`, `momomemory/openclaw-momo`, and `momomemory/pi-momo`.
- **Workflow**: Changes made in monorepo, pushed to mirrors via `git subrepo push`.
- **Source of Truth**: `momomemory/monorepo` contains the entire history and all components.

## Dev Commands (via justfile)
- **Development**: `just dev` (backend + frontend HMR), `just dev-debug`, `just dev-trace`, `just dev-backend`, `just dev-frontend`
- **Build**: `just build-frontend`, `just build` (debug + frontend), `just build-release` (optimized + frontend), `just build-momo` (momo only + frontend)
- **Check/Clean**: `just check`, `just clean`
- **Test**: `just test`, `just test-package <pkg>`, `just test-filter <filter>`, `just test-verbose`
- **Lint & Format**: `just fmt`, `just fmt-check`, `just lint`, `just lint-fix`
- **Documentation**: `just docs`, `just docs-build`
- **Database**: `just migrate`, `just db-reset`
- **Docker**: `just docker-build`, `just docker-run`, `just docker-up`
- **Git Subrepo**: `just subrepo-status`, `just subrepo-pull <name>`, `just subrepo-push <name>`, `just subrepo-pull-all`, `just subrepo-push-all`
- **SDK + Release**: `just build-sdks`, `just test-sdks`, `just sdk-ts-codegen`, `just sdk-ts-build`, `just sdk-ts-test`, `just release-sdk-ts <version>`, `just release-plugin-opencode <version>`, `just release-plugin-openclaw <version>`, `just release-plugin-pi <version>`, `just release-momo <version>`, `just publish-sdks`, `just publish-plugins`
- **Maintenance**: `just update`, `just audit`, `just health`, `just ci`, `just setup`

## Deployment
- **Docker**: `just docker-build` → `just docker-run` (or `just docker-up`).
- **Dockerfile**: `momo/Dockerfile` expects a prebuilt Linux binary (`target/release/momo`) and packages ONNX Runtime + Tesseract runtime deps.
- **Dev Dockerfile**: `momo/Dockerfile.dev` performs an in-container debug build.
- **Runtime**: Exposes port 3000. Volume at `/data`.
- **Release Binary**: `just build-release` → single binary at `target/release/momo`.
- **Optimizations**: LTO, `panic=abort`, stripped symbols.
- **CI/CD**: `.github/workflows/sync-org-profile.yml` syncs README to organization profile. Mirror repos publish from `v*` tags (e.g., `sdks/typescript/.github/workflows/publish.yml`, plugin mirror publish workflows).

## Frontend Build + Serving
- **Embedding**: Frontend assets from `momo/frontend/dist` are embedded via `rust-embed`.
- **Build Trigger**: `momo/build.rs` watches frontend sources and ensures `dist/` exists (invokes `bun install` + `bun run build` when needed).
- **Routes**: API remains under `/api/v1`; web console is served at `/` with SPA fallback for non-API paths.
- **Requirement**: `bun` must be available in build environments when frontend assets are missing/stale.

## SDK & Plugin Release Development
- **Location**: TypeScript SDK at `sdks/typescript/`.
- **Codegen**: `just sdk-ts-codegen` (starts server, fetches OpenAPI spec, runs `openapi-typescript`).
- **Build/Test**: `just sdk-ts-build`, `just sdk-ts-test`.
- **Workflow**: Changes land in monorepo first, then sync to mirror via `git subrepo push <path>`.
- **Package**: `@momomemory/sdk` (ESM-only, Bun + Node 18+).
- **Publishing**: OIDC Trusted Publishing via GitHub Actions. No `NPM_TOKEN` needed.
- **Release Flow Commands**:
  - `just release-sdk-ts <version>` → bumps `sdks/typescript/package.json` (Bun), commits, pushes monorepo, pushes subrepo, tags `momomemory/sdk-typescript`.
  - `just release-plugin-opencode <version>` → bumps `plugins/opencode-momo/package.json`, pushes/tag `momomemory/opencode-momo`.
  - `just release-plugin-openclaw <version>` → bumps `plugins/openclaw-momo/package.json`, pushes/tag `momomemory/openclaw-momo`.
  - `just release-plugin-pi <version>` → bumps `plugins/pi-momo/package.json`, pushes/tag `momomemory/pi-momo`.
  - `just release-momo <version>` → bumps `momo/Cargo.toml`, pushes/tag `momomemory/momo`.
- **Tag Convention**: Mirror releases are triggered from `v{version}` tags created after subrepo push.

## Conventions
- **Rust**: Minimum version 1.75.
- **Formatting**: `cargo fmt` mandatory.
- **Linting**: `cargo clippy` mandatory.
- **Deps**: Centralized in root `Cargo.toml`.
- **Features**: `local-embeddings` default.
- **Release**: LTO + `panic=abort` + `strip`.

## Cross-Cutting Patterns
- **Errors**: `MomoError` (thiserror) → `IntoResponse` for Axum. `Result<T>` alias.
- **Shutdown**: `CancellationToken` + `tokio::select!` for all services.
- **Auth**: Optional via `MOMO_API_KEYS`. Middleware-based.
- **Multi-tenancy**: `container_tag` field isolates data per user/tenant.

## What NOT to Do
- **External Vector DB**: DO NOT add. LibSQL handles vectors natively (F32_BLOB).
- **Config Files**: DO NOT create. Stay 100% env-var based.
- **Legacy API**: DO NOT add v3/v4 routes. Use v1 only (README has doc debt).
- **Cargo.toml**: DO NOT update dep versions in child crates directly. Use workspace.
