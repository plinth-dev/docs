---
title: "sdk-go/health — dependency probe registry"
description: Register named probes (Postgres ping, Cerbos check, HTTP GET, custom). Aggregates them in parallel into a /health endpoint that returns 200 when all pass and 503 when any fail.
sidebar:
  label: health
  order: 4
---

> **Status: Draft.** Targeting `v0.1.0` once Husham approves.
> Module path (target): `github.com/plinth-dev/sdk-go/health`.

## Responsibility

Build a meaningful `/health` endpoint. Modules register one probe per dependency (DB, Cerbos PDP, NATS, downstream HTTP services); the registry runs them in parallel on each request and reports per-dependency status.

## API surface

```go
package health

import (
    "context"
    "net/http"
    "time"
)

type Status string

const (
    StatusOK       Status = "ok"
    StatusDegraded Status = "degraded" // probe slow or returns "I'm alive but unhappy"
    StatusFailing  Status = "failing"
)

type Result struct {
    Name      string        `json:"name"`
    Status    Status        `json:"status"`
    LatencyMs int64         `json:"latency_ms"`
    Detail    string        `json:"detail,omitempty"`
}

// Probe is anything that knows how to check itself in bounded time.
type Probe interface {
    Name() string
    Check(ctx context.Context) Result
}

// Registry owns the probes and serves the /health response.
type Registry struct{ /* unexported */ }

func New(opts ...Option) *Registry

type Option func(*Registry)

func WithLogger(l *slog.Logger) Option
func WithProbeTimeout(d time.Duration) Option // default 2s per probe; in parallel

// Register adds a probe. Concurrency-safe.
func (r *Registry) Register(p Probe)

// CheckAll runs every probe in parallel, returns aggregate Status (worst of any)
// and per-probe Results. Honors ctx cancellation.
func (r *Registry) CheckAll(ctx context.Context) (Status, []Result)

// HTTPHandler returns an http.Handler that serves the /health endpoint:
// HTTP 200 if all probes return StatusOK, 503 otherwise. Body is JSON:
//   { "status": "ok|degraded|failing", "results": [...] }
func (r *Registry) HTTPHandler() http.Handler

// LivenessHandler is a separate cheap-check handler suitable for Kubernetes liveness
// probes. It does NOT run the dependency probes — it just returns 200 if the server
// is responsive. Use HTTPHandler for readiness probes.
func (r *Registry) LivenessHandler() http.Handler

// Built-in probes

// PgPing pings a Postgres connection (anything implementing PingableDB).
func PgPing(name string, db PingableDB) Probe

type PingableDB interface {
    PingContext(ctx context.Context) error
}

// HTTPGet probes an upstream HTTP endpoint. Considers 2xx OK, 5xx Failing,
// other non-2xx Degraded.
func HTTPGet(name, url string, timeout time.Duration) Probe

// CerbosCheck probes the Cerbos PDP via the authz client's underlying connection.
// Imports github.com/plinth-dev/sdk-go/authz.
func CerbosCheck(name string, client CerbosPinger) Probe

type CerbosPinger interface {
    Ping(ctx context.Context) error
}

// Func wraps a closure as a Probe; useful when the dependency is bespoke.
func Func(name string, fn func(ctx context.Context) error) Probe
```

### Behaviour

- **Probes run in parallel** using a `sync.WaitGroup`. Total latency = max(probe latency).
- **Per-probe timeout via `context.WithTimeout`.** If a probe exceeds its budget, it's reported as `StatusFailing` with `Detail: "timeout"`.
- **Aggregate status is the worst.** Any `Failing` makes the aggregate `Failing`. Otherwise any `Degraded` makes it `Degraded`. Otherwise `OK`.
- **HTTP status codes:** 200 for OK or Degraded, 503 for Failing. K8s readiness probes interpret 503 as "remove from service".
- **Liveness vs. readiness split.** `LivenessHandler` is for K8s liveness (process is alive) — never fails on dep state. `HTTPHandler` is readiness (process is ready to serve traffic) — fails if any dep is down.

## Why this shape

- **Probes are interfaces.** Lets bespoke dependencies (NATS JetStream stream existence, internal queue depth, etc.) implement their own probe in a few lines.
- **Per-probe timeout, not registry-wide.** A slow Cerbos probe shouldn't disqualify a fast Postgres probe. Independent budgets give honest reporting.
- **Liveness and readiness are different endpoints.** Conflating them causes either too-aggressive pod restarts (liveness fires on transient dep blip) or too-late traffic removal (readiness only fires after liveness restart).
- **Three-state Status, not boolean.** "Degraded but serving" is a real state — Cerbos slow but reachable, DB read-only failover, etc. Forcing binary OK/fail loses that signal.

## Boundaries

- **Does not page on degradation.** That's the monitoring stack's job (alert on `/health` body status field).
- **Does not auto-discover dependencies.** Explicit registration only — you write what to check.
- **Does not cache results.** Each request re-runs probes. If load is a concern, K8s probe interval (default 10s) + per-probe budgets (default 2s) keeps it bounded.
- **Does not restart anything.** Pure observation; recovery is K8s + the operator's job.
- **Does not export per-probe latency to OTel.** Adding metric emission per probe is a future enhancement; for now, latency is in the response body and that's enough.

## Alternatives considered

| Alternative | Why rejected |
|---|---|
| Single boolean `/health` | Lose signal: every dep blip looks the same. |
| Synchronous probes (one at a time) | Latency adds up; a 5-dep app with 2s probes takes 10s to respond. |
| Embed Prometheus exporter | Conflates application metrics (Prometheus pull) with health (request-driven). Keep separate. |
| Auto-register probes via reflection on global vars | Magic; surprises. Explicit registration in main() is fine. |

## Cross-references

- `sdk-go/authz` provides the `Ping` method on `*Client` that `CerbosCheck` consumes.
- The `starter-api` template wires this in `main()` with default probes for the included Postgres + NATS + Cerbos.
- K8s readiness probe path is `/health` (HTTPHandler), liveness is `/livez` (LivenessHandler) — convention enforced in the chart's pod template.
