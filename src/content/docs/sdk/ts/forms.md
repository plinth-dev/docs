---
title: "@plinth-dev/forms — server-action forms with Zod validation"
description: createAction factory wrapping a Zod schema + an execute function. <FormWrapper>/<FormField> render bindings with field-level errors, useActionState integration, toast feedback. Server actions are first-class.
sidebar:
  label: forms
  order: 4
---

**Package:** `@plinth-dev/forms`

## Responsibility

Make a Plinth form trivially correct: one Zod schema for input shape, one server function for execution, one `<FormWrapper>` + `<FormField>` tree for the UI. Field-level errors flow back without manual plumbing; success/failure toast is wired by default; `useActionState` integration handles the React 19 form state ergonomics.

## API surface

```ts
// Server side — "@plinth-dev/forms/server"
"use server";
import type { z } from "zod";

export interface ActionConfig<S extends z.ZodSchema, T> {
  schema: S;
  execute: (input: z.infer<S>, ctx: ActionContext) => Promise<T>;
  // Path(s) to revalidate after success. Calls Next.js's revalidatePath internally.
  revalidate?: string | string[];
  // Tag(s) to revalidate via revalidateTag.
  revalidateTags?: string[];
  // User-facing success message; defaults to "Saved." for create/update verbs.
  successMessage?: string | ((data: T) => string);
  // Whether to redirect after success. If returned by execute (or a function),
  // calls Next.js redirect.
  redirectTo?: string | ((data: T) => string | undefined);
}

export interface ActionContext {
  // Populated automatically; available to the execute function.
  user: { id: string; roles: string[] } | null;
  traceId: string;
}

export type ActionResult<T> =
  | { success: true; data: T; message?: string }
  | { success: false; error: string; fields?: Record<string, string[]> };

// Returns a function callable directly OR via React 19's useActionState.
export function createAction<S extends z.ZodSchema, T>(
  config: ActionConfig<S, T>,
): (input: z.infer<S> | FormData, prev?: ActionResult<T> | null) => Promise<ActionResult<T>>;

// Client side — "@plinth-dev/forms/client"
"use client";
import type { ReactNode } from "react";

export interface FormWrapperProps<T> {
  // The action returned by createAction (or any compatible signature).
  action: (input: FormData, prev: ActionResult<T> | null) => Promise<ActionResult<T>>;
  children: ReactNode;
  // Default toast on success/error; pass `false` to suppress.
  toast?: boolean | { onSuccess?: string | false; onError?: string | false };
  // Called on completion regardless of success.
  onSettled?: (result: ActionResult<T>) => void;
}

export function FormWrapper<T>(props: FormWrapperProps<T>): JSX.Element;

// useFormContext exposes per-field errors and pending state to descendants.
export interface FormContext {
  errors: Record<string, string[]>;
  isPending: boolean;
  result: ActionResult<unknown> | null;
}
export function useFormContext(): FormContext;

// FormField renders one input + label + error block. type maps to HTML inputs
// plus a few Plinth-specific shapes.
export interface FormFieldProps {
  type:
    | "text" | "email" | "password" | "number" | "url" | "tel"
    | "textarea" | "select" | "switch" | "checkbox" | "hidden" | "date";
  name: string;
  label?: string;
  description?: string;
  required?: boolean;
  // For type="select"
  options?: Array<{ value: string; label: string }>;
  // Pass-through to underlying input element
  inputProps?: React.InputHTMLAttributes<HTMLInputElement>;
  // Default value on initial render
  defaultValue?: string | number | boolean;
}

export function FormField(props: FormFieldProps): JSX.Element;
```

### Behaviour

- **Schema-first.** The Zod schema is the single source of input truth; field-level errors come from `schema.safeParse` failures, mapped to `fields: { fieldName: ["msg"] }`.
- **Two call modes.** The function returned by `createAction` accepts either a typed object (for direct calls from server code) or a `FormData` (for `useActionState`). Detected at runtime by `instanceof FormData`.
- **Default toasts via shadcn `Sonner` or `useToast`.** Configurable per-form. Suppressible with `toast={false}` for forms that show inline success/error themselves.
- **Pending state via React 19's transition.** `<FormWrapper>` wraps the action call in `useTransition` so submit buttons can read `useFormContext().isPending` and show spinners.
- **Auth context auto-injected.** `ActionContext.user` is populated from the same auth helper the layouts use (typically reading the session cookie via `next/headers`). Forms don't reach for `cookies()` themselves.
- **Revalidate after success.** `revalidate: "/items"` calls `revalidatePath("/items")`; `revalidateTags: ["items"]` calls `revalidateTag("items")`. Use one or the other depending on caching strategy.

