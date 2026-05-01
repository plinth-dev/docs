---
title: "sdk-go/paginate — pagination types and parsing"
description: Two modes (cursor preferred, offset for small datasets). Pagination request struct with sane defaults, Page[T] response wrapper, query-string parser with allow-list-based sort-column safety.
sidebar:
  label: paginate
  order: 6
---

**Module:** `github.com/plinth-dev/sdk-go/paginate`

## Responsibility

A small, generic pagination toolkit. Defines the request shape (`Pagination`), the response wrapper (`Page[T]`), and a query-string parser that prevents SQL injection via sort-column allow-listing. Supports both offset-based pagination (familiar, simple, total-count-friendly) and cursor-based (stable, scales to large lists).

## API surface

```go
package paginate

import (
    "encoding/base64"
    "net/url"
)

type Mode string

const (
    ModeOffset Mode = "offset"
    ModeCursor Mode = "cursor"
)

type SortOrder string

const (
    SortDesc SortOrder = "desc"
    SortAsc  SortOrder = "asc"
)

// Pagination is the request shape. Populate via FromQuery from an http.Request.
type Pagination struct {
    Mode      Mode
    Page      int       // 1-based; offset mode only
    PageSize  int       // default 20, min 1, max 100
    Cursor    string    // opaque base64-encoded cursor; cursor mode only
    SortBy    string    // column name; must be in allow-list
    SortOrder SortOrder // default SortDesc
}

// Validated returns the Pagination with defaults applied and bounds enforced.
// Used internally by FromQuery; exposed for tests.
func (p Pagination) Validated() Pagination

// OffsetSQL returns the SQL fragment for offset/limit (e.g. " LIMIT 20 OFFSET 40").
// Returns empty string when Mode != ModeOffset.
func (p Pagination) OffsetSQL() string

// CursorBefore decodes the cursor and returns the column-value pair to filter on.
// Returns (zero-values, nil) if Cursor is empty. Returns error on malformed cursor.
func (p Pagination) CursorBefore() (column string, value any, err error)

// Page[T] is the canonical response wrapper.
type Page[T any] struct {
    Items []T      `json:"items"`
    Meta  PageMeta `json:"meta"`
}

type PageMeta struct {
    Mode       Mode  `json:"mode"`
    Page       int   `json:"page,omitempty"`
    PageSize   int   `json:"page_size"`
    TotalCount int64 `json:"total_count,omitempty"` // offset mode only
    TotalPages int   `json:"total_pages,omitempty"` // offset mode only
    NextCursor string `json:"next_cursor,omitempty"` // cursor mode only
    HasNext    bool   `json:"has_next"`
}

// NewOffsetPage builds a Page from items + total count.
func NewOffsetPage[T any](items []T, p Pagination, totalCount int64) Page[T]

// NewCursorPage builds a Page from items, takes the last item's cursor.
func NewCursorPage[T any](items []T, p Pagination, lastItemCursor func(T) string) Page[T]

// FromQuery parses Pagination from a URL query string with sensible defaults
// and an allow-list for sort columns to prevent SQL injection.
//
//   p, err := paginate.FromQuery(r.URL.Query(), []string{"created_at", "name", "status"})
//   if err != nil { /* errors.Validation(...) */ }
func FromQuery(q url.Values, allowedSortColumns []string) (Pagination, error)

// EncodeCursor builds a base64-encoded cursor from a column name and value.
func EncodeCursor(column string, value any) string
```

### Behaviour

- **Defaults applied.** `Mode` defaults to `ModeOffset` when `cursor` is absent and `page` is present; otherwise `ModeCursor`. `PageSize` defaults to 20, clamped to [1, 100]. `SortOrder` defaults to `desc`.
- **Sort column allow-list is mandatory.** `FromQuery` returns an error if `sort_by` isn't in the allow-list. This is the one feature that prevents SQL injection — the package is opinionated about it.
- **Mixed-mode requests are an error.** If both `page` and `cursor` are set, `FromQuery` returns a validation error.
- **Cursor format is opaque.** It's a base64 of `column:value`; the package treats it as a token. Modules don't need to know the format — they pass `Cursor` to repository code which decodes it via `CursorBefore`.

## Why this shape

- **Two modes, not one.** Offset is friendlier for small lists with stable totals (admin dashboards). Cursor is the only sane choice for large mutating lists (audit log, comments). Forcing one or the other onto callers ignores the trade-off.
- **`Page[T]` generic wrapper.** A type-safe container makes serialization unambiguous and lets the frontend render a generic table. Avoids the alternative of every endpoint defining its own wrapper.
- **Allow-list at parse time.** The handler-layer where `FromQuery` is called is the one place to enforce sort-column safety. Pushing it to the repository risks a forgotten check.
- **Defaults baked in.** Most pagination requests are "page 1, default size, sorted by created_at desc". The defaults make the common case zero config.

## Boundaries

- **Does not execute queries.** Returns the `Pagination` value; repository code uses `OffsetSQL()` or `CursorBefore()` to build the query.
- **Does not provide total count for cursor mode.** Cursor pagination scales because it avoids the count query. If a caller needs total, they pick offset mode (and pay the count cost).
- **Does not validate the cursor's column name.** That's `CursorBefore`'s job; if the column doesn't match the table, the query errors and the handler returns a 400.
- **Does not deduplicate.** If items shift between requests, cursor pagination might skip or repeat — that's a property of cursor pagination, not a bug.

## Alternatives considered

| Alternative | Why rejected |
|---|---|
| Cursor-only | Feels right for engineering taste but offset is genuinely better for fixed-size admin lists. Two modes is the honest answer. |
| Free-form sort columns | SQL injection waiting to happen. Allow-list is a small ergonomic cost for a large security win. |
| Embedded `Cursor` struct (typed `column`, `value`) | Couples the wire format to repository concerns. Opaque base64 keeps the surface stable across schema changes. |
| Use `gorm`'s pagination plugin | We're sqlc-first; gorm is not in the stack. |

## Cross-references

- `sdk-ts/tables` (`@plinth-dev/tables`) consumes the `Page[T]` JSON shape and matches `PageMeta` field-for-field.
- `starter-api`'s `Items` example uses this for the canonical paginated GET handler — see the design ADR's example section.
- `sdk-go/errors` is the source of the validation error returned when `FromQuery` rejects a malformed sort column.
