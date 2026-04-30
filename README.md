# Plinth docs

Source for the Plinth documentation site at [**plinth.run**](https://plinth.run).

Built with [Astro](https://astro.build) + [Starlight](https://starlight.astro.build). Deployed to GitHub Pages on every push to `main`.

## Local development

```bash
pnpm install
pnpm dev          # http://localhost:4321
pnpm build        # produces dist/
pnpm check        # astro + typescript checks
pnpm lint         # biome
```

## Structure

```
src/
├── assets/                 # Logo, theme tweaks
├── content/docs/
│   ├── index.md            # Landing
│   ├── manifesto.md        # The six commitments
│   ├── architecture.md     # Substrate technical reference
│   ├── start/              # Tutorials
│   ├── sdk/                # SDK design ADRs
│   ├── examples/           # Sample modules
│   └── adr/                # Architecture decision records
└── content.config.ts       # Starlight content collections

public/
├── CNAME                   # plinth.run
├── explorer.html           # Interactive companion to architecture.md
└── favicon.svg
```

## Editing

- **Add a page**: drop a `.md` or `.mdx` file under `src/content/docs/`. Pages with `autogenerate` parents (`sdk/`, `examples/`, `adr/`) appear in the sidebar automatically.
- **Add an ADR**: create `src/content/docs/adr/NNNN-title.md` using the [ADR template](https://github.com/joelparkerhenderson/architecture-decision-record).
- **Update the architecture page**: edit `src/content/docs/architecture.md` directly. The interactive explorer at `/explorer.html` is a static asset — keep it in sync if you change the architecture.

## License

MIT — see [LICENSE](./LICENSE).
