---
title: "@plinth-dev/tables — headless data tables with URL state"
description: ServerTable manages pagination, sort, search, and filters via nuqs URL state. Server pages read searchParams; client component handles interaction. Pluggable filter types, headless TanStack Table under the hood.
sidebar:
  label: tables
  order: 5
---

> **Status: Draft.** Targeting `0.1.0` once Husham approves.
> Package (target): `@plinth-dev/tables` on npm.

## Responsibility

The default data-table experience for Plinth modules. Read pagination/sort/filter state from the URL, render a styled-but-overridable table, send back to the server on interaction (no SPA-style client-side filtering). Designed around the pattern: server fetches paginated data → passes to client component → client component manages URL state.

## API surface

```ts
"use client";

import type { ColumnDef } from "@tanstack/react-table";
import type { ReactNode } from "react";

export interface ServerTableProps<T> {
  columns: ColumnDef<T>[];
  data: T[];
  pagination: {
    page: number;
    pageSize: number;
    totalCount?: number; // offset mode
    totalPages?: number; // offset mode
    nextCursor?: string; // cursor mode
    hasNext: boolean;
  };
  filters?: FilterField[];
  searchPlaceholder?: string;
  emptyState?: ReactNode;
  onRowClick?: (row: T) => void;
  // Allow consumer to override layout / style entirely.
  renderHeader?: (props: HeaderRenderProps) => ReactNode;
  renderRow?: (row: T, index: number) => ReactNode;
}

export function ServerTable<T>(props: ServerTableProps<T>): JSX.Element;

// Filter field primitives.
export type FilterField = SelectFilter | TextFilter | DateRangeFilter | BooleanFilter;

export interface SelectFilter {
  type: "select";
  key: string;
  label: string;
  options: Array<{ value: string; label: string }>;
  multi?: boolean;
}

export interface TextFilter {
  type: "text";
  key: string;
  label: string;
  placeholder?: string;
}

export interface DateRangeFilter {
  type: "date-range";
  key: string; // creates <key>_from and <key>_to URL params
  label: string;
}

export interface BooleanFilter {
  type: "boolean";
  key: string;
  label: string;
}

// Hook for components that need to read/write the URL state outside of ServerTable.
export interface TableUrlState {
  page: number;
  pageSize: number;
  sortBy: string | null;
  sortOrder: "asc" | "desc";
  search: string | null;
  filters: Record<string, string | string[] | null>;
  setPage: (n: number) => void;
  setSort: (column: string, order: "asc" | "desc") => void;
  setSearch: (s: string | null) => void;
  setFilter: (key: string, value: string | string[] | null) => void;
  reset: () => void;
}

export function useTableUrlState(): TableUrlState;

// Helper to build the server-side fetch params from URL searchParams.
export function parseTableSearchParams(
  searchParams: Record<string, string | string[] | undefined>,
  allowedSortColumns: string[],
): {
  page: number;
  pageSize: number;
  sortBy: string;
  sortOrder: "asc" | "desc";
  search: string | null;
  filters: Record<string, string | string[]>;
};
```

### Behaviour

- **URL is the source of truth.** Sort, page, search, filters all live in the query string via `nuqs`. Browser back/forward works. Sharing a URL shares the table state.
- **Server-side pagination only.** No client-side filtering or sorting. The table renders what the server sent. Pagination/sort/filter changes trigger router navigation (Next.js 16 `useRouter().push` with `scroll: false`).
- **Headless under the hood.** TanStack Table provides the row model + column definition primitives; we layer `<table>` rendering, sticky headers, density toggle, column visibility menu.
- **Tailwind + shadcn defaults.** Styled out of the box but every render slot (`renderHeader`, `renderRow`, etc.) is overridable. Tables that need custom rendering replace the slot.
- **Filters compose to URL params.** A `<SelectFilter key="status">` writes `?status=active` (single) or `?status=active,pending` (multi). Server reads via `parseTableSearchParams`.
- **Empty state and loading.** `emptyState` renders when `data.length === 0`. Loading is the parent's responsibility — Server Components stream; client-only callers wrap in Suspense.

### Usage

```tsx
// app/(module)/items/page.tsx — Server Component
import { ServerTable, parseTableSearchParams } from "@plinth-dev/tables";
import { columns } from "./columns";
import { itemsRepo } from "@/lib/repo";

export default async function ItemsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const params = parseTableSearchParams(sp, ["created_at", "name", "status"]);
  const page = await itemsRepo.list(params);

  return (
    <ServerTable
      columns={columns}
      data={page.items}
      pagination={page.meta}
      filters={[
        { type: "select", key: "status", label: "Status",
          options: [
            { value: "active", label: "Active" },
            { value: "archived", label: "Archived" },
          ],
        },
        { type: "date-range", key: "created", label: "Created" },
      ]}
      searchPlaceholder="Search items..."
    />
  );
}
```

## Why this shape

- **URL state, not React state.** Internal tools live and die by shareable URLs. "Send me the link to that filter" is a daily request. URL-as-state makes it free.
- **Server-side pagination only.** Internal tools have moderate datasets (10s of thousands, not millions); server roundtrips are fast and the UX is honest. Client-side filtering misleads users about completeness.
- **Server reads `searchParams`, client writes via `nuqs`.** Asymmetric but correct: the page is RSC-rendered with the server's view of state; the client mutates URL → triggers re-fetch → server re-renders.
- **`parseTableSearchParams` enforces the allow-list.** Same SQL-injection-prevention philosophy as `sdk-go/paginate`; the boundary check sits at the page handler.
- **Row click + render slots.** The simple cases (`onRowClick`) need one prop; the complex cases (custom row layout) need the slot escape hatch. Two tiers, no middle.

## Boundaries

- **Does not paginate client-side.** All page changes route to the server.
- **Does not implement column resizing, drag-reorder, or persistence.** Future enhancements; not v0.1.0.
- **Does not virtualize long lists.** Internal tooling rarely renders > 100 rows visible; if needed, the consumer wraps in TanStack Virtual.
- **Does not export to CSV.** Separate concern; if a module needs CSV, render an export endpoint.
- **Does not provide a `useTableData` hook for client-only tables.** Use TanStack Query directly if you need that.

## Alternatives considered

| Alternative | Why rejected |
|---|---|
| Client-side filtering and sorting (load everything once) | Lies to users about result completeness; doesn't scale; misleading when paired with pagination. |
| TanStack Table with no opinions | Then every module reinvents URL state, sticky header, filter chrome. The whole point is the opinion. |
| Material UI / Mantine / Tremor data table | All come with strong styling assumptions; we already use shadcn primitives; a third style system fragments the look. |
| Cursor-only pagination | Same reasoning as `sdk-go/paginate`: offset has its place for fixed-size lists. |

## Cross-references

- `sdk-go/paginate`'s `Page[T]` shape is what this consumes via the `pagination` prop.
- `@plinth-dev/api-client` is what fetches the data on the server side; not imported here.
- `nuqs` is the underlying URL-state library; we re-export nothing — consumers can import nuqs directly for non-table state.
- TanStack Table v8 is the headless engine; `ColumnDef<T>` types are re-exported.
