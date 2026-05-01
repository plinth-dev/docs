---
title: "sdk-go/audit — non-blocking audit emission"
description: Emit CloudEvents-shaped audit events to a pluggable transport (NATS by default). Never blocks the request path; failures log and drop. Modules call Publish, the package handles buffering, retries, and shutdown drain.
sidebar:
  label: audit
  order: 3
---

> **Status: Draft.** Targeting `v0.1.0` once Husham approves.
> Module path (target): `github.com/plinth-dev/sdk-go/audit`.

## Responsibility

Emit structured audit events from every Plinth backend module. Wraps a pluggable `Producer` (NATS JetStream by default) with non-blocking publish semantics so the request path never waits on audit ingestion.

## API surface

```go
package audit

import (
    "context"
    "log/slog"
)

// Outcome of the audited action.
type Outcome string

const (
    OutcomeSuccess Outcome = "success"
    OutcomeDenied  Outcome = "denied"
    OutcomeError   Outcome = "error"
)

// Severity drives downstream alerting and retention.
type Severity string

const (
    SeverityInfo    Severity = "info"
    SeverityNotice  Severity = "notice"
    SeverityWarning Severity = "warning"
    SeverityAlert   Severity = "alert"
)

// Event is the platform-specific data payload, wrapped in a CloudEvents 1.0
// envelope at publish time. Field names match the audit indexing schema.
type Event struct {
    Actor     Actor
    Action    string         // "items.update", "approvals.deny"
    Resource  Resource
    Outcome   Outcome
    Severity  Severity
    DataClass string         // "internal", "confidential", "regulated"
    Before    map[string]any // optional snapshot before mutation
    After     map[string]any // optional snapshot after mutation
    Reason    string         // freeform; required for OutcomeDenied/Error
    // TraceID is populated automatically from the context's OTel span.
}

type Actor struct {
    ID    string
    Type  string // "user" | "service" | "system"
    Roles []string
}

type Resource struct {
    Kind string
    ID   string
}

// Producer is the transport. Implementations: NATSProducer, MemoryProducer.
type Producer interface {
    Publish(ctx context.Context, e Event) error
    Close(ctx context.Context) error
}

// Publisher is the surface modules use. Wraps a Producer with non-blocking semantics.
type Publisher struct{ /* unexported */ }

type Options struct {
    Producer    Producer
    Logger      *slog.Logger
    ServiceName string // populates CloudEvents source field; defaults to os.Args[0]
    BufferSize  int    // events queued in-memory; default 1024
    DrainTimeout time.Duration // Close() max wait; default 5s
}

func New(opts Options) *Publisher

// Publish never blocks and never returns an error. If the buffer is full,
// the oldest event is dropped and a slog.Error is emitted with the dropped event.
// A drop counter (read via Stats) is incremented for monitoring.
func (p *Publisher) Publish(ctx context.Context, e Event)

// Close drains in-flight events up to DrainTimeout, then closes the producer.
// Call from main()'s shutdown handler.
func (p *Publisher) Close(ctx context.Context) error

// Stats exposes runtime counters for monitoring.
func (p *Publisher) Stats() Stats

type Stats struct {
    Published uint64
    Dropped   uint64
    Errored   uint64
    BufferUse float64 // [0,1]
}

// Built-in producers.
func NewNATSProducer(opts NATSOptions) (Producer, error)

type NATSOptions struct {
    Address string // "nats://nats:4222"
    Stream  string // "PLINTH_AUDIT"
    Subject string // "audit.events.v1"
    Auth    NATSAuth
}

type NATSAuth struct {
    UserCredsFile string // path to NATS .creds file
}

// MemoryProducer is for tests. Events accumulates in-order.
type MemoryProducer struct {
    Events []Event
}

func NewMemoryProducer() *MemoryProducer
func (m *MemoryProducer) Publish(ctx context.Context, e Event) error
func (m *MemoryProducer) Close(ctx context.Context) error
```

### Behaviour

- **Publish never blocks the request path.** `Publish` enqueues to an in-memory buffer (default 1024 events) and returns synchronously. A goroutine pool drains the buffer to the underlying `Producer`.
- **Drop on overflow.** If the buffer is full, the oldest event is dropped (FIFO), `slog.Error` is emitted with the dropped event details, and a counter increments. Monitoring should alert on drop-rate > 0.
- **CloudEvents envelope at publish time.** The `Producer` wraps the `Event` in a CloudEvents 1.0 envelope: `id` (UUIDv7), `source` ("plinth.run/<service>"), `type` ("plinth.audit.<action>.v1"), `time`, `datacontenttype` ("application/json"), `data` (the Event struct).
- **Trace propagation.** The OTel span context is read from `ctx` at Publish time and serialized into the event's `TraceID` field. Audit events can be cross-referenced with traces in SigNoz.
- **Required `Reason` for non-success.** `OutcomeDenied` or `OutcomeError` with empty `Reason` logs a `slog.Warn` ("audit event missing reason") but still publishes. We don't reject — auditing partial info is better than not auditing.

## Why this shape

- **Non-blocking is the whole point.** A synchronous publish couples audit-pipeline health to request latency. The first time NATS hiccups, every request stalls. Non-blocking + drop-with-metrics is the right trade.
- **Pluggable `Producer`.** Test code uses `MemoryProducer` to assert "did this handler emit the right audit event?". Production uses NATS. The interface boundary makes both trivial.
- **Buffer + drain rather than fire-and-forget.** Most events succeed on the first publish; the buffer absorbs producer-side blips without dropping.
- **CloudEvents over a custom envelope.** Standard interop with Wazuh, OpenSearch, Argus, anything that consumes CloudEvents. Free downstream tooling.
- **Severity drives retention.** Wazuh + the OpenSearch ILM policy use Severity to decide hot/warm/cold tiering. The four-level enum is enough cardinality for that.

## Boundaries

- **Does not decide what to audit.** The handler decides; this package emits.
- **Does not enforce data classification.** The caller fills `DataClass`. A Cerbos policy could enforce it at policy-load time, but at SDK level we trust the caller.
- **Does not log to disk.** Events go to the Producer, full stop. If NATS is unreachable and the buffer fills, events are lost (and counted). On-disk durability is provided by NATS JetStream's storage layer.
- **Does not retry transport failures synchronously.** The NATS producer has its own retry loop with backoff; this package just hands events off.
- **Does not deduplicate.** Each Publish call produces one event; idempotency is the caller's job (typically: only publish on persisted state changes).

## Alternatives considered

| Alternative | Why rejected |
|---|---|
| Synchronous Publish returning error | Couples request latency to NATS health. First NATS blip = SLO breach. |
| Sidecar audit-forwarder over Unix socket | Adds deployment complexity (one more container per pod) for marginal reliability win. |
| Embed in `slog` as a structured logger | Audit retention/routing diverges from logs (90d hot for logs, 7y for audit). Forcing one transport conflates them. |
| Block on overflow instead of drop | Worse than failing the request — slows every request indefinitely. Drop + alert is the right failure mode. |

## Cross-references

- `sdk-go/otel` injects the trace ID this package reads from context.
- `sdk-go/authz` returns `Decision` — the canonical pattern is to call `audit.Publish(ctx, audit.Event{Outcome: OutcomeDenied, Reason: d.Reason.String(), ...})` after a denied check.
- NATS JetStream + audit subject configuration lives in `plinth-dev/platform/charts/nats/values.yaml` once Phase D ships.
- SigNoz's audit dashboard (Phase F) reads from the same NATS subject via an OpenTelemetry collector pipeline.
