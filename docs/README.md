# Momo Documentation Site

This directory contains the Astro + Starlight documentation site for Momo.

## Commands

Run these from `docs/`:

| Command | Action |
| :------ | :----- |
| `bun run dev` | Start the local docs site |
| `bun run build` | Build the site to `dist/` |
| `bun run preview` | Preview the production build |

## Structure

- `src/pages/index.astro`: Landing page at `/`
- `src/content/docs/`: Starlight content served under `/docs/`
- `astro.config.mjs`: Starlight config and sidebar setup
