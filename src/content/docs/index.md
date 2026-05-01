---
title: Plinth
description: An open-source platform foundation for organisations running fleets of internal-tooling modules at regulated companies.
template: splash
hero:
  title: |
    A platform foundation for <em>internal&#8209;tooling fleets</em>.
  tagline: Plinth is an open-source platform for organisations that operate fleets of internal-tooling modules at regulated companies — banks, insurers, healthcare, government. A substrate, an SDK, a scaffolder. One Helm install. Modules grow on top.
  actions:
    - text: Open Plinth Sketch
      link: /tools/sketch/
      variant: primary
    - text: Read the manifesto
      link: /manifesto/
      variant: minimal
    - text: View on GitHub
      link: https://github.com/plinth-dev
      variant: minimal
---

You run a fleet of internal applications — project management, change requests, audit dashboards, HR tooling, internal admin. Modules that began as starters and grew. Every one re-implements the same plumbing: identity, authorisation, audit, observability, deployment. Every one inherits the same gaps: a session secret committed in `.env.example`, an authorisation layer that fails open in dev mode, no real healthcheck, no centralised logs.

Plinth is the foundation those modules should have stood on from day one. *A substrate, an SDK, a scaffolder* — assembled into something a small platform team can deploy, and let dozens of modules grow on top of without each one becoming the platform's weakest link.

## Who it's for

Organisations that run **multiple internal-facing modules**, operate in a **regulated context** (banking, finance, insurance, healthcare, government), prefer **on-premise or private-cloud** deployment, and have a **small platform team** supporting a much larger app-developer audience.

Not for single-product startups, cloud-native teams already happy with managed services, or teams uncomfortable operating Kubernetes.

## What's shipped

| Repository | What it is | Install |
|---|---|---|
| `platform` | Helm umbrella chart. CloudNativePG, Cerbos, OpenTelemetry Collector. Walking-skeleton dev profile. | `git clone && helm install` |
| `sdk-go` (×7) | Fail-closed authz, non-blocking audit, OTel init, RFC 7807 errors, paginate, vault, health. | `go get …/sdk-go/<pkg>@v0.1.0` |
| `sdk-ts` (×7) | env, api-client, authz, authz-react, forms, otel-web, tables. | `pnpm add @plinth-dev/<pkg>` |
| `starter-api` | chi + pgx, every Go SDK pre-wired into one running service. | `git clone` |
| `starter-web` | Next.js 16 + React 19, every TypeScript SDK pre-wired into one app. | `git clone` |
| `cli` | `plinth new` — scaffold both starters with identifiers rewritten. | `go install …/cli/cmd/plinth@v0.1.1` |
| `scaffolder` | Backstage software template emitting the same output as the CLI. | `pnpm add @plinth-dev/scaffolder-actions` |
| `example-access-requests` | Worked internal-tool: temp-prod-access requests with approver workflow. | `git clone` |
| `sketch` | DSL → typeset SVG architecture diagrams. CLI + GitHub Action. | `npm i @plinth-dev/sketch` |

Eight repositories, all v0.1.0, all MIT.

## Where to go next

- **Curious about the opinions?** [Read the manifesto](/manifesto/) — six commitments that shape every default.
- **Want to see the architecture?** [Architecture overview](/architecture/) and the [interactive explorer](/explorer.html).
- **Building on Plinth?** Start with the [SDK design docs](/sdk/).
- **Try the tools** — [Plinth Sketch](/tools/sketch/) is live in your browser, no signup.
- **Standing the platform up?** Follow the [tutorial](/start/try-it/).
