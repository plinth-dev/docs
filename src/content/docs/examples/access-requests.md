---
title: Access requests
description: Engineer requests temporary production access; an approver decides; every state change is audited. A worked example that exercises every Plinth SDK at once.
sidebar:
  label: Access requests
  order: 2
---

A working internal-tool that demonstrates the full Plinth stack on the canonical "engineer requests temporary production access; an approver decides; audit log captures everything" flow.

**Source:** [github.com/plinth-dev/example-access-requests](https://github.com/plinth-dev/example-access-requests).

## What you'll see

| Surface | Plinth SDK |
| --- | --- |
| Server-rendered list table, status filter, URL-driven pagination | `@plinth-dev/tables` + `sdk-go/paginate` |
| New-request form with Zod validation + RFC 7807 error mapping | `@plinth-dev/forms` + `sdk-go/errors` |
| Approve/Deny buttons gated on Cerbos permissions | `@plinth-dev/authz-react` + `@plinth-dev/authz` + `sdk-go/authz` |
| Every state transition produces an audit event (CloudEvents 1.0) | `sdk-go/audit` |
| Distributed tracing across web → API | `@plinth-dev/otel-web` + `sdk-go/otel` |
| Non-throwing API client with discriminated-union responses | `@plinth-dev/api-client` |
| Fail-fast env validation at module load | `@plinth-dev/env` + `sdk-go/vault` |

## Domain

```
                ┌─────────────────────┐
   POST /       │                     │
  ──────────▶   │      pending        │
                │                     │
                └────────┬────────────┘
                         │
       ┌─────────────────┴─────────────────┐
       │                                   │
 POST /:id/approve                  POST /:id/deny
       │                                   │
       ▼                                   ▼
 ┌────────────┐                       ┌────────┐
 │  approved  │                       │ denied │
 │ + expires  │                       │+ reason│
 └────────────┘                       └────────┘
```

Approved and denied are terminal — once decided, no further mutation. The repo guards transitions atomically (`UPDATE … WHERE status = 'pending' RETURNING …`) so concurrent decisions don't both succeed.

## Roles

| Role | Permissions |
| --- | --- |
| `requester` | Create requests; read + list **own** requests |
| `approver`  | Read + list **all** requests; approve/deny pending requests |
| `admin`     | Same as approver (reserved for read-only auditors with broader future scope) |

Cerbos enforces all of the above — the service layer calls `authz.CheckAction` before every operation; the web tier renders Approve/Deny buttons via `<Can action="decide">`.

## Run it locally

```bash
git clone https://github.com/plinth-dev/example-access-requests
cd example-access-requests

# API tier (terminal one)
cd access-requests-api
docker compose up -d        # Postgres + Cerbos
make migrate-up             # apply schema
make run                    # serve on :8080

# Web tier (terminal two)
cd ../access-requests-web
pnpm install
pnpm dev                    # serve on :3000
```

Then open `http://localhost:3000` and use the dev sign-in shortcuts:

1. **Sign in as alice (requester)** — file a request: purpose `Investigate incident #1234`, scope `AWS prod read-only`, justification any sentence.
2. **Sign in as bob (approver)** — see all pending requests; open alice's; approve with `expiresAt = now + 24h`.
3. **Sign in as alice again** — your request is now `approved` with bob's signature.
4. **Inspect the audit log** — `docker compose logs api | grep audit` shows three CloudEvents (`access_request.created`, `access_request.approved`) with actor, resource, before/after, and trace ID populated.

## Architecture

The API and web tiers are independent runtimes that share only the JSON contract. Each is dropped onto the [`platform`](https://github.com/plinth-dev/platform) substrate (CloudNativePG + Cerbos + OpenTelemetry Collector) without modification — no adapter glue, just env vars.

```
                 ┌───── Web (Next.js + React 19) ─────────┐
   Browser ────▶ │ ServerTable, FormWrapper, <Can/>       │
                 │ permissionMap → Cerbos via @authz      │
                 │ traceparent propagation via @otel-web  │
                 └────────────┬───────────────────────────┘
                              │ Bearer <userid>:<roles>
                              ▼
                 ┌───── API (Go + chi) ───────────────────┐
                 │ chi → otel HTTP middleware             │
                 │   → auth (cookie shim or JWT)          │
                 │   → errors (RFC 7807)                  │
                 │   → handlers → service                 │
                 │ service: authz.CheckAction → Cerbos    │
                 │          repo (pgx)                    │
                 │          audit.Publish (non-blocking)  │
                 └────────────┬────┬──────────────────────┘
                              │    │
              ┌───────────────┘    └────────────┐
              ▼                                  ▼
    ┌──────────────┐                 ┌────────────────────┐
    │ CloudNativePG│                 │   Cerbos PDP       │
    │  (Postgres)  │                 │  /policies mount   │
    └──────────────┘                 └────────────────────┘
```

## Origin

Both tiers were generated with the [`plinth` CLI](https://github.com/plinth-dev/cli):

```bash
plinth new access-requests \
  --module-path github.com/plinth-dev/example-access-requests/access-requests-api
```

…then adapted from the starter's `Items` resource to `AccessRequest`. The same flow scaffolds your own modules — see the [stand-it-up walkthrough](/start/try-it/).

## Replacing this with your own resource

If you want to fork it as a starting point for a different internal tool:

1. `db/migrations/` — replace the `access_requests` table with your schema.
2. `internal/repository/access_requests.go` — rename the type + the SQL.
3. `internal/service/access_requests.go` — change the methods, the audit action names, the Cerbos resource kind.
4. `cerbos/policies/access_request.yaml` — same kind rename; redefine actions and rules.
5. `internal/handlers/access_requests.go` — adjust routes + DTOs.
6. `cmd/server/main.go` — rename the variables wiring the repo/svc/handlers.

Web tier follows the same pattern under `access-requests-web/src/app/access-requests/`.

Or, easier — `plinth new your-thing` to start from a fresh starter and copy ideas selectively.

## What it doesn't yet include

The example deliberately stops at the boundary of the substrate. Things you'd add for a real deployment:

- **Real auth.** The example ships a dev-only cookie shim (`plinth_dev_user=alice:requester`). Wire your IdP (OIDC, JWT, Clerk, Auth0, Stack) before anything that matters.
- **Time-bound access enforcement.** Approved requests carry an `expires_at`, but the example doesn't ship a worker that revokes the underlying access. Pair with whatever your environment uses (AWS IAM session policies, Teleport, Kubernetes RoleBindings with `expirationDate`).
- **Notifications.** No Slack / email when a request is filed or decided. Plinth's audit stream lands on NATS by default; subscribe and notify from there.
