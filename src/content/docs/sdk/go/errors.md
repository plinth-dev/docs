---
title: "sdk-go/errors — typed error vocabulary"
description: Sentinel errors matchable via errors.Is, factory helpers, and an HTTP middleware that maps to RFC 7807 problem+json. Never string-compare error messages.
sidebar:
  label: errors
  order: 2
---

> **Status: Draft.** Targeting `v0.1.0` once Husham approves.
> Module path (target): `github.com/plinth-dev/sdk-go/errors`.

## Responsibility

The shared error vocabulary every Plinth backend module uses across handler / service / repository layers. Defines six canonical error categories, factory helpers to construct them, and an HTTP middleware that maps any of them into an RFC 7807 `application/problem+json` response.

## API surface

```go
package errors

import (
    "errors"
    "net/http"
)

// Sentinel errors. Use errors.Is(err, ErrNotFound) — never string-compare.
var (
    ErrNotFound          = errors.New("not_found")
    ErrConflict          = errors.New("conflict")
    ErrPermissionDenied  = errors.New("permission_denied")
    ErrValidation        = errors.New("validation")
    ErrUnauthenticated   = errors.New("unauthenticated")
    ErrInternal          = errors.New("internal")
)

// Code is the public, stable, machine-readable error label.
// Maps 1:1 to a sentinel and an HTTP status.
type Code string

const (
    CodeNotFound          Code = "not_found"
    CodeConflict          Code = "conflict"
    CodePermissionDenied  Code = "permission_denied"
    CodeValidation        Code = "validation"
    CodeUnauthenticated   Code = "unauthenticated"
    CodeInternal          Code = "internal"
)

// AppError is the structured error type.
// Implements error and unwraps to its sentinel so errors.Is(err, ErrNotFound) works.
type AppError struct {
    Code    Code
    Message string            // diagnostic; not user-facing
    Fields  map[string]string // for validation; field-name -> human reason
    cause   error             // unwraps to the sentinel
}

func (e *AppError) Error() string
func (e *AppError) Unwrap() error
func (e *AppError) HTTPStatus() int

// Factory helpers. Each returns *AppError whose Unwrap() returns the matching sentinel.
func NotFound(resource, id string) *AppError                       // 404
func Conflict(format string, args ...any) *AppError                // 409
func PermissionDenied(action string) *AppError                     // 403
func Validation(msg string, fields map[string]string) *AppError    // 422
func Unauthenticated(msg string) *AppError                          // 401
func Internal(format string, args ...any) *AppError                // 500

// Wrap builds an AppError around an existing cause. Use when crossing layers
// (e.g. repository pgx.ErrNoRows -> errors.Wrap(err, CodeNotFound, "item not found")).
func Wrap(cause error, code Code, format string, args ...any) *AppError

// Problem is the RFC 7807 wire shape produced by HTTPMiddleware.
type Problem struct {
    Type    string            `json:"type"`     // "https://plinth.run/errors/<code>"
    Title   string            `json:"title"`    // human-readable; matches the Code
    Status  int               `json:"status"`   // HTTP status
    Detail  string            `json:"detail,omitempty"` // AppError.Message (sanitized for "internal")
    Code    Code              `json:"code"`     // machine-readable; the contract
    TraceID string            `json:"trace_id,omitempty"` // populated if a trace is in context
    Fields  map[string]string `json:"fields,omitempty"`   // validation only
}

// HTTPMiddleware wraps a chi (or any net/http) handler. If the handler stores
// an error in the request context via SetError, the middleware emits problem+json.
// Internal errors (Code == CodeInternal) have their Message replaced with a
// generic "an internal error occurred" before serialization, to prevent leaks.
// The original AppError is logged at slog.Error level with the trace ID.
func HTTPMiddleware(next http.Handler) http.Handler

// SetError stores err on the request context for HTTPMiddleware to pick up.
// Handlers call this instead of writing the response directly.
func SetError(r *http.Request, err error)
```

### Behaviour

