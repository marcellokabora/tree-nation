# Copilot Instructions — Tree Nation

## Project Overview

A SvelteKit application that tracks customer shop visits and plants trees on behalf of customers. Every `X_VISITS_PER_TREE` visits (default: 10) earns the customer one planted tree.

## Tech Stack

- **Framework**: SvelteKit (adapter-node)
- **Language**: TypeScript — strict mode enabled (see `tsconfig.json`)
- **Styling**: Tailwind CSS v4
- **Database**: SQLite via **Drizzle ORM** (libsql/client)
- **Validation**: **Zod** for all external / request-body input
- **Testing**: Vitest (`tests/`)
- **API style**: SvelteKit `+server.ts` route handlers returning `json()`

## TypeScript Rules

- `strict: true` is enforced — never use `any`.
- All function parameters, return types, and variables must be explicitly typed or correctly inferred.
- Use the exported types from `$lib/services/visit.service.ts` wherever possible:
  - `Customer` — inferred from the `customers` Drizzle table
  - `VisitBucket` — `{ time: string; count: number }`
  - `Granularity` — `'minute' | 'hour' | 'day' | 'week' | 'month'`

## Project Structure

```
src/
  lib/
    config.ts              # X_VISITS_PER_TREE env var
    db/
      schema.ts            # Drizzle table definitions (customers, visits)
      index.ts             # Drizzle db instance
      migrations/          # SQL migrations
    services/
      visit.service.ts     # All DB logic: recordVisit, getVisits, getCustomer, getTotalTreesPlanted
  routes/
    api/
      visits/+server.ts            # POST — record a visit
      customers/[id]/+server.ts    # GET — fetch customer
      stats/visits/+server.ts            # GET — visit stats across all granularities + total trees
      health/+server.ts            # GET — health check
```

## Key Patterns

### Service layer

All database access goes through `$lib/services/visit.service.ts`. Route handlers must not import from `$lib/db` directly.

Wrap all service calls in `try/catch`. On unexpected errors return a generic 500 — do not leak error details to the client:

```ts
try {
  const result = await someServiceCall();
} catch {
  return json({ error: "Internal server error" }, { status: 500 });
}
```

If a service returns `null` for a missing resource, respond with 404:

```ts
const customer = await getCustomer(id);
if (!customer) return json({ error: "Customer not found" }, { status: 404 });
```

### Input validation

Validate every untrusted input with Zod before use. Example from `visits/+server.ts`:

```ts
const VisitSchema = z.object({
  customerId: z.string().min(1, "customerId is required"),
});
const result = VisitSchema.safeParse(body);
if (!result.success)
  return json({ error: result.error.issues[0].message }, { status: 400 });
```

### Stats endpoint return shape

`GET /api/stats/visits` returns all granularities at once:

```ts
{
    visitsPerMinute: VisitBucket[],
    visitsPerHour:   VisitBucket[],
    visitsPerDay:    VisitBucket[],
    visitsPerWeek:   VisitBucket[],
    visitsPerMonth:  VisitBucket[],
    totalTrees:      number,
}
```

### Database schema

- `customers(id TEXT PK, last_connection TEXT, total_visits INT, trees_planted INT)`
- `visits(id INT PK autoincrement, customer_id TEXT FK→customers, visited_at TEXT)`

Dates are stored as ISO-8601 strings.

## Tailwind CSS Patterns

### Responsive visibility — prefer `max-*` variants over multi-class combos

Target the element that needs to change, not the parent. Use a single `max-sm:` (or `max-md:`, etc.) class instead of stacking `flex flex-col sm:block`.

```html
<!-- ✅ One class on the element that changes -->
<small class="max-sm:block">...</small>

<!-- ❌ Three classes on the parent + an extra wrapper -->
<h2 class="flex flex-col sm:block">
  <span>Title</span>
  <small>...</small>
</h2>
```

### Color tokens — always use `brand-*`, never raw `green-*`

Semantic color tokens are defined in `src/app.css` via `@theme`. Always use these instead of hardcoded Tailwind palette classes:

| Token                 | Tailwind palette | Purpose                             |
| --------------------- | ---------------- | ----------------------------------- |
| `brand-bg`            | `green-50`       | Page background                     |
| `brand-surface`       | `white`          | Card / panel backgrounds            |
| `brand-border`        | `green-200`      | Default borders                     |
| `brand-border-strong` | `green-300`      | Accent / emphasis borders           |
| `brand-accent`        | `green-100`      | Accent fill (e.g. highlighted card) |
| `brand-primary`       | `green-600`      | Active buttons, focus rings         |
| `brand-muted`         | `green-600`      | Secondary / subtitle text           |
| `brand-subtle`        | `green-500`      | Empty-state / placeholder text      |
| `brand-label`         | `green-800`      | Labels inside cards                 |
| `brand-text`          | `green-900`      | Body text                           |

```html
<!-- ✅ Use brand tokens -->
<div class="bg-brand-surface border border-brand-border">...</div>
<p class="text-brand-muted">...</p>

<!-- ❌ Never use raw palette classes -->
<div class="bg-white border border-green-200">...</div>
<p class="text-green-600">...</p>
```

## What to Avoid

- `any` type — use proper types or generics.
- Direct SQL — use Drizzle query builder.
- Accessing the database outside the service layer.
- Returning untyped or loosely typed API responses.
