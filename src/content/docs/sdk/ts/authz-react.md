---
title: "@plinth-dev/authz-react — React permissions library"
description: Client-side permissions consumer for the batched-check-at-layout pattern. PermissionsProvider, usePermissions, and a declarative <Can> gate. Pure client; reads a permission map fetched server-side.
sidebar:
  label: authz-react (client)
  order: 2
---

**Package:** `@plinth-dev/authz-react`

## Responsibility

The client-side complement to [`@plinth-dev/authz`](/sdk/ts/authz/). Consumes a `PermissionMap` (boolean record) fetched once per route at the server-side layout, and exposes it to every descendant component without further round-trips. Provides hook + declarative gate components for the two common UI patterns: "show this" and "render different copy if forbidden".

## API surface

```tsx
"use client";

import type { ReactNode } from "react";

// The wire shape from @plinth-dev/authz's permissionMap. Keys are bare action names
// scoped to the resource the layout fetched ("read", "update", "delete", ...).
export type PermissionMap = Record<string, boolean>;

export interface PermissionsProviderProps {
  permissions: PermissionMap;
  children: ReactNode;
  // Optional: when nesting providers, controls merge behaviour.
  // Default "replace" — child fully replaces parent permissions.
  // "merge" — child overrides specific keys; missing keys fall through.
  strategy?: "replace" | "merge";
}

export function PermissionsProvider(props: PermissionsProviderProps): JSX.Element;

export interface UsePermissions {
  has: (action: string) => boolean;
  hasAny: (actions: string[]) => boolean;
  hasAll: (actions: string[]) => boolean;
  raw: PermissionMap;
}

// Throws if called outside a PermissionsProvider — surfaces "you forgot the layout"
// loudly at dev time. In production, falls back to all-false (fail-closed).
export function usePermissions(): UsePermissions;

export interface CanProps {
  action: string;
  // Falsy / missing -> renders nothing.
  // Provide a node to render the not-allowed state inline.
  fallback?: ReactNode;
  children: ReactNode;
}

export function Can(props: CanProps): JSX.Element;

// Compositional variants for "any of" / "all of"
export interface CanAnyProps  { actions: string[]; fallback?: ReactNode; children: ReactNode; }
export interface CanAllProps  { actions: string[]; fallback?: ReactNode; children: ReactNode; }
export function CanAny(props: CanAnyProps): JSX.Element;
export function CanAll(props: CanAllProps): JSX.Element;
```

### Behaviour

- **Provider-rooted.** `usePermissions()` outside a `<PermissionsProvider>` throws in development (`Error("usePermissions called outside PermissionsProvider — wrap your route in a PermissionsProvider populated from @plinth-dev/authz's permissionMap")`). In production builds, it returns an all-false map — fail-closed, never an undefined.
- **`<Can>` is the default surface.** It renders `children` when allowed, `fallback` when not, nothing when not allowed and no fallback. No spinner; permissions are synchronous in the client because they came pre-resolved from the server.
- **Composable.** `<CanAny actions={["read", "comment"]}>` and `<CanAll actions={["update", "delete"]}>` cover the common "or"/"and" cases without users having to compose two `<Can>`s.
- **Strategy `"merge"`.** A nested `<PermissionsProvider strategy="merge" permissions={{ comment: true }}>` overlays one key onto the parent's map. Useful for sub-routes that fetch one extra permission rather than the full set again.
- **Tree-shakeable.** Each export is in a separate file under `/src`. Apps that only use `<Can>` don't bundle the hooks; apps that only use the hook don't bundle the components.

### Usage

```tsx
// app/(module)/items/[id]/page.tsx — a Server Component (default)
import { Can, usePermissions } from "@plinth-dev/authz-react";
import { CommentButton } from "./CommentButton";

// PermissionsProvider is wired at the layout one level up; this page
// reads from it via Server Component descendants that mark themselves "use client".
export default function Page({ params }: { params: { id: string } }) {
  return (
    <article>
      <h1>Item {params.id}</h1>
      <p>Body...</p>

      {/* Conditional rendering — children hidden when not allowed */}
      <Can action="comment">
        <CommentButton />
      </Can>

      {/* With fallback — explicit forbidden state */}
      <Can action="delete" fallback={<span className="text-muted">Read-only</span>}>
        <DeleteButton />
      </Can>
    </article>
  );
}
```

```tsx
// CommentButton.tsx
"use client";
import { usePermissions } from "@plinth-dev/authz-react";
import { Button } from "@/components/ui/button";

export function CommentButton() {
  const perms = usePermissions();

  if (!perms.has("comment")) return null;

  return <Button>Comment</Button>;
}
```

## Why this shape

- **Permissions are pre-resolved server-side.** The whole point of the batched-check-at-layout pattern is that the client never asks Cerbos anything. The hook is synchronous; no loading state.
- **`<Can>` mirrors the visibility decision, not the permission boolean.** `<Can action="x">` reads as "if this user can X, show this", which is what the engineer thinks. A `<Permission>` component would force the reader to interpret a name that isn't UI behaviour.
- **Provider-throws-in-dev, falls-back-in-prod.** Devs find missing-provider bugs immediately; prod doesn't crash because of one missing wrapper. Same dual-mode pattern Next.js uses for its own contexts.
- **Tree-shakeable per-feature.** A page that uses only `<Can>` shouldn't pay the bundle cost of `usePermissions`. Discrete files + `sideEffects: false` in package.json achieves that.
- **`PermissionMap` is `Record<string, boolean>`, not `Record<string, Decision>`.** The full Decision shape matters server-side (for logging Reason); on the client, only `allowed` matters. Smaller payload, simpler hook return type.

## Boundaries

- **Does not call Cerbos.** Ever. That's `@plinth-dev/authz`'s job, server-side only.
- **Does not refresh permissions.** If a user's permissions change mid-session, they see stale UI until the next route navigation re-runs the layout. This is by design — refresh-on-permission-change adds complexity (websockets? polling?) we don't want in v0.1.0.
- **Does not implement role-based-rendering shortcuts.** No `<Can role="admin">`. Roles are policy-internal; the SDK exposes only action-level permissions because that's what Cerbos returns.
- **Does not gate routes.** Use Next.js `notFound()` or `redirect()` from the layout/page if a route should be inaccessible; this package is for in-page conditional rendering only.

## Alternatives considered

| Alternative | Why rejected |
|---|---|
| Async hook (`usePermissions()` returns `Promise`) | Forces every consumer into Suspense or loading-state handling. Defeats the layout-batched pattern's whole point. |
| `<Can role="...">` shortcut | Roles are an implementation detail of policies. Exposing them in components ties UI to policy structure. Action-only stays decoupled. |
| Refresh-on-WebSocket / polling | Significant complexity (subscription management, reconnection, etc.) for a feature most internal tools don't need. Re-route is enough. |
| Fallback to "all true" outside provider | Anti-pattern; defaults must be safe. Failing closed (all-false) on a missing provider is the only correct default. |
| Generic `usePermissions<T>()` typed by resource kind | Would need TypeScript template-literal-types magic to enumerate actions; brittle, and the resource kind is implicit at the layout level. Strings are simpler and stable. |

## Cross-references

- [`@plinth-dev/authz`](/sdk/ts/authz/) — the server-only counterpart that produces `PermissionMap`.
- [`sdk-go/authz`](/sdk/go/authz/) — the Go-side decision API used by API-route handlers.
- React's own [`use(context)`](https://react.dev/reference/react/use) pattern is what the hook is built on; React 19's improved server-component context propagation is assumed.
