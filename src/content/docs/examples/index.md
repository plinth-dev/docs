---
title: Examples
description: Worked examples — full, running modules built on Plinth that you can clone, run, and read end-to-end.
sidebar:
  label: Overview
  order: 1
---

Worked examples are full, running modules — not snippets. Each one is small enough to read end-to-end in an hour and exercises real Plinth surface area: SDK packages, the substrate, the CLI scaffolding flow.

## Available

| Example | What it shows |
| --- | --- |
| [Access requests](/examples/access-requests/) | Engineer requests temporary production access; an approver decides; every state change is audited. Exercises every Plinth SDK at once. |

## Roadmap

| Example | What it will show |
| --- | --- |
| Feature flags | Toggleable flags with audit log, role-gated mutation, and a public read-API. |
| Invoice approval | Multi-step approval workflow demonstrating the optional Temporal sub-chart. |
| On-call directory | Read-mostly catalog with team-scoped writes. |

These ship as separate `plinth-dev/example-*` repos, each scaffolded with `plinth new` and adapted from there. If you want one of these prioritised, file an issue at [github.com/plinth-dev/example-access-requests](https://github.com/plinth-dev/example-access-requests/issues) — happy to take requests.
