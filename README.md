# Momo Monorepo

This is the monorepo for Momo - a self-hostable AI memory system written in Rust.

## Structure

```
.
├── Cargo.toml           # Workspace configuration
├── justfile             # Task runner commands
├── momo/                # Core Momo server (Rust)
│   ├── src/
│   ├── tests/
│   └── Cargo.toml
├── sdks/                # SDKs for various languages
│   ├── rust/           # Rust SDK (planned)
│   ├── typescript/     # TypeScript/JavaScript SDK (planned)
│   ├── python/         # Python SDK (planned)
│   └── go/             # Go SDK (planned)
└── docs/               # Documentation
```

## Quick Start

### Prerequisites

- **Rust 1.75+** (for building from source)
- **just** (task runner) - `cargo install just`
- **Tesseract** (optional — for OCR)

### Development

```bash
# Run the server in development mode
just dev

# Run with debug logging
just dev-debug

# Run tests
just test

# Build release binary
just build
```

See `justfile` for all available commands.

## Workspace Configuration

This is a Cargo workspace. Dependencies are managed centrally in the root `Cargo.toml` and inherited by workspace members.

To add a new workspace member:

1. Create the crate in a subdirectory
2. Add the path to `[workspace].members` in root `Cargo.toml`
3. Use `workspace = true` to inherit common dependencies

## SDKs

SDKs are planned for the following languages:

- **Rust** - Native SDK for Rust applications
- **TypeScript/JavaScript** - For Node.js and browser environments
- **Python** - For Python applications and ML workflows
- **Go** - For Go applications

Each SDK will provide a typed client for the Momo API.

## Contributing

See [momo/CONTRIBUTING.md](momo/CONTRIBUTING.md) for contribution guidelines.

## License

[MIT](momo/LICENSE) © Momo Contributors
