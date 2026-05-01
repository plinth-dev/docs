---
title: "@plinth-dev/api-client — server-only typed fetch wrapper"
description: Named API registry, typed responses, retries on 5xx/429 with backoff, abort-signal propagation. Never throws on HTTP errors — returns ApiResponse with success bool. Server-only.
sidebar:
  label: api-client (server)
  order: 3
---

> **Status: Draft.** Targeting `0.1.0` once Husham approves.
> Package (target): `@plinth-dev/api-client` on npm.

## Responsibility

The HTTP client every Next.js Server Component and server action uses to call backend APIs. Maintains a registry of named APIs (each with its own base URL, auth, retry policy), returns a typed `ApiResponse<T>` where `success` is the only flag the caller branches on, and never throws on HTTP errors.

## API surface

```ts
import "server-only";

export interface ApiResponse<T> {
  data: T | null;
  success: boolean;
  error: ApiError | null;
  meta: {
    status: number;
    traceId?: string;
    requestId?: string;
  };
}

export interface ApiError {
  status: number;
  code: string; // matches sdk-go/errors Code: "not_found" | "validation" | ...
  message: string;
  fields?: Record<string, string>; // validation only
}

export interface ApiConfig {
  baseUrl: string;
  defaultHeaders?: Record<string, string>;
  // Adds Authorization header per request. Called with the request context;
  // typically reads the JWT from the Next.js cookies/session.
  authHeader?: () => Promise<string | null>;
  timeoutMs?: number; // default 30_000
  retry?: {
    count: number; // default 2 retries
    backoffMs: number; // initial delay; doubles each retry
    onStatuses?: number[]; // default [502, 503, 504, 429]
  };
}

export function register(name: string, config: ApiConfig): void;

export interface ApiClient {
  get<T>(path: string, init?: RequestInit): Promise<ApiResponse<T>>;
  post<T>(path: string, body?: unknown, init?: RequestInit): Promise<ApiResponse<T>>;
  put<T>(path: string, body?: unknown, init?: RequestInit): Promise<ApiResponse<T>>;
  patch<T>(path: string, body?: unknown, init?: RequestInit): Promise<ApiResponse<T>>;
  delete<T>(path: string, init?: RequestInit): Promise<ApiResponse<T>>;
}

// api(name) is the entry point. Throws synchronously if name is unregistered
// (this is a programmer error; surface it loudly).
export function api(name: string): ApiClient;

// Convenience for server-side data fetching with React's `cache` for request
// deduplication within a render.
export function cachedGet<T>(
  apiName: string,
  path: string,
  init?: RequestInit,
): Promise<ApiResponse<T>>;
```

### Behaviour

- **`server-only` enforcement.** Importing from a `"use client"` module is a build error. The auth header reader and timeout management are server-side concerns.
- **Never throws on HTTP errors.** A 404, 500, network failure, timeout — all return `{ success: false, error: {...}, data: null, meta: {...} }`. The caller writes one branch.
- **Auto-parses RFC 7807 problem+json.** When the response Content-Type is `application/problem+json` (the shape `sdk-go/errors`'s middleware produces), `error.code`, `error.message`, `error.fields` are populated from the body. Other error responses get `{ code: "unknown", message: <body text> }`.
- **Retries on 5xx + 429 with exponential backoff.** Default: 2 retries, 100ms initial, doubling. POST/PUT/PATCH/DELETE retry only when the request is idempotent — controlled via the `Idempotency-Key` request header (caller's choice; we don't generate keys for them).
- **Abort propagation.** If `init.signal` is provided, it cascades through the retry chain. Server-component cancellation (Next.js's request abort) thus actually cancels in-flight retries.
- **Trace propagation.** The current OTel span ID is injected as `traceparent` header. Backend handlers (using `sdk-go/otel`) pick it up and the trace is unbroken end-to-end.
- **Deduplication via React's `cache`.** `cachedGet` wraps `api(name).get(...)` with React's per-render cache so the same request issued from multiple Server Components in one render hits the network once.

### Usage

```ts
// app/api-clients.ts — registered once at module init
import { register } from "@plinth-dev/api-client";
import { cookies } from "next/headers";

register("items-api", {
  baseUrl: process.env.ITEMS_API_URL!,
  authHeader: async () => {
    const session = (await cookies()).get("session")?.value;
    return session ? `Bearer ${session}` : null;
  },
  timeoutMs: 10_000,
});
```

```tsx
// app/(module)/items/[id]/page.tsx
import { api } from "@plinth-dev/api-client";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const res = await api("items-api").get<Item>(`/items/${id}`);

  if (!res.success) {
    if (res.error!.code === "not_found") notFound();
    throw new Error(res.error!.message); // surfaces in error.tsx
  }

  return <ItemView item={res.data!} />;
}
```

## Why this shape

- **Never throws.** Throwing on HTTP errors is the JS-fetch trap that produces try/catch + `if (!res.ok)` boilerplate everywhere. One return shape, one branch, full stop.
- **Named registry.** Centralizes config (base URL, auth, timeouts) so the call site is just `api("foo").get(...)`. Otherwise every call site reconstructs config or imports a singleton, both fragile.
- **Auto-parses problem+json.** The Plinth backend produces this shape; the client speaks the same dialect natively. No per-call response shaping.
- **`server-only` boundary.** Auth header reading uses `next/headers` cookies — only valid server-side. Marking the module enforces the boundary at build time.
- **Idempotency-Key as opt-in.** Auto-generating idempotency keys feels nice but quietly converts non-idempotent operations into possibly-double-applied. Caller decides.

## Boundaries

- **Does not run in the browser.** That's TanStack Query's job (or `fetch` directly). Server Components → this client; client components → TanStack Query.
- **Does not transform request/response bodies beyond JSON.** No camelCase ↔ snake_case mapping, no Date hydration. Modules use Zod parsers explicitly.
- **Does not cache responses across requests.** Use Next.js's `unstable_cache` or React's `cache` for that. This client is request-scoped.
- **Does not refresh expired auth tokens.** The `authHeader` callback is called on each request; if it returns an expired token, the API responds 401 and the client surfaces it. Token refresh is the auth layer's job.

## Alternatives considered

| Alternative | Why rejected |
|---|---|
| `axios` directly | Throws on HTTP errors by default; works around it via interceptors that everyone configures slightly differently. The wrapper produces consistency. |
| Generic `httpClient.fetch(...)` returning the raw `Response` | Pushes parsing, retry, error-shape concerns to every caller. Defeats the point. |
| OpenAPI codegen (typed clients per endpoint) | Couples client to spec changes; adds a build step. The `<T>` generic with hand-written types is enough at our scale and lets us iterate quickly. |
| Auto-generate idempotency keys (UUID per non-GET) | Silently converts intent; if a POST fails after server processed it, retry would NOT trigger because the server returned a duplicate-key response — which is a different correctness issue. Opt-in is right. |

## Cross-references

- Backend pairs with `sdk-go/errors`'s `HTTPMiddleware` — the problem+json shape this client parses.
- `sdk-go/paginate`'s `Page[T]` is a common response type; callers do `api(...).get<Page<Item>>(...)`.
- For client-side queries (in `"use client"` components), use [TanStack Query](https://tanstack.com/query) directly — `@plinth-dev/api-client` doesn't try to be both.
- `@plinth-dev/forms` server actions internally use this client to call the backend; that's the integration point.
