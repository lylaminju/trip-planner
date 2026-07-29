# Atomic Multi-Write Transactions

Supabase clients talk to PostgREST, and every client call commits on its own.
There is no `BEGIN`/`COMMIT` across two `getSupabaseClient()` calls, so a
sequence of related writes from the service layer is not a transaction: each
step that succeeds stays committed even when a later step fails.

## Rule

When two or more writes share an invariant — the database is corrupt if one
commits without the others — put them in a single `security definer` plpgsql
function and call it through one `rpc()`. Do not sequence them from TypeScript.

Writes that do not share an invariant stay as plain client calls. A failure
between independent writes leaves consistent data and a retry completes the
rest.

Existing functions that follow this rule:

- `reconcile_route_segments_for_trip` — deletes and inserts route segments as
  one unit.
- `update_trip_dates_and_realign_visits` — commits a trip's new dates and its
  itinerary realignment together (issue #43).

## Example: trip date edit (issue #43)

A trip runs July 12–18 with visits on July 12 (item 1) and July 18 (item 2).
The owner moves it to August 1–7.

### Before: sequenced client writes

```
1. UPDATE trips SET start_date='2027-08-01', end_date='2027-08-07'    -- commits
2. UPDATE itinerary_items SET visit_date='2027-08-01' WHERE id IN (1) -- commits
3. UPDATE itinerary_items SET visit_date='2027-08-07' WHERE id IN (2) -- fails
```

Each statement is its own transaction. After the failure the trip says
August 1–7 while item 2 still says July 18: the itinerary renders empty August
days with an orphaned July day appended.

The corruption is not self-healing. A retry reads the trip's dates as already
August 1–7, computes a zero-day shift against the requested August 1–7, and
writes nothing. Recovery requires a manual data fix.

### After: one RPC, one transaction

```ts
await getSupabaseClient().rpc("update_trip_dates_and_realign_visits", {
  p_trip_id: 1,
  p_prev_start_date: "2027-07-12",
  p_prev_end_date: "2027-07-18",
  p_next_start_date: "2027-08-01",
  p_next_end_date: "2027-08-07",
  p_visit_changes: [
    { id: 1, visit_date: "2027-08-01" },
    { id: 2, visit_date: "2027-08-07" },
  ],
});
```

Inside the function, the trip update, every visit-date change, and the route
reconciliation for unscheduled visits run in the function's single transaction.
The same mid-flight failure now rolls all of it back: the trip is still
July 12–18, the visits are untouched, and a retry re-reads consistent state and
succeeds.

## Anatomy of an atomic RPC

All examples below are from `update_trip_dates_and_realign_visits`, which
satisfies every item. The function is defined in both
`supabase/migrations/` and `supabase/schema.sql`, and the migration applies
before the app code that calls it deploys.

### Lock the function down to the server

```sql
create or replace function public.update_trip_dates_and_realign_visits(...)
returns void
language plpgsql
security definer
set search_path = public
as $$ ... $$;

revoke all on function public.update_trip_dates_and_realign_visits(...) from public;
grant execute on function public.update_trip_dates_and_realign_visits(...) to service_role;
```

`security definer` runs the function with its owner's privileges instead of the
caller's, so it can write tables the caller's row-level security would block.
That power is why the other two lines exist: `set search_path = public` pins
which tables the body resolves to, so a caller cannot plant a same-named table
in another schema and have the function write there; the `revoke`/`grant` pair
removes the default public execute right and leaves `service_role` — the key
the Next.js server uses — as the only caller. Browsers hold `anon`/
`authenticated` keys and cannot invoke it.

### Guard against stale caller snapshots

The service reads the trip, computes visit changes from what it read, then
calls the function. Another request can change the trip between that read and
the call, which would make the computed changes wrong. The function therefore
receives the dates the caller saw and refuses to proceed if the row no longer
matches them:

```sql
update public.trips
set start_date = p_next_start_date, end_date = p_next_end_date, updated_at = now()
where id = p_trip_id
  and deleted_at is null
  and start_date is not distinct from p_prev_start_date
  and end_date is not distinct from p_prev_end_date;
```

`is not distinct from` is `=` that also treats two nulls as equal. Plain
`start_date = p_prev_start_date` evaluates to null when either side is null, so
a trip with no dates yet would never match its own snapshot.

### Raise when a guarded update matches nothing

In SQL, an `update` whose `where` clause matches zero rows succeeds silently.
If the snapshot guard rejects the row, the statement "succeeds", the visit
changes below it still run, and the caller gets a 200 — exactly the corruption
the guard exists to prevent. Zero rows must become an error:

```sql
get diagnostics updated_trip_count = row_count;
if updated_trip_count = 0 then
  raise exception
    'trip % is missing or its dates changed concurrently; visit realignment aborted',
    p_trip_id;
end if;
```

`raise exception` also rolls back the function's whole transaction, so nothing
before the check survives either.

### Reuse existing functions with `perform`

A function called inside another function joins the caller's transaction. When
a shrunken trip unschedules a visit, its route segments dangle, and the
reconciliation must not be a separate follow-up call that can fail on its own:

```sql
if coalesce(unschedules_visit, false) then
  perform public.reconcile_route_segments_for_trip(p_trip_id);
end if;
```

`perform` is plpgsql's "call and discard the result". If reconciliation fails,
the date change and visit shifts roll back with it; if the outer function fails
later, the reconciliation rolls back too.
