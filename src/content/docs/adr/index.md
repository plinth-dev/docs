---
title: Architecture decision records
description: The decisions that shaped Plinth, recorded in the format they were made.
sidebar:
  label: Overview
  order: 1
---

ADRs record the **non-obvious** decisions: choices where reasonable people would disagree, where the alternative is documented in `ARCHITECTURE.md` as a fallback, or where a future maintainer might want to revisit the trade-off.

We use [Michael Nygard's format](https://github.com/joelparkerhenderson/architecture-decision-record/blob/main/locations/nygard/index.md): Title · Status · Context · Decision · Consequences.

## Index

Phase F lands the first set of ADRs:

- **0001** — Why fail-closed Cerbos
- **0002** — Why Talos Linux
- **0003** — Why split the TS SDK into multiple packages
- **0004** — Why Temporal is opt-in, not default
- **0005** — Why MIT (not AGPL/Apache) — invitation, not stance
- **0006** — Why chi over Fiber
- **0007** — Why SigNoz over LGTM as default
- **0008** — Why Authentik over the Ory three-piece stack

Until they're written, the rationale lives inline in the [architecture overview](/architecture/) §8 (committed stack) and `PROJECT.md` §9 (risk register on stack choices).
