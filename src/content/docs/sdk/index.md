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
| `audit` | Emit CloudEvents-shaped audit events to a pluggable transport (NATS by default). |
| `authz` | Cerbos PDP client wrapper with explicit `Decision` and fail-closed semantics. |
| `errors` | Typed error vocabulary; sentinel errors via `errors.Is`; RFC 7807 mapping. |
| `health` | Dependency probe registry with parallel execution and per-dep status JSON. |
| `otel` | OpenTelemetry SDK initialisation with standard resource attributes. |
| `paginate` | Cursor + offset pagination types and parsers; allow-list-based sort safety. |
| `vault` | Secret reader: `/run/secrets/<name>` first, env var fallback, in-memory cache. |

## TypeScript — `@plinth-dev/*`

| Package | Responsibility |
| --- | --- |
| `authz-react` | React `<PermissionsProvider>` + `usePermissions()` + `<Can>`; batched-check-at-layout pattern. |
| `api-client` | Typed server-only fetch wrapper; never throws on HTTP errors; retries on 5xx/429. |
| `authz` | Server-only Cerbos gRPC wrapper; mirrors the Go SDK semantics. |
| `otel-web` | Browser OpenTelemetry SDK init with auto-instrumentations. |
| `forms` | Server-action forms with Zod validation; `<FormWrapper>` + `<FormField>`. |
| `tables` | Headless data tables with URL state via `nuqs`. |
| `env` | Zod-schema-validated env vars; fail-fast at module load. |

## Status

**Phase B in progress.** Per-package design ADRs land here as the API surfaces are locked. The first four are drafts (the load-bearing fail-closed authorization stack and the typed-error vocabulary):

- [`sdk-go/authz`](/sdk/go/authz/) — Cerbos PDP client, fail-closed `Decision`, batched checks
- [`sdk-go/errors`](/sdk/go/errors/) — sentinel errors + RFC 7807 problem+json middleware
- [`@plinth-dev/authz`](/sdk/ts/authz/) — server-only TypeScript mirror of `sdk-go/authz`
- [`@plinth-dev/authz-react`](/sdk/ts/authz-react/) — client-side `<PermissionsProvider>`, `usePermissions()`, `<Can>`

See the [roadmap](https://github.com/plinth-dev/.github/blob/main/ROADMAP.md) for the rest.
