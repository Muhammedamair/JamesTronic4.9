-- C20: Allow managers/admins to create scenario runs (pending) within allowed city scope
-- Fixes: RLS_INSERT_DENIED on expansion_scenario_runs

alter table public.expansion_scenario_runs enable row level security;

-- SELECT: allow authenticated to read runs only for accessible cities
drop policy if exists runs_select_city on public.expansion_scenario_runs;
create policy runs_select_city
on public.expansion_scenario_runs
for select
to authenticated
using (
  public._c20_is_city_accessible(city_id)
);

-- INSERT: allow manager/admin/super_admin to create ONLY pending runs in accessible city
drop policy if exists runs_insert_manager_pending on public.expansion_scenario_runs;
create policy runs_insert_manager_pending
on public.expansion_scenario_runs
for insert
to authenticated
with check (
  public._c20_is_city_accessible(city_id)
  and public.get_my_role() in ('manager','admin','super_admin')
  and created_by = auth.uid()
  and status = 'pending'
);

-- UPDATE/DELETE: keep locked down (service role only)
drop policy if exists runs_update_service_only on public.expansion_scenario_runs;
create policy runs_update_service_only
on public.expansion_scenario_runs
for update
to service_role
using (true)
with check (true);

drop policy if exists runs_delete_service_only on public.expansion_scenario_runs;
create policy runs_delete_service_only
on public.expansion_scenario_runs
for delete
to service_role
using (true);
