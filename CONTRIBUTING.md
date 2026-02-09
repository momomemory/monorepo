# Contributing to Momo

Thank you for your interest in contributing to Momo! We welcome contributions of all kinds — bug reports, feature requests, documentation improvements, and code.

Momo is managed as a monorepo containing the core Rust server and its various SDKs.

## Getting Started

### Prerequisites

To get started with development, you'll need the following:

- **Rust 1.75+** — [rustup.rs](https://rustup.rs)
- **just** — `cargo install just`
- **Bun** — For TypeScript SDK development
- **Docker** — For containerized testing
- **Tesseract** (Optional) — For OCR support
- **git-subrepo** (Optional) — For subrepo management

### Initial Setup

1. **Clone the repository:**
   ```bash
   git clone https://github.com/momomemory/monorepo.git
   cd monorepo
   ```

2. **Check your environment:**
   ```bash
   just setup
   ```

3. **Build the project:**
   ```bash
   just build
   ```

4. **Run the tests:**
   ```bash
   just test
   ```

5. **Start the dev server:**
   ```bash
   just dev
   ```

## Monorepo Structure

```text
├── momo/              # Core Rust server
├── sdks/
│   └── typescript/    # TypeScript SDK (@momomemory/sdk)
├── justfile           # Task runner (run `just` to see all commands)
├── Cargo.toml         # Workspace root
└── .github/workflows/ # CI workflows
```

> **Note:** `momo/` and `sdks/typescript/` are managed as git subrepos. All development happens within this monorepo, and changes are synced to their respective standalone repositories.

## Development Workflow

### Core Server

The core server lives in the `momo/` directory.

- **Dev mode:** `just dev`
- **Debug logs:** `just dev-debug`
- **Trace logs:** `just dev-trace`

### Quality Control

Before submitting a Pull Request, please ensure your changes pass all checks:

- **Formatting:** `just fmt`
- **Linting:** `just lint`
- **Health check:** `just health` (Runs fmt, lint, check, and test)
- **CI Simulation:** `just ci` (Full pipeline simulation)

## SDK Development

### TypeScript SDK

The TypeScript SDK is located at `sdks/typescript/`. It is ESM-only and targets Bun and Node 18+.

- **Codegen from OpenAPI:** `just sdk-ts-codegen` (Starts the server, fetches `openapi.json`, and generates types)
- **Build:** `just sdk-ts-build`
- **Test:** `just sdk-ts-test`

## Releasing SDKs

SDK releases are handled through the monorepo and synced to standalone mirror repositories. This process is reserved for maintainers.

### Release Flow

1. **Update the version** in the SDK's package manifest (e.g., `sdks/typescript/package.json`).
2. **Commit the change:**
   ```bash
   git commit -m "chore(sdk): bump to X.Y.Z"
   ```
3. **Push to the monorepo:**
   ```bash
   git push origin main
   ```
4. **Sync the mirror repo:**
   ```bash
   just subrepo-push sdks/typescript
   ```
5. **Tag the mirror repo** to trigger the release workflow:
   ```bash
   # Replace <repo> and <version> accordingly
   SHA=$(gh api repos/momomemory/sdk-typescript/commits/main --jq '.sha')
   gh api repos/momomemory/sdk-typescript/git/refs -X POST \
     -f ref="refs/tags/vX.Y.Z" -f sha="$SHA"
   ```

Alternatively, use the `just` shortcut:
```bash
just release-sdk-ts <version>
```

### How It Works

- **Trusted Publishing:** Each SDK uses GitHub's OIDC Trusted Publishing. No manual tokens or secrets are required in the CI environment.
- **Validation:** The release workflow validates that the git tag matches the version in `package.json` before publishing.
- **Provenance:** NPM provenance attestations are automatically attached to the published packages.
- **Environment:** CI runs on Node 24 to support the latest npm features for Trusted Publishing.

### Setting Up a New SDK Package

1. Create the SDK directory in `sdks/{language}/`.
2. Create a mirror repository at `github.com/momomemory/sdk-{language}`.
3. Initialize it as a subrepo: `git subrepo init --remote=... sdks/{language}`.
4. Perform an initial manual publish to create the package on the registry.
5. Configure **Trusted Publishing** on the registry (e.g., npmjs.com package settings).
6. Add a `.github/workflows/publish.yml` to the SDK directory.

## Docker

We provide a multi-stage Docker build for the core server.

- **Build image:** `just docker-build`
- **Run container:** `just docker-run`
- **Build & Run:** `just docker-up`

The server exposes port `3000` by default and expects a data volume at `/data`.

## Git Subrepo Workflow

Momo uses `git-subrepo` to manage its components.

- **Check status:** `just subrepo-status`
- **Pull upstream changes:** `just subrepo-pull <path>`
- **Push changes to standalone repos:** `just subrepo-push <path>` (e.g., `just subrepo-push sdks/typescript`)

**Important:** Please submit all Pull Requests to this monorepo rather than the standalone repositories.

## Submitting Pull Requests

1. **Fork the repository** on GitHub.
2. **Create a feature branch** from `main`.
3. **Make your changes** in small, focused commits.
4. **Verify your changes** by running `just health`.
5. **Push your branch** and open a PR against `main`.

Please include a clear description of what your PR does and why.

## Reporting Issues

If you find a bug or have a feature request, please [open an issue](https://github.com/momomemory/monorepo/issues) on GitHub. Include as much detail as possible:

- Steps to reproduce (for bugs)
- Expected vs actual behavior
- Relevant logs or error messages
- Your environment (OS, Rust version, Docker version, etc.)

## Questions?

Feel free to [open an issue](https://github.com/momomemory/monorepo/issues) for any questions about contributing.
