---
title: Release Strategy
description: Versioning and release workflow for the Momo server and SDKs.
---

This page documents how Momo manages releases, versioning, and artifact publishing.

## Monorepo + Mirror Architecture

Momo uses a monorepo workflow with git subrepo mirrors:

- **Monorepo** (`momomemory/monorepo`): Contains the entire project history
- **Server Mirror** (`momomemory/momo`): Core Rust server
- **SDK Mirror** (`momomemory/sdk-typescript`): TypeScript SDK
- **Plugin Mirrors** (`momomemory/opencode-momo`, `momomemory/openclaw-momo`, `momomemory/pi-momo`)

Changes are made in the monorepo and pushed to mirrors using `just subrepo-push`.

---

## Release Commands

Use the `justfile` recipes to release components:

### Server Release

```bash
just release-momo 0.3.1
```

This will:
1. Bump `momo/Cargo.toml` version
2. Commit and push to monorepo
3. Push to server mirror (`momomemory/momo`)
4. Create tag `v0.3.1` on the mirror repo

### SDK Release

```bash
just release-sdk-ts 0.3.0
```

### Plugin Releases

```bash
just release-plugin-opencode 0.1.4
just release-plugin-openclaw 0.1.1
just release-plugin-pi 0.1.3
```

---

## Published Artifacts

Published artifacts are defined by each mirror repository's release workflow.

- Server mirror releases may attach binaries, checksums, and container images.
- SDK and plugin mirrors publish npm packages from their own release automation.
- Check the mirror repository for the exact artifacts produced by a given release.

---

## Versioning Policy

- Follow [Semantic Versioning 2.0](https://semver.org/).
- Source of truth: `Cargo.toml` or `package.json` `version` field.
- Mirror tags use `v{version}` format (e.g., `v0.3.1`).
- Pre-release versions (`-alpha`, `-beta`, `-rc.N`) are supported.
- Docker tag `latest` only updates on stable (non-pre-release) tags.

---

## Mirror Release Flow

Each mirror repo owns its release workflow and is triggered after the `just release-*` command pushes code and creates a `v*` tag on that mirror:

1. **Tag created** via `just release-*` command
2. **Mirror workflow** runs in the target mirror repository
3. **Artifacts and publishing** are handled by that mirror's CI configuration
4. **npm publish** for SDKs and plugins is handled in the mirror repo via OIDC Trusted Publishing

Example for the server:
```
just release-momo 0.3.1
    → updates momo/Cargo.toml
    → commits "chore(momo): bump version to 0.3.1"
    → pushes to monorepo
    → pushes subrepo to momomemory/momo
    → creates tag v0.3.1 on mirror
    → mirror CI builds and releases
```

---

## Future Enhancements

| Enhancement                               | Effort | When to Add                         |
| ----------------------------------------- | ------ | ----------------------------------- |
| `release-please` for automated changelogs | Low    | When commit volume justifies it     |
| `cargo-release` for version bumps         | Low    | When manual bumps become tedious    |
| Windows binary                            | Medium | When there's user demand            |
| Crates.io publish                         | Low    | If/when the crate becomes a library |
| Cosign/Sigstore signing                   | Low    | When supply-chain security matters  |
| SBOM generation                           | Medium | For enterprise/compliance users     |
