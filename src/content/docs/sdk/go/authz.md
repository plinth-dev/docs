---
title: "sdk-go/authz — Cerbos PDP client"
description: Fail-closed authorization client wrapping Cerbos. Returns explicit Decision with Reason. Fail-closed in production by default; dev-mode bypass requires explicit env AND non-prod.
sidebar:
  label: authz
  order: 1
---

> **Status: Draft.** Targeting `v0.1.0` once Husham approves the API surface.
> Module path (target): `github.com/plinth-dev/sdk-go/authz`.

## Responsibility

A thin, fail-closed wrapper around the Cerbos PDP gRPC client. Every authorization decision in a Plinth module flows through this package; modules never talk to Cerbos directly.

## API surface

```go
package authz

import (
    "context"
    "log/slog"
)

// Reason explains a Decision. Always populated, even when Allowed is true.
type Reason int

const (
    Allowed     Reason = iota // PDP allowed the action
    Denied                    // PDP explicitly denied
    Unreachable               // PDP error / timeout / network — fail-closed: treated as denied
    Bypassed                  // dev-only escape hatch; never appears in production
)

func (r Reason) String() string

// Decision is the explicit outcome of a permission check.
// Callers should log the full Decision, not just Allowed, so ops can distinguish
// "denied by policy" from "denied because PDP is sick".
type Decision struct {
    Allowed bool
    Reason  Reason
    Action  string // populated for diagnostics; "items:read"
}

// Principal identifies the actor making the request.
// Populate AuxData.JWT to enable Cerbos's $jwtClaims accessor in policies.
type Principal struct {
    ID         string
    Roles      []string
    Attributes map[string]any
    AuxData    *AuxData
}

type AuxData struct {
    JWT string // raw bearer token; passed through to Cerbos AuxData
}

// Resource is the thing being acted upon.
// Kind matches the Cerbos resource kind ("Item", "Approval", ...).
type Resource struct {
    Kind       string
    ID         string
    Attributes map[string]any
}

// Options configure the client. Address is required.
type Options struct {
    Address string       // "cerbos:3593"
    TLS     bool         // default false (in-cluster); set true for cross-cluster
    Logger  *slog.Logger // defaults to slog.Default()
    EnvName string       // "production" rejects bypass at startup; defaults to os.Getenv("ENV")
}

// Client is the only surface modules use. Safe for concurrent use.
type Client struct{ /* unexported */ }

// New connects, validates dev-bypass safety, returns a Client.
// Returns ErrBypassInProduction if CERBOS_ALLOW_BYPASS=1 and EnvName="production".
func New(ctx context.Context, opts Options) (*Client, error)

// Close releases the underlying gRPC connection.
func (c *Client) Close() error

// CheckAction evaluates a single action. Fail-closed:
// any error (network, PDP error, timeout, context cancel) returns
// Decision{Allowed: false, Reason: Unreachable}. Never returns an error to the caller.
func (c *Client) CheckAction(ctx context.Context, p Principal, r Resource, action string) Decision

// CheckActions evaluates many actions against the SAME resource in one round-trip.
// Returns a map keyed by action. Same fail-closed semantics: on transport failure,
// every action gets Decision{Allowed: false, Reason: Unreachable}.
func (c *Client) CheckActions(ctx context.Context, p Principal, r Resource, actions []string) map[string]Decision

// PermissionMap returns a flattened {action: allowed} map for the given actions.
// Convenience wrapper over CheckActions for the batched-check-at-layout pattern
// (server fetches once, passes to client). Keys are bare action names ("read"),
// not "kind:action" — kind is implicit from r.
func (c *Client) PermissionMap(ctx context.Context, p Principal, r Resource, actions []string) map[string]bool

// Sentinel errors for startup failures only.
var (
    ErrBypassInProduction = errors.New("CERBOS_ALLOW_BYPASS=1 rejected in production")
    ErrCerbosUnreachable  = errors.New("cannot connect to Cerbos PDP")
)
```

### Behaviour

