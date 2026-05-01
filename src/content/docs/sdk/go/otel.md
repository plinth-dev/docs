---
title: "sdk-go/otel — OpenTelemetry SDK initialisation"
description: One-call setup for traces and metrics with standard Plinth resource attributes. OTLP/HTTP by default, configurable to gRPC. Returns a shutdown function the caller defers.
sidebar:
  label: otel
  order: 5
---

> **Status: Draft.** Targeting `v0.1.0` once Husham approves.
> Module path (target): `github.com/plinth-dev/sdk-go/otel`.

## Responsibility

Configure the global OpenTelemetry tracer and meter providers with the resource attributes Plinth expects (`service.name`, `service.version`, `module.name`, `deployment.environment`, plus Cluster-level attributes injected via the OTel collector). One Init call in `main()`; one defer of the returned shutdown.

## API surface

```go
package otel

import (
    "context"
    "log/slog"
)

type Options struct {
    ServiceName    string  // required; "items-api"
    ServiceVersion string  // required; from build-time ldflags
    Environment    string  // "production" | "staging" | "dev" — defaults to os.Getenv("ENV")
    ModuleName     string  // the Plinth module name; "items"

    // Exporter target. Defaults to http://otel-collector.observability:4318
    // (the in-cluster OTel collector address from the platform chart).
    ExporterEndpoint string
    ExporterProtocol string // "http" (default) | "grpc"
    ExporterHeaders  map[string]string // for hosted backends or auth

    // Sampling. Defaults: 1.0 in dev, 0.1 in staging, 0.05 in production.
    // Override via OTEL_TRACES_SAMPLER_ARG.
    TracesSamplerArg float64

    Logger *slog.Logger // defaults to slog.Default()
}

// Init configures OTel globals and returns a shutdown closure.
// Standard usage:
//   shutdown, err := otel.Init(ctx, opts)
//   if err != nil { log.Fatal(err) }
//   defer func() { _ = shutdown(context.Background()) }()
func Init(ctx context.Context, opts Options) (shutdown func(context.Context) error, err error)

// RecordError tags the current span with the error and sets status to Error.
// Convenience over the verbose otel/codes + otel/attribute incantation.
func RecordError(ctx context.Context, err error)

// AttrModule returns the module-name attribute for manual span tagging.
func AttrModule(name string) attribute.KeyValue

// HTTPMiddleware wraps net/http handlers with OTel auto-instrumentation
// (replaces the verbose otelhttp.NewMiddleware boilerplate). Adds Plinth
// route-attribute conventions (matched route, response code class).
func HTTPMiddleware(next http.Handler, options ...HTTPOption) http.Handler

type HTTPOption func(*httpConfig)

func WithRouteFromContext() HTTPOption // pulls chi-style routes out of context for span name
```

### Behaviour

- **Resource attributes set automatically.** `service.name`, `service.version`, `service.instance.id` (from hostname), `deployment.environment`, `module.name` (the Plinth module name), `telemetry.sdk.*`, plus anything in the `OTEL_RESOURCE_ATTRIBUTES` env var.
- **Parent-based + ratio sampler.** Trace decisions inherit the parent if propagated, otherwise sample at `TracesSamplerArg`. Lets gateway-side decisions cascade.
- **Shutdown drains exporters.** Calling the returned shutdown function blocks for up to 5s while OTLP batches flush. Caller passes `context.Background()` (not a cancelled ctx) so the drain isn't truncated.
- **Graceful degradation if the collector is unreachable.** Init does not return an error if the exporter can't reach the endpoint at startup — it logs a warning and lets the app boot. OTel SDK retries internally; spans queue and drop on overflow with metrics.

## Why this shape

- **Init returns a shutdown, not a typed provider.** Modules don't need direct access to the providers — they use the global tracer via `otel.Tracer("module-name")`. Shutdown is the only thing the caller needs to keep around.
- **OTLP/HTTP default over gRPC.** HTTP is more firewall-friendly, simpler to debug with curl, and the perf delta vs. gRPC is negligible at internal-tooling scales. Apps with extreme telemetry volume can switch to gRPC.
- **Parent-based sampler.** Otherwise the gateway samples a trace, the API doesn't, and the trace looks broken in SigNoz. Parent-based fixes that.
- **`HTTPMiddleware` is a thin wrapper, not a re-implementation.** otel-go's `otelhttp` is fine; we wrap to add Plinth conventions (resource attributes, chi-route extraction) without forcing every module to assemble it.

## Boundaries

- **Does not export logs.** OTel logs are still beta; `slog` with a structured-JSON handler is what modules use, shipped to OpenSearch / SigNoz separately.
- **Does not auto-instrument anything beyond `otelhttp`.** Database tracing (pgx hooks), Redis tracing, etc. are opt-in per call site — auto-instrumenting everything inflates trace volume and costs.
- **Does not replace `/metrics` endpoints.** OTel metrics go to the collector; Prometheus-pull `/metrics` (via expvar or prometheus client) is a separate concern for ops who prefer pull.
- **Does not generate IDs in a custom format.** OTel-spec IDs only. No `module-prefix-traceid` shenanigans.

## Alternatives considered

| Alternative | Why rejected |
|---|---|
| Direct gRPC export, no HTTP | Worse firewall ergonomics, marginal perf win at our scale. HTTP wins at internal-tooling scale. |
| AlwaysOn sampler in dev, AlwaysOff in prod | Loses prod traces entirely. Ratio sampler with low rate gives prod data without overflow. |
| Auto-instrument pgx via the global hook | Inflates trace volume; many DB calls aren't useful as spans. Per-call-site instrumentation is more targeted. |
| Re-export traces to Jaeger directly (skip collector) | Couples SDK to backend. The collector pattern lets ops swap backends without touching modules. |

## Cross-references

- `sdk-go/audit` reads the trace ID from context to populate `Event.TraceID`.
- `sdk-go/errors` reads the trace ID for `Problem.TraceID` in the RFC 7807 response.
- `sdk-go/authz` does not import this directly — it logs via `slog`. But every authz call site that wants a span should be wrapped in one by the caller.
- The platform chart's OTel collector deployment (Phase D) terminates OTLP/HTTP at port 4318 inside the cluster.
- `@plinth-dev/otel-web` is the browser-side counterpart (separate ADR).
