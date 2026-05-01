---
title: Plinth
description: An open-source platform foundation for enterprise teams running fleets of internal-tooling modules.
template: splash
hero:
  title: |
    The load-bearing base for <em>enterprise internal tooling</em>.
  tagline: A substrate, an SDK, a scaffolder. Six commitments. One Helm install. Modules grow on top — so each one isn't the platform's weakest link.
  actions:
    - text: Read the manifesto
      link: /manifesto/
      variant: primary
    - text: Try it in 60 minutes
      link: /start/try-it/
      variant: minimal
    - text: Architecture
      link: /architecture/
      variant: minimal
---

:::tip[v0.1.0 just shipped]
A working SDK across Go and TypeScript, two starters, a CLI, a Backstage scaffolder, a Helm chart, and a worked example — all stable, all open. Read the [launch announcement](/launch/v0-1-0/).
:::

## What Plinth gives a team

A fleet of internal applications — project management, change requests, audit dashboards, HR tooling, internal admin — sharing one substrate, one SDK, one scaffolder. Modules import the platform; they don't re-implement it.

- **Substrate.** A Helm umbrella chart that brings up the entire reference architecture on a fresh Kubernetes cluster. Identity, authorization, secrets, data, observability, security, GitOps, dev portal — one `helm install`.
- **SDK.** Versioned Go and TypeScript packages encoding the platform contracts: fail-closed Cerbos client, audit publisher, OTel wiring, typed errors, healthcheck, server-action forms. Imported, not copy-pasted.
- **Scaffolder.** A CLI (`plinth new <module>`) and a Backstage software template. Five minutes from idea to deployed-in-dev.
- **Manifesto.** Six commitments — zero standing trust, GitOps everything, immutable infrastructure, durable workflows, evidence by default, open source first. The opinions that shape every default.

## Who it's for

Organisations that run **multiple internal-facing modules**, operate in a **regulated context** (banking, finance, insurance, healthcare, government), prefer **on-premise or private-cloud** deployment, and have a **small platform team** supporting a much larger app-developer audience.

Not for single-product startups, cloud-native teams already happy with managed services, or teams uncomfortable operating Kubernetes.

## Where to go next

- **New here?** Read the [manifesto](/manifesto/) and the [architecture overview](/architecture/).
- **Curious how the substrate fits together?** Open the [interactive explorer](/explorer.html).
- **Building modules on Plinth?** Start with the [SDK design docs](/sdk/).
- **Standing it up?** Follow the [60-minute tutorial](/start/try-it/).