- **Fail-closed.** Any failure path — PDP unreachable, timeout, gRPC error, context cancel, marshalling error — returns `Decision{Allowed: false, Reason: Unreachable}`. Never returns an error to the caller; the caller should never have to remember to "also check err".
- **Bypass mode.** If `CERBOS_ALLOW_BYPASS=1` AND `EnvName != "production"`, every `CheckAction*` call returns `Decision{Allowed: true, Reason: Bypassed}` and emits a `slog.Warn` per call ("AUTHZ BYPASS — would have called Cerbos with action=X resource=Y"). If `EnvName == "production"`, `New` returns `ErrBypassInProduction` at startup. There is no way to turn bypass on at runtime.
- **Logging.** Every `Unreachable` decision logs at `slog.Warn` with the action, resource kind, and the underlying error. Every `Bypassed` decision logs at `slog.Warn`. `Allowed` and `Denied` are *not* logged here — that's the caller's job (audit goes via `sdk-go/audit`, not this package).

## Why this shape

- **Explicit `Decision` over `(bool, error)`.** A `(bool, error)` return forces every caller to handle the error, and the natural reaction (return 500) leaks information to clients. With `Decision`, the caller writes `if !d.Allowed { return 403 }` — one path, fail-closed, ergonomic.
- **`Reason` enum, not error wrapping.** Ops needs to distinguish "Cerbos said no" from "Cerbos is dead" without parsing error strings. The enum is the wire format for that distinction.
- **Bypass mode lives in the client, not in policies.** Bypass is an *operational* affordance for local dev where running Cerbos is friction; it must not be expressible in a Cerbos policy file because policies are the security boundary. By gating bypass at the SDK layer with explicit env + production-rejection, we get the dev ergonomics without weakening prod.
- **Batched `CheckActions` is a primary, not a convenience.** The frontend pattern (`@plinth-dev/authz-react`'s `<PermissionsProvider>`) requires a single-request batch; if `CheckAction` were the only primitive, every layout render would issue N gRPC calls. Cerbos's gRPC API supports batching natively; we expose it.

## Boundaries — what this package does NOT do

- **Does not load policies.** Policies live in `plinth-dev/policies` (separate repo, deployed via Argo CD to the Cerbos pod). This client never sees policy files.
- **Does not cache.** Cerbos PDP is fast (~1ms p99 in-cluster) and stateless; caching breaks policy hot-reload and adds a TTL knob nobody wants to tune. If a future module hits a real performance ceiling, we revisit; for now, no.
- **Does not issue or validate JWTs.** That's the gateway's job (Ory Oathkeeper). We just propagate the raw JWT into AuxData so Cerbos can read claims.
- **Does not log allowed/denied decisions to audit.** Audit emission is `sdk-go/audit`'s job, called explicitly by the handler. Splitting audit and authz keeps each package single-purpose and makes it possible to authorize without auditing (read-only health checks, etc).
- **Does not distinguish reasons within "Denied".** Cerbos returns a binary; we mirror that. If a module wants "denied because role missing" vs "denied because attribute mismatch", that's a Cerbos schema concern, not an SDK concern.

## Alternatives considered

| Alternative | Why rejected |
|---|---|
| `Decide(...) (bool, error)` | Forces error-path handling on every caller; natural error-path is "return 500" which leaks info; encourages forgetting "also check the error". |
| Client-side decision cache (TTL N seconds) | Breaks policy hot-reload; adds a config knob nobody wants to tune. Cerbos is already fast. |
| Generated typed client per resource kind (`itemsAuthz.CanRead(...)`) | Forces SDK regeneration on every policy change; ergonomic but operationally fragile. Stringly-typed action names move the ergonomic loss to the caller in exchange for a static-only-at-policy SDK. |
| Bypass mode via build tag (`//go:build dev`) instead of env var | Build tags fragment binaries; harder to ship one image to staging that allows bypass and prod that doesn't. Env var with explicit rejection-in-production is the same safety with less binary sprawl. |

## Cross-references

- [`sdk-ts/authz`](/sdk/ts/authz/) mirrors this API surface in TypeScript (server-only); the two are designed in lockstep.
- [`@plinth-dev/authz-react`](/sdk/ts/authz-react/) consumes the `PermissionMap` shape from server-side calls.
- `sdk-go/audit` (separate ADR) handles audit emission for accept/deny outcomes — never called from this package.
- Cerbos's own PDP image and policy schema live in [Cerbos docs](https://docs.cerbos.dev/cerbos/latest/api/index.html).