### Usage

```tsx
// app/(module)/items/[id]/edit/action.ts
"use server";
import { z } from "zod";
import { createAction } from "@plinth-dev/forms/server";
import { itemsRepo } from "@/lib/repo";

const schema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(120),
  description: z.string().max(2000).optional(),
});

export const updateItem = createAction({
  schema,
  execute: async (input, ctx) => {
    return itemsRepo.update(input.id, {
      name: input.name,
      description: input.description,
      updatedBy: ctx.user!.id,
    });
  },
  revalidate: "/items/[id]",
  successMessage: "Item updated.",
});
```

```tsx
// app/(module)/items/[id]/edit/page.tsx
import { FormWrapper, FormField } from "@plinth-dev/forms/client";
import { updateItem } from "./action";
import { Button } from "@/components/ui/button";

export default function EditPage({ item }: { item: Item }) {
  return (
    <FormWrapper action={updateItem}>
      <FormField type="hidden" name="id" defaultValue={item.id} />
      <FormField type="text" name="name" label="Name" defaultValue={item.name} required />
      <FormField type="textarea" name="description" label="Description" defaultValue={item.description} />
      <Button type="submit">Save</Button>
    </FormWrapper>
  );
}
```

## Why this shape

- **Server actions over `/api/*` route handlers.** React 19 + Next.js 16 makes server actions the simplest way to mutate state. Forms shouldn't have to invent a fetcher.
- **Zod schema, not inferred.** Inferring schema from a form's fields couples form structure to validation; explicit schema lets the same validation run server-side without redefinition.
- **`fields` plural array per name.** Zod can produce multiple errors per field (e.g. "too short" + "must include uppercase"). The shape is `{ name: ["err1", "err2"] }`.
- **Two call modes.** Direct typed-object calls let server code (or tests) skip FormData serialization. FormData mode is for the React form integration. One factory, two integrations.
- **No client-side validation re-run.** Zod is server-side authoritative; client just renders the errors that come back. Some users want client-side too — they can call `schema.safeParse` themselves in an `onChange`. We don't bake it in to keep the bundle small.

## Boundaries

- **Does not implement i18n on validation messages.** Zod's default English messages flow through; for localized errors, the schema author provides messages.
- **Does not handle file uploads beyond what FormData natively does.** Multi-part uploads work, but bytes-streamed/resumable uploads are out of scope (use a separate upload service).
- **Does not wrap mutations in optimistic updates.** That's `useOptimistic` territory and orthogonal — works alongside, not inside.
- **Does not include `<FormSection>`, `<FormGroup>`, etc.** Plain HTML/CSS structure is fine; we only ship the bindings. shadcn primitives + Tailwind compose with `<FormField>` cleanly.

## Alternatives considered

| Alternative | Why rejected |
|---|---|
| `react-hook-form` only, no server-action wrapper | Doesn't address the server-action ergonomics that React 19 unlocked. RHF is excellent for client-only forms; we want the server-action path to be just as easy. |
| Single `<Form>` component per form (vs. action + FormWrapper) | Couples server logic to component placement. Server actions are call-anywhere; the FormWrapper is just an optional UI binding. |
| Custom validation engine (not Zod) | Zod is the de-facto standard, has TypeScript inference, and pairs with `@plinth-dev/env`. Custom engine is reinventing. |
| Generate UI from the schema (Zod → fields automatically) | Fragile (which fields are "hidden", which are "select", what label?). Explicit `<FormField>` per field is more verbose but clearer. |

## Cross-references

- `@plinth-dev/api-client` is what the `execute` function typically calls under the hood when the action talks to a backend service.
- `sdk-go/errors`'s validation Code (`validation` + `fields`) is the wire shape `api-client` parses; `forms` consumes the parsed errors and re-presents them at field level.
- React 19's [`useActionState`](https://react.dev/reference/react/useActionState) is the underlying hook `<FormWrapper>` uses.
- `@plinth-dev/env` enforces env-var presence; this package doesn't read env directly.
