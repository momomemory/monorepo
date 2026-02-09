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
