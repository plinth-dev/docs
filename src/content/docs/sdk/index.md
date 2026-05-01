---
title: SDK design
description: API surface design notes for the Plinth Go and TypeScript SDKs.
sidebar:
  label: Overview
  order: 1
---

The Plinth SDK is two language families that encode the platform contracts. Modules `import` instead of `cp -r`. Each package below is independently versioned, semver-tagged, and published to its native registry.

## Go — `github.com/plinth-dev/sdk-go/*`

| Package | Responsibility |
| --- | --- |
| [`authz`](/sdk/go/authz/) | Cerbos PDP client wrapper with explicit `Decision` and fail-closed semantics. |
| [`errors`](/sdk/go/errors/) | Typed error vocabulary; sentinel errors via `errors.Is`; RFC 7807 mapping. |
| [`audit`](/sdk/go/audit/) | Emit CloudEvents-shaped audit events to a pluggable transport (NATS by default). Non-blocking. |
| [`health`](/sdk/go/health/) | Dependency probe registry with parallel execution and per-dep status JSON. |
| [`otel`](/sdk/go/otel/) | OpenTelemetry SDK initialisation with standard resource attributes. |
| [`paginate`](/sdk/go/paginate/) | Cursor + offset pagination types and parsers; allow-list-based sort safety. |
| [`vault`](/sdk/go/vault/) | Secret reader: `/run/secrets/<name>` first, env var fallback, in-memory cache. |

## TypeScript — `@plinth-dev/*`

| Package | Responsibility |
| --- | --- |
| [`authz`](/sdk/ts/authz/) | Server-only Cerbos gRPC wrapper; mirrors the Go SDK semantics. |
| [`authz-react`](/sdk/ts/authz-react/) | React `<PermissionsProvider>` + `usePermissions()` + `<Can>`; batched-check-at-layout pattern. |
| [`api-client`](/sdk/ts/api-client/) | Typed server-only fetch wrapper; never throws on HTTP errors; retries on 5xx/429. |
| [`forms`](/sdk/ts/forms/) | Server-action forms with Zod validation; `<FormWrapper>` + `<FormField>`. |
| [`tables`](/sdk/ts/tables/) | Headless data tables with URL state via `nuqs`. |
| [`otel-web`](/sdk/ts/otel-web/) | Browser OpenTelemetry SDK init with auto-instrumentations. |
| [`env`](/sdk/ts/env/) | Zod-schema-validated env vars; fail-fast at module load. |

## Where to start

The four most load-bearing packages — read these first if you only read four:

- [`sdk-go/authz`](/sdk/go/authz/) and [`@plinth-dev/authz`](/sdk/ts/authz/) — fail-closed Cerbos clients designed in lockstep
- [`@plinth-dev/authz-react`](/sdk/ts/authz-react/) — the client-side companion (batched-check-at-layout)
- [`sdk-go/errors`](/sdk/go/errors/) — the wire-stable error vocabulary every backend speaks

Implementation lands per-package, semver-tagged starting `v0.1.0`. See the [roadmap](https://github.com/plinth-dev/.github/blob/main/ROADMAP.md) for the current state.
