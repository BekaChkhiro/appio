---
name: form-with-validation
description: |
  Build a form with field validation, async submit, and inline error display
  using react-hook-form + zod + Convex mutations. Use when the user asks for
  any input form: signup/login (beyond LoginScreen), settings, "add habit",
  "create post", checkout, contact form, multi-step wizards, profile editing.
  Covers single and multi-step composition, optimistic UI, and disabled-while-
  submitting states. Also use after a generated form has visible bugs around
  validation timing or duplicate submissions.
when_to_use: |
  Triggers: "add a form", "let users submit", "validation", "edit profile",
  "create entity", "settings page", "checkout", "wizard", "multi-step".
---

# Build a validated form with Convex submit

The base template ships `<Input>`, `<TextArea>`, `<Button>` from `@appio/ui`,
but does **not** wire up form state, validation, or submission. Forms written
without this skill tend to:
- validate on every keystroke (jittery UX)
- never disable the submit button mid-submit (double-submits)
- show validation errors in `alert()` boxes (looks like 1998)
- skip server-side error display (silent failures)

Use this skill any time the user asks for input → action.

## Required deps

If `react-hook-form` and `zod` aren't already in `package.json`, install them
together:

```bash
npm install react-hook-form zod @hookform/resolvers
```

Don't add `react-hook-form` without `zod` — the resolver glue is what gives
you per-field error objects keyed by field name.

## Standard pattern (single-page form)

`src/components/forms/HabitForm.tsx`:

```tsx
"use client";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Input, TextArea, Button } from "@appio/ui";

const HabitSchema = z.object({
  name: z.string().trim().min(1, "Required").max(80, "Keep it under 80 chars"),
  goal: z.string().trim().max(280, "Too long").optional(),
});
type HabitInput = z.infer<typeof HabitSchema>;

export function HabitForm({ onDone }: { onDone?: () => void }) {
  const create = useMutation(api.habits.create);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
    setError,
  } = useForm<HabitInput>({
    resolver: zodResolver(HabitSchema),
    mode: "onSubmit",        // validate on submit, not keystroke
    reValidateMode: "onChange",
  });

  const onSubmit = handleSubmit(async (values) => {
    try {
      await create(values);
      reset();
      onDone?.();
    } catch (err) {
      setError("root", {
        message: err instanceof Error ? err.message : "Couldn't save",
      });
    }
  });

  return (
    <form onSubmit={onSubmit} noValidate>
      <Input
        label="Name"
        {...register("name")}
        error={errors.name?.message}
        autoFocus
      />
      <TextArea label="Goal (optional)" {...register("goal")} error={errors.goal?.message} />
      {errors.root && <p className="text-sm text-red-600">{errors.root.message}</p>}
      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Saving…" : "Save"}
      </Button>
    </form>
  );
}
```

## Convex mutation contract

The mutation that backs the form should:
1. Re-validate inputs server-side with the same Zod schema (don't trust the
   client) — Convex validators (`v.string()`, etc.) cover types but not
   business rules like `.min(1)`.
2. Use `tenantMutation` from `convex/_helpers.ts` so multi-tenant isolation
   stays enforced.
3. `throw new ConvexError("readable message")` for known-bad inputs — the
   message becomes `err.message` on the client, which `setError("root", ...)`
   surfaces inline.

```ts
// convex/habits.ts
import { ConvexError, v } from "convex/values";
import { tenantMutation } from "./_helpers";

export const create = tenantMutation({
  args: { name: v.string(), goal: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const trimmed = args.name.trim();
    if (trimmed.length === 0) throw new ConvexError("Name required");
    return await ctx.db.insert("habits", {
      tenantId: ctx.tenantId,
      name: trimmed,
      goal: args.goal?.trim(),
      createdAt: Date.now(),
    });
  },
});
```

## Multi-step pattern

For 2-3 steps (onboarding, checkout), keep all fields in one form and gate
each step on per-step validation rather than splitting into multiple forms:

```tsx
const [step, setStep] = useState(1);
const { trigger } = useForm({...});

async function next() {
  const fields = step === 1 ? ["email", "name"] as const : ["password"] as const;
  if (await trigger(fields)) setStep(step + 1);
}
```

Splitting into multiple `<form>` elements forces extra state management and
loses cross-step validation. Don't do it unless steps are truly independent.

## Common pitfalls

- **Don't use `mode: "all"` or `mode: "onChange"` as default** — validating
  every keystroke makes the UI feel anxious. `onSubmit` + `reValidateMode:
  "onChange"` is the right default.
- **Don't forget `noValidate` on `<form>`** — without it, the browser's own
  HTML5 validation pops up tooltips that conflict with our inline errors.
- **Don't put `<form>` inside a `<form>`** — even via composition. React
  doesn't warn but the inner submit bubbles to the outer.
- **Don't show server errors in toasts only** — toasts disappear; the user
  loses what went wrong. Always render server errors inline in the form.
- **Don't bypass `register()` with `value` + `onChange`** — that turns the
  field into a controlled component and silently disables RHF's dirty
  tracking and `reset()`. If you must, use `<Controller>` instead.

## When NOT to use this skill

- Login/signup → use the pre-built `<LoginScreen>` from `@appio/ui` instead.
- Search inputs → those are typically not "submit" forms; just use
  `<Input>` + `useState` + `useDebounce`.
- One-tap actions (like, follow, delete) → those are mutations attached to a
  `<Button>` directly, no form needed.
