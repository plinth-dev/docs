---
title: Examples
description: Tiny modules that exercise different surface areas of the Plinth SDK and substrate.
sidebar:
  label: Overview
  order: 1
---

Three minimum-viable modules ship with the docs site to demonstrate the platform in use. Each is a real, running module; each is small enough to read end-to-end in 30 minutes.

| Example | What it shows |
| --- | --- |
| `counter` | The smallest possible module — local state, no platform deps. Useful for "is the substrate up?" |
| `todo` | CRUD with auth + audit. The "hello world" of internal tooling. |
| `approvals` | Adds [Temporal](https://temporal.io) back into the stack. Demonstrates the optional-substrate-component pattern. |

## Status

Examples land in Phase F. Until then, the [`starter-web`](https://github.com/plinth-dev/starter-web) and [`starter-api`](https://github.com/plinth-dev/starter-api) repos contain the canonical Items example end-to-end.
