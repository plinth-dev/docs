---
title: SDK design
description: API surface design notes for the Plinth Go and TypeScript SDKs.
sidebar:
  label: Overview
  order: 1
---

The Plinth SDK is two language families that encode the platform contracts. Modules `import` instead of `cp -r`. Each package below is independently versioned, semver-tagged, and published to its native registry.

## Go — `github.com/plinth-dev/sdk-go/*`

All seven packages are tagged `v0.1.0` and importable today via `go get github.com/plinth-dev/sdk-go/<pkg>@v0.1.0`.

| Package | Status | Responsibility |
| --- | --- | --- |
| [`authz`](/sdk/go/authz/) | *v0.1.0* | Cerbos PDP client wrapper with explicit `Decision` and fail-closed semantics. |
| [`errors`](/sdk/go/errors/) | *v0.1.0* | Typed error vocabulary; sentinel errors via `errors.Is`; RFC 7807 mapping. |
| [`audit`](/sdk/go/audit/) | *v0.1.0* | Emit CloudEvents-shaped audit events to a pluggable transport (NATS by default). Non-blocking. |
| [`health`](/sdk/go/health/) | *v0.1.0* | Dependency probe registry with parallel execution and per-dep status JSON. |
| [`otel`](/sdk/go/otel/) | *v0.1.0* | OpenTelemetry SDK initialisation with standard resource attributes. |
| [`paginate`](/sdk/go/paginate/) | *v0.1.0* | Cursor + offset pagination types and parsers; allow-list-based sort safety. |
| [`vault`](/sdk/go/vault/) | *v0.1.0* | Secret reader: `/run/secrets/<name>` first, env var fallback, in-memory cache. |

## TypeScript — `@plinth-dev/*`

All seven packages are published to npm at `0.1.0` and installable via `pnpm add @plinth-dev/<pkg>`.

| Package | Status | Responsibility |
| --- | --- | --- |
| [`authz`](/sdk/ts/authz/) | *0.1.0 on npm* | Server-only Cerbos gRPC wrapper; mirrors the Go SDK semantics. |
| [`authz-react`](/sdk/ts/authz-react/) | *0.1.0 on npm* | React `<PermissionsProvider>` + `usePermissions()` + `<Can>`; batched-check-at-layout pattern. |
| [`api-client`](/sdk/ts/api-client/) | *0.1.0 on npm* | Typed server-only fetch wrapper; never throws on HTTP errors; retries on 5xx/429. |
| [`forms`](/sdk/ts/forms/) | *0.1.0 on npm* | Server-action forms with Zod validation; `<FormWrapper>` + `<FormField>`. |
| [`tables`](/sdk/ts/tables/) | *0.1.0 on npm* | Headless data tables with URL state via `nuqs`. |
| [`otel-web`](/sdk/ts/otel-web/) | *0.1.0 on npm* | Browser OpenTelemetry SDK init with auto-instrumentations. |
| [`env`](/sdk/ts/env/) | *0.1.0 on npm* | Zod-schema-validated env vars; fail-fast at module load. |

## Where to start

The four most load-bearing packages — read these first if you only read four:

- [`sdk-go/authz`](/sdk/go/authz/) and [`@plinth-dev/authz`](/sdk/ts/authz/) — fail-closed Cerbos clients designed in lockstep
- [`@plinth-dev/authz-react`](/sdk/ts/authz-react/) — the client-side companion (batched-check-at-layout)
- [`sdk-go/errors`](/sdk/go/errors/) — the wire-stable error vocabulary every backend speaks

API contracts are frozen for the 0.x line; breaking changes batch into 0.2.0. See the [v0.1.0 launch](/launch/v0-1-0/) for a full ship list.