- **Sentinel matching.** `errors.Is(err, ErrNotFound)` returns true for any `AppError` constructed with `CodeNotFound` *or* wrapped around an underlying error that itself is `ErrNotFound`. The package never returns plain sentinels — always `*AppError` — so the caller always has access to `.Message` and `.Fields`.
- **Internal error sanitization.** An `AppError` with `Code == CodeInternal` has its `Message` and `cause` redacted from the wire response. The middleware logs the full original at `slog.Error` so ops can correlate by trace ID.
- **Trace correlation.** If `OpenTelemetry` has injected a trace ID into the context (which `sdk-go/otel` does by default), `Problem.TraceID` is populated. Clients can quote this back for support.
- **Validation Fields.** `errors.Validation("body failed validation", map[string]string{"email": "must be a valid email", "age": "must be ≥ 18"})` produces a problem+json with `fields: { email: "...", age: "..." }`. Frontends use this to highlight specific inputs.

## Why this shape

- **`errors.Is` over string-compare.** Idiomatic Go, robust against message rewording, robust across wrap/unwrap chains. Sentinels are the only safe way to check error identity.
- **`Code` as wire-stable label.** The constant strings (`"not_found"`, etc.) are part of the public contract — clients can switch on them. Messages are diagnostic; they may change. `Code` may not change without a major-version bump.
- **Factory helpers, not constructors.** `errors.NotFound("item", "abc-123")` reads better at the call site than `&errors.AppError{Code: CodeNotFound, Message: "item abc-123 not found"}` and produces a consistent message format across modules.
- **Middleware-emitted problem+json.** Putting the response shape in the middleware (rather than each handler calling `errors.WriteHTTP(w, err)` explicitly) means a forgotten error path can't accidentally leak `error.Error()` into the response. The handler's only job is `errors.SetError(r, err)` and return.
- **One canonical wire shape.** [RFC 7807](https://datatracker.ietf.org/doc/html/rfc7807) is the right standard; every Plinth module's clients can share one error parser.

## Boundaries

- **Does not log.** Logging is the caller's concern (and the middleware's — it logs `Internal` errors with full detail before sanitizing).
- **Does not define every domain error.** The six categories are the *vocabulary*. Modules add their own typed errors (e.g. `var ErrPaymentDeclined = errors.New("payment_declined")`) and either implement `HTTPStatus()` themselves or wrap as `errors.Conflict("payment declined: %v", inner)` to ride the existing machinery.
- **Does not translate user messages.** i18n is the frontend's concern. Backend `Message` and `Fields` are English diagnostic text.
- **Does not retry.** Transient-error handling is the caller's concern (or `pgx`'s, for repository code).

## Alternatives considered

| Alternative | Why rejected |
|---|---|
| `pkg/errors` style `Wrap` returning `error` not `*AppError` | Loses access to `Code`, `Fields`, `HTTPStatus()` without a type assertion at every site. The whole point is to make those visible. |
| One sentinel + a `Severity` field (no `Code`) | Loses the wire-stable label. Clients have to infer category from HTTP status, which is lossy (404 is `not_found`, but so is "policy decision: not visible to this user"). |
| Generated codes per domain error | Code explosion across modules; clients have to know the exact code list. Six categories is a lower-cardinality contract that scales. |
| Handler writes response directly (no middleware) | Forgotten error paths leak. Middleware is fail-closed-ish — if the handler doesn't `SetError`, the default response is the handler's own; if it does, the middleware emits the canonical shape. |

## Cross-references

- [`sdk-go/authz`](/sdk/go/authz/) returns `Decision`, not errors — but converting `Decision{Allowed:false}` to `errors.PermissionDenied(action)` is the canonical pattern at the handler/service boundary.
- `sdk-go/otel` (separate ADR) injects trace IDs into context; this package reads them.
- `sdk-go/audit` (separate ADR) emits audit events for permission-denied decisions.
- The TS SDK does not have a parallel package — frontend errors flow client-side via the response shape; see [`@plinth-dev/api-client`](/sdk/ts/api-client/) for the client-side type.
