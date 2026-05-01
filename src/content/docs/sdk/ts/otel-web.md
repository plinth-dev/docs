---
title: "@plinth-dev/otel-web — browser OpenTelemetry SDK init"
description: One-call setup for browser-side traces with auto-instrumentations for fetch and document-load. OTLP/HTTP export to the cluster's OTel collector. Same resource-attribute conventions as the Go SDK.
sidebar:
  label: otel-web (client)
  order: 6
---

> **Status: Draft.** Targeting `0.1.0` once Husham approves.
> Package (target): `@plinth-dev/otel-web` on npm.

## Responsibility

Browser-side OpenTelemetry initialisation. Configures the WebTracerProvider with auto-instrumentations for `fetch` and `document-load`, exports via OTLP/HTTP to the in-cluster OTel collector, and applies the same resource-attribute conventions as `sdk-go/otel`. One client component in the root layout; everything downstream gets traced.

## API surface

```ts
"use client";

export interface OtelWebOptions {
  serviceName: string;       // matches the API's service.name; "items-web"
  serviceVersion: string;    // build-time
  moduleName: string;        // "items"
  environment: string;       // "production" | "staging" | "dev"

  // Defaults to the cluster's collector ingress; for local dev, set to
  // http://localhost:4318/v1/traces or omit to disable.
  exporterEndpoint?: string;

  // [0,1]; default: 0.05 in production, 0.5 in staging, 1.0 in dev.
  sampleRate?: number;

  // Adds extra resource attributes; merged with defaults.
  resourceAttributes?: Record<string, string>;

  // If true, instruments the user-interaction events (click, submit) — adds spans
  // for user actions. Default false (potentially privacy-sensitive).
  instrumentUserInteractions?: boolean;

  // If false (default), URLs in fetch spans have query strings + hashes redacted.
  // Set true only for debugging.
  retainFullUrls?: boolean;
}

export function initWebOtel(opts: OtelWebOptions): void;

// React component wrapper for the root layout. Calls initWebOtel once on mount.
export function OtelProvider(props: {
  options: OtelWebOptions;
  children: React.ReactNode;
}): JSX.Element;

// Manual-span helpers for events not covered by auto-instrumentation.
export function withSpan<T>(name: string, fn: () => T | Promise<T>): T | Promise<T>;
export function recordError(err: Error, attrs?: Record<string, string>): void;
```

### Behaviour

- **Initialised once.** Calling `initWebOtel` more than once is a no-op (logs a warning). The `<OtelProvider>` wrapper guards via a module-scoped boolean.
- **Auto-instrumentations.** `fetch` (every fetch becomes a span with method, URL pathname, response status, duration) and `document-load` (initial page-load timing breakdown). User-interaction instrumentation is opt-in.
- **Trace propagation to backend.** Fetch instrumentation injects W3C `traceparent` and `tracestate` headers into outgoing requests. Backend's `sdk-go/otel` reads them; the trace continues unbroken across the network.
- **OTLP/HTTP export.** Browser uses OTLP/HTTP via the official `@opentelemetry/exporter-trace-otlp-http`. Batches spans (4s flush interval, 100-span batch ceiling). Failed exports retry with backoff; queue overflows drop oldest with a console warning.
- **Privacy by default.** Fetch URLs have query string + fragment redacted (`https://api.example.com/users?token=secret` becomes `https://api.example.com/users`). Override with `retainFullUrls: true` for debugging only.
- **Sampler is parent-based.** If the page was loaded through a sampled trace (via the document-load span propagation), descendants inherit; otherwise sample at `sampleRate`.

### Usage

```tsx
// app/layout.tsx
import { OtelProvider } from "@plinth-dev/otel-web";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html>
      <body>
        <OtelProvider
          options={{
            serviceName: "items-web",
            serviceVersion: process.env.NEXT_PUBLIC_VERSION!,
            moduleName: "items",
            environment: process.env.NEXT_PUBLIC_ENV!,
            exporterEndpoint: process.env.NEXT_PUBLIC_OTEL_ENDPOINT,
          }}
        >
          {children}
        </OtelProvider>
      </body>
    </html>
  );
}
```

## Why this shape

- **One init, one provider.** Browser OTel has many moving parts (provider, processor, exporter, resource, sampler, propagator); we encapsulate the right defaults.
- **Same conventions as `sdk-go/otel`.** `service.name`, `service.version`, `module.name`, `deployment.environment` — identical resource attribute keys make backend and frontend traces correlate cleanly in SigNoz.
- **Privacy by default.** Tracing tokens-in-URLs into a centralized observability backend is a leak vector. Default-redact, opt-in for debugging, no surprises.
- **Auto-instrumentation for fetch only by default.** XHR is rare in 2026; user-interaction spans can be noisy and privacy-sensitive. Opt-in keeps the default trace stream clean.
- **OTLP/HTTP, not Jaeger or Zipkin direct.** Same reasoning as backend: the collector pattern lets ops swap backends without re-deploying frontends.

## Boundaries

- **Does not export browser logs.** OTel logs in the browser are still beta; `console.*` continues to be the JS-side logging surface, separately ingested if needed.
- **Does not export browser metrics.** Web Vitals are a different concern; if a module wants Core Web Vitals tracking, use `web-vitals` separately and decide where to send.
- **Does not run server-side.** This is `"use client"` only. Backend tracing is `sdk-go/otel`.
- **Does not handle session replay.** Session replay (Sentry, FullStory, etc.) is a separate product category; out of scope.
- **Does not auto-detect React component renders as spans.** That would inflate trace volume by 10-100x. Manual spans only for the renders that matter.

## Alternatives considered

| Alternative | Why rejected |
|---|---|
| Direct Jaeger / Zipkin exporter | Couples frontend to backend. The collector pattern is more portable. |
| Sentry SDK for tracing | Sentry is an APM; we already have SigNoz on the platform. Two APMs is one too many. |
| No SDK — let `next/observability` handle it | Currently doesn't propagate trace context to backend; misses the cross-stack stitching that's the whole point. |
| Default-on user-interaction instrumentation | Privacy concerns (button labels can carry PII), trace volume. Opt-in is right. |

## Cross-references

- `sdk-go/otel` is the backend counterpart; `traceparent` propagation stitches traces across the boundary.
- `@plinth-dev/api-client` calls fetch which is auto-instrumented here — no extra wiring.
- The platform's OTel collector deployment (Phase D) terminates browser-origin OTLP/HTTP at a public ingress (auth via the gateway).
