---
title: "@plinth-dev/env — Zod-validated environment variables"
description: createEnv factory wraps a Zod schema; validates process.env at module load; fails app boot on invalid env (not first request). Standard Plinth schema bits exported as a base to compose with module-specific envs.
sidebar:
  label: env
  order: 7
---

**Package:** `@plinth-dev/env`

## Responsibility

Make environment-variable handling correct: validated at module load (not first request), typed via Zod inference, fail-loudly on missing or malformed values. Exports a typed `env` object that's the only way module code reads from `process.env`.

## API surface

```ts
import { z } from "zod";

export interface CreateEnvOptions<S extends z.ZodObject<any>> {
  schema: S;
  // Optional cross-field validation that Zod's per-field rules can't express.
  // Throws via z.ZodError to surface in the same error path.
  refine?: (env: z.infer<S>) => void;
  // Defaults to process.env. Override for tests.
  source?: Record<string, string | undefined>;
  // Defaults to throwing (which Next.js / Node converts to a startup failure).
  // Override for graceful degradation in tests.
  onError?: (error: z.ZodError) => never;
}

// Returns the parsed, typed env object. Throws on validation failure.
export function createEnv<S extends z.ZodObject<any>>(
  options: CreateEnvOptions<S>,
): z.infer<S>;

// Plinth's standard schema fragments — compose with your module's own.
export const baseSchema: z.ZodObject<{
  NODE_ENV: z.ZodEnum<["production", "staging", "development", "test"]>;
  PORT: z.ZodCoercedNumber;
  LOG_LEVEL: z.ZodOptional<z.ZodEnum<["debug", "info", "warn", "error"]>>;
}>;

export const cerbosSchema: z.ZodObject<{
  CERBOS_ADDRESS: z.ZodString;
  CERBOS_TLS: z.ZodOptional<z.ZodCoercedBoolean>;
  CERBOS_ALLOW_BYPASS: z.ZodOptional<z.ZodCoercedBoolean>; // checked for production rejection
}>;

export const otelSchema: z.ZodObject<{
  OTEL_EXPORTER_ENDPOINT: z.ZodOptional<z.ZodString>;
  OTEL_TRACES_SAMPLER_ARG: z.ZodOptional<z.ZodCoercedNumber>;
}>;

export const authSchema: z.ZodObject<{
  AUTH_ISSUER: z.ZodString;
  AUTH_AUDIENCE: z.ZodString;
  AUTH_SECRET: z.ZodString; // for session signing
}>;

// Helper: requires a value only when NODE_ENV === "production".
// Composes with z.string().optional() inside .superRefine().
export function requiredInProduction<T extends z.ZodTypeAny>(schema: T): z.ZodEffects<T>;
```

### Behaviour

- **Validates at module load.** `createEnv` runs synchronously during the first import of the module that calls it; an invalid env throws and Next.js / Node logs the formatted Zod error and exits.
- **Coerced types.** `z.coerce.number()`, `z.coerce.boolean()` (which accepts `"1"`, `"true"`, `"yes"`) — env strings become typed values. Booleans interpret unset as `undefined` (not `false`) so optional flags behave.
- **Production-conditional fields.** `requiredInProduction(z.string().url())` makes a URL string optional except when `NODE_ENV === "production"` (where it's required). Many fields are dev-optional but prod-required (Cerbos address, secret signing keys, OTel endpoint).
- **Server-only by convention.** This package isn't marked `server-only` because some env vars (`NEXT_PUBLIC_*`) are legitimately client-readable. Modules typically maintain two `env.ts` files — one server, one for `NEXT_PUBLIC_*`.
- **Source override for tests.** `createEnv({ schema, source: { ...process.env, FOO: "test" } })` lets tests override individual values without mutating `process.env`.

### Usage

```ts
// lib/env.server.ts
import "server-only";
import { z } from "zod";
import { baseSchema, cerbosSchema, authSchema, otelSchema, requiredInProduction, createEnv } from "@plinth-dev/env";

export const env = createEnv({
  schema: baseSchema
    .merge(cerbosSchema)
    .merge(authSchema)
    .merge(otelSchema)
    .extend({
      DATABASE_URL: z.string().url(),
      ITEMS_API_URL: z.string().url(),
      SLACK_WEBHOOK_URL: requiredInProduction(z.string().url().optional()),
    }),
  refine: (env) => {
    if (env.CERBOS_ALLOW_BYPASS && env.NODE_ENV === "production") {
      throw new Error("CERBOS_ALLOW_BYPASS=1 rejected in production");
    }
  },
});
```

```ts
// lib/env.client.ts
import { z } from "zod";
import { createEnv } from "@plinth-dev/env";

export const clientEnv = createEnv({
  schema: z.object({
    NEXT_PUBLIC_VERSION: z.string(),
    NEXT_PUBLIC_OTEL_ENDPOINT: z.string().url().optional(),
    NEXT_PUBLIC_ENV: z.enum(["production", "staging", "development"]),
  }),
});
```

## Why this shape

- **Validate at load, not at first read.** A bad env should crash startup; debugging "first request 500s in prod 30 minutes after deploy" is worse than an obvious boot failure.
- **Zod schema, not custom DSL.** Same Zod the rest of the SDK uses (`forms`, `api-client`). One mental model.
- **Compose base schemas, don't generate a single one.** Different modules use different platform components. A module without Cerbos shouldn't have to know `CERBOS_ADDRESS` exists; merging individual fragments is opt-in.
- **`requiredInProduction` over branching.** Refinements on a base optional schema are clearer than two parallel schemas (one prod, one dev).
- **Twin server/client envs.** Next.js distinguishes them via `NEXT_PUBLIC_*` prefix; this package supports the pattern but doesn't impose it.

## Boundaries

- **Does not parse `.env` files.** Next.js / Node tooling does that already. By the time `createEnv` runs, `process.env` is populated.
- **Does not implement secret rotation or refresh.** Env is read once at boot; rotation is handled by deployment (re-roll pods).
- **Does not provide a CLI to print all required env vars.** Future enhancement; for now, the schema is the doc.
- **Does not validate Plinth-platform-internal envs (e.g. CI vars, runner-set vars).** Module schemas, only.

## Alternatives considered

| Alternative | Why rejected |
|---|---|
| `t3-env` package directly | Already does most of what we want, but pinning Plinth to its release cadence is awkward when our base schemas evolve. Re-implementing is a few hundred lines for SDK control. |
| Hand-rolled `process.env.X ?? throw` per variable | Per-call boilerplate; no type inference; "added one var, forgot to validate it" is a common bug. |
| Validate on first read instead of at load | Defers errors to runtime; the whole point is fail-fast at boot. |
| Skip schema, type-only `process.env as Env` | Lies about validation; runtime mismatch is silent until the bad code path runs. |

## Cross-references

- `@plinth-dev/forms` and `@plinth-dev/authz` both use Zod heavily; the shared mental model is intentional.
- `sdk-go/vault` is the Go-side counterpart for secret reading (file-first, env-fallback). The TS world reads secrets from env directly because Next.js typically runs in container envs where ESO writes secrets directly into the env, not files.
- The starter `lib/env.server.ts` is the canonical example consumers copy.
