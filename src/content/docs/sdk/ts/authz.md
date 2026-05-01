---
title: "@plinth-dev/authz — server-only Cerbos client"
description: TypeScript mirror of sdk-go/authz. Server-only. Same fail-closed contract, same Decision shape, same batched-check semantics. Used by Next.js layouts to fetch permissions for a route in one round-trip.
sidebar:
  label: authz (server)
  order: 1
---

> **Status: Draft.** Targeting `0.1.0` once Husham approves.
> Package (target): `@plinth-dev/authz` on npm.

## Responsibility

The TypeScript counterpart of [`sdk-go/authz`](/sdk/go/authz/). Server-only Cerbos PDP client used by Next.js Server Components, server actions, and API route handlers. Mirrors the Go API surface deliberately — anyone fluent in one should be fluent in the other.

## API surface

```ts
// All exports below are server-only.
import "server-only";

export type Reason = "Allowed" | "Denied" | "Unreachable" | "Bypassed";

export interface Decision {
  allowed: boolean;
  reason: Reason;
  action?: string; // populated for diagnostics; "items:read"
}

export interface AuxData {
  jwt: string; // raw bearer token; passed through to Cerbos for $jwtClaims
}

export interface Principal {
  id: string;
  roles: string[];
  attributes?: Record<string, unknown>;
  auxData?: AuxData;
}

export interface Resource {
  kind: string;
  id: string;
  attributes?: Record<string, unknown>;
}

export interface ClientOptions {
  address: string;        // "cerbos:3593"
  tls?: boolean;          // default false
  logger?: Logger;        // defaults to console with structured shape
  envName?: string;       // defaults to process.env.NODE_ENV; "production" rejects bypass
}

export interface Logger {
  warn(msg: string, attrs?: Record<string, unknown>): void;
  error(msg: string, attrs?: Record<string, unknown>): void;
}

export class AuthzClient {
  constructor(opts: ClientOptions);
  close(): Promise<void>;

  // Fail-closed: any error path resolves with { allowed: false, reason: "Unreachable" }.
  // Never rejects.
  checkAction(p: Principal, r: Resource, action: string): Promise<Decision>;
  checkActions(p: Principal, r: Resource, actions: string[]): Promise<Record<string, Decision>>;

  // Convenience for the batched-check-at-layout pattern. Keys are bare actions.
  permissionMap(p: Principal, r: Resource, actions: string[]): Promise<Record<string, boolean>>;
}

// Singleton helper. Reads CERBOS_ADDRESS, CERBOS_TLS, CERBOS_ALLOW_BYPASS, NODE_ENV
// from process.env. Cached after first call.
export function getClient(): AuthzClient;

// Sentinel thrown by the constructor (synchronous), never by the check methods.
export class BypassInProductionError extends Error {}
```

### Behaviour

- **Server-only enforcement.** `import "server-only"` at the top of every file in this package. Importing from a `"use client"` module is a build error. This is the contract: all Cerbos calls happen on the server.
- **Fail-closed.** Same semantics as the Go SDK. Any failure (network, gRPC, timeout, abort) resolves with `{ allowed: false, reason: "Unreachable" }`. Methods never reject. The caller's `if (!d.allowed)` branch is the only path to consider.
- **Bypass mode.** `CERBOS_ALLOW_BYPASS=1` AND `envName !== "production"` returns `{ allowed: true, reason: "Bypassed" }`, with one `logger.warn` per call. `envName === "production"` makes `new AuthzClient(...)` throw `BypassInProductionError` synchronously at startup.
- **Logging.** `Unreachable` and `Bypassed` decisions log at `warn`. `Allowed` and `Denied` are not logged here — that's `@plinth-dev/api-client`'s job at the response boundary, or the audit pipeline.

### Layout integration pattern

```ts
// app/(module)/items/[id]/layout.tsx
import { getClient } from "@plinth-dev/authz";
import { PermissionsProvider } from "@plinth-dev/authz-react";
import { requireAuth } from "@/lib/auth";

export default async function Layout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const user = await requireAuth();
  const { id } = await params;

  // One gRPC round-trip for the whole route's permissions.
  const permissions = await getClient().permissionMap(
    { id: user.id, roles: user.roles, auxData: { jwt: user.token } },
    { kind: "Item", id },
    ["read", "update", "delete", "comment"],
  );

  return <PermissionsProvider permissions={permissions}>{children}</PermissionsProvider>;
}
```

This is the **batched-check-at-layout** pattern. Every component below this layout gets permissions from `usePermissions()` without any further round-trips.

## Why this shape

- **Mirrors Go deliberately.** `Decision`, `Reason`, `Principal`, `Resource` shape match `sdk-go/authz` field-for-field. A reader fluent in one is fluent in the other; documentation can cross-reference.
- **`Promise<Decision>` not `Promise<Decision \| Error>`.** Same reasoning as the Go SDK: never reject. The caller writes `if (!d.allowed)` once. There is no other failure mode to handle.
- **`getClient()` singleton.** Server-side modules need exactly one connection per process. The singleton avoids an init step in every server component while remaining replaceable in tests (you can construct `new AuthzClient(...)` directly).
- **`server-only` import.** This is a real failure mode in Next.js — accidentally pulling a server module into a client component leaks gRPC libs, secrets, and possibly the Cerbos client config into the browser bundle. The marker prevents it at build time.
- **`permissionMap` returns `Record<string, boolean>`, not `Record<string, Decision>`.** That's specifically the shape `@plinth-dev/authz-react`'s `<PermissionsProvider>` consumes. Keeping the wire format minimal (the boolean is what client cares about) reduces the layout's render payload by ~5x.

## Boundaries

- **Does not load policies.** Same as Go SDK.
- **Does not cache decisions.** Same as Go SDK.
- **Does not run in the browser.** `server-only` import enforces this. `@plinth-dev/authz-react` is the client-side complement.
- **Does not validate JWTs.** Just propagates the raw token.
- **Does not emit audit.** Audit is the handler's job (and a separate package, `@plinth-dev/audit` — TBD whether we ship a TS audit package or leave audit emission to the API server).

## Alternatives considered

| Alternative | Why rejected |
|---|---|
| Make this isomorphic (same package usable in browser) | Defeats the purpose. Cerbos talks gRPC; the browser can't. The right model is server-side decisions, propagated to the client as a permissions map. |
| Use Cerbos's REST API instead of gRPC | gRPC is what's officially supported; REST is a wrapper. We pay a small dep cost for grpc-js but get streaming, retries, and a stable proto contract. |
| Return throwing API (`throw NotAllowed`) for ergonomics with try/catch | Conflates "user lacks permission" with "PDP exploded". The whole audit point is to distinguish them. |
| Separate `Decision` types for action vs batch (DecisionList<T>) | Adds generic noise without payoff; batched returns a `Record<string, Decision>` because that's what callers want to spread or destructure. |

## Cross-references

- [`sdk-go/authz`](/sdk/go/authz/) — the Go counterpart, designed in lockstep.
- [`@plinth-dev/authz-react`](/sdk/ts/authz-react/) — consumes the `PermissionMap` shape from this package.
- [`@plinth-dev/api-client`](/sdk/ts/api-client/) — server-only HTTP client; pairs with this for backend-API authorization.
