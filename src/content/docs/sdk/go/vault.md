---
title: "sdk-go/vault — secret reader"
description: Reads secrets from /run/secrets/<name> first (External Secrets Operator output), env-var fallback for development. Cached after first read. MustGet for required secrets, Get for optional.
sidebar:
  label: vault
  order: 7
---

**Module:** `github.com/plinth-dev/sdk-go/vault`

## Responsibility

The thin secret-reading shim that every Plinth backend module uses to fetch credentials. Reads from a layered list of sources (default: `/run/secrets/<name>` then env var), caches in memory, and either panics-loudly-on-missing (`MustGet`) or returns a found-flag (`Get`).

## API surface

```go
package vault

// Source is anything that knows how to retrieve a secret by name.
type Source func(name string) (value string, found bool)

// FileSource reads from a directory; one file per secret. Trailing newline trimmed.
// Default dir is "/run/secrets" — what External Secrets Operator and Docker secrets
// both produce.
func FileSource(dir string) Source

// EnvSource reads from environment variables. The optional prefix is added before
// the lookup; "" means no prefix.
//   EnvSource("")              // reads e.g. DATABASE_URL
//   EnvSource("PLINTH_")       // reads PLINTH_DATABASE_URL
func EnvSource(prefix string) Source

// Reader queries Sources in order, returns the first found value, caches the result.
type Reader struct{ /* unexported */ }

// New returns a Reader with the given sources. With no sources, defaults to
// FileSource("/run/secrets") then EnvSource("").
func New(sources ...Source) *Reader

// Default is the package-level Reader, suitable for most modules.
// Initialised lazily on first call.
var Default = New()

// Get returns the secret value and whether it was found. Threadsafe.
// First call hits the sources; subsequent calls are cache hits.
func (r *Reader) Get(name string) (value string, found bool)

// MustGet panics with a helpful error if the secret is missing.
// Use for required secrets at startup. Never call inside a request handler.
func (r *Reader) MustGet(name string) string

// Refresh clears the cache for a single name (next Get re-reads from sources).
// Used by the rare module that supports hot secret rotation.
func (r *Reader) Refresh(name string)
```

### Behaviour

- **First-found wins.** Sources are consulted in registration order; the first that returns `found=true` provides the value.
- **In-memory cache, no TTL.** First read populates a `sync.Map`; subsequent reads return from cache. No automatic invalidation — secrets are deployment-scoped.
- **Trim trailing newline.** Both `FileSource` and `EnvSource` strip a single trailing `\n` since text files conventionally end with one and shells often add one.
- **No logging of values.** Ever. The package treats values as never-loggable. Errors mention only the name.
- **`MustGet` panic format.** "vault: required secret not found: DATABASE_URL — checked sources: file:/run/secrets, env" — telling the operator where it looked.

## Why this shape

- **`/run/secrets` first, env second.** That's the order Kubernetes mounts secrets via External Secrets Operator (and how Docker Compose mounts secrets). Env-var fallback is purely for local dev where you `export DATABASE_URL=...`.
- **`Source` is a function type, not an interface.** Lighter than an interface for one-method types; trivial to compose in tests (`func(name string) (string, bool) { return "fake", true }`).
- **Cache without TTL.** Modules that need rotation read from a sidecar (Vault Agent injector) which writes the new value to disk, then call `Refresh(name)`. Cache TTL would mask staleness without solving rotation.
- **`MustGet` for required.** Makes "fail at startup if `DATABASE_URL` is missing" one line. No `panic("DATABASE_URL required")` boilerplate.
- **`Default` package-level Reader.** Most modules want one Reader with default sources; `vault.MustGet("X")` is shorter than `vault.New().MustGet("X")`. Tests can replace `vault.Default` if needed.

## Boundaries

- **Does not talk to HashiCorp Vault directly.** Modules should not import the Vault Go client. Secrets reach `/run/secrets` via the External Secrets Operator (CRD `ExternalSecret` references a Vault path; ESO writes the file). This package is one abstraction layer above that, and intentionally so — it lets us swap secret backends without re-instrumenting modules.
- **Does not encrypt at rest.** Cache lives in process memory. If the process is dumped, secrets leak. Mitigation is at the OS level (secure memory, Talos's hardened defaults, no swap).
- **Does not auto-rotate.** Rotation is a deployment concern (re-roll pods on secret change) or a per-module Refresh call. The SDK doesn't push.
- **Does not warn on missing optional secrets.** `Get` returning `(zero, false)` is the contract; the caller decides whether that's a problem.

## Alternatives considered

| Alternative | Why rejected |
|---|---|
| Direct Vault client integration | Couples module to Vault. We want module → /run/secrets → ESO → Vault, with the indirection. Modules can run in environments without Vault (kind, dev compose). |
| `os.Getenv` with no shim | Doesn't enforce the file-first ordering; tempting to ship secrets as env in production where files are safer. |
| Provide encryption-at-rest of cached values | Marginal benefit (process memory dump is rarely the threat). Adds dep + complexity. |
| Watch `/run/secrets/*` for changes (auto-rotate) | Linux fsnotify works, but ESO writes are not atomic across multiple files; dependent secrets would race. Re-roll-pod is the simpler, working pattern. |

## Cross-references

- External Secrets Operator config lives in the platform chart at `plinth-dev/platform/charts/external-secrets/`. ESO syncs Vault paths to `/run/secrets/<name>` files inside pods.
- `starter-api`'s `main()` calls `vault.MustGet("DATABASE_URL")` and friends at startup.
- The Cerbos PDP itself reads its secrets from `/run/secrets` via the same convention; this package isn't used by Cerbos (it's not Go code), but the convention is shared.
