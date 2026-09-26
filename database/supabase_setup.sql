-- TeamHub Supabase setup
-- Run database/schema.sql first, then this file in Supabase SQL Editor.

create or replace function public.my_role()
returns public.user_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function public.my_establishment()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select establishment_id from public.profiles where id = auth.uid();
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.my_role() = 'admin', false);
$$;

create or replace function public.is_manager()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.my_role() in ('admin','manager'), false);
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  first_user boolean;
  est_id uuid;
begin
  insert into public.establishments(name, code)
  values ('Pizza Cosy Bourgoin Jallieu','BOURGOIN')
  on conflict (code) do nothing;

  select id into est_id from public.establishments where code='BOURGOIN' limit 1;
  select not exists(select 1 from public.profiles) into first_user;

  insert into public.profiles(id, full_name, role, establishment_id)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email,'@',1)),
    case when first_user then 'admin'::public.user_role else 'employee'::public.user_role end,
    est_id
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

alter table public.establishments enable row level security;
alter table public.profiles enable row level security;
alter table public.documents enable row level security;
alter table public.tasks enable row level security;
alter table public.task_completions enable row level security;
alter table public.requests enable row level security;
alter table public.reports enable row level security;
alter table public.notifications enable row level security;

drop policy if exists establishments_select on public.establishments;
create policy establishments_select on public.establishments for select to authenticated
using (public.is_admin() or id = public.my_establishment());

drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select to authenticated
using (id = auth.uid() or public.is_manager());

drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self on public.profiles for update to authenticated
using (id = auth.uid() or public.is_admin())
with check (id = auth.uid() or public.is_admin());

drop policy if exists documents_select on public.documents;
create policy documents_select on public.documents for select to authenticated
using (public.is_admin() or establishment_id = public.my_establishment());

drop policy if exists documents_insert on public.documents;
create policy documents_insert on public.documents for insert to authenticated
with check (public.is_manager() and (public.is_admin() or establishment_id = public.my_establishment()));

drop policy if exists documents_update on public.documents;
create policy documents_update on public.documents for update to authenticated
using (public.is_manager() and (public.is_admin() or establishment_id = public.my_establishment()))
with check (public.is_manager() and (public.is_admin() or establishment_id = public.my_establishment()));

drop policy if exists tasks_select on public.tasks;
create policy tasks_select on public.tasks for select to authenticated
using (public.is_admin() or establishment_id = public.my_establishment());

drop policy if exists tasks_insert on public.tasks;
create policy tasks_insert on public.tasks for insert to authenticated
with check (public.is_manager() and (public.is_admin() or establishment_id = public.my_establishment()));

drop policy if exists tasks_update on public.tasks;
create policy tasks_update on public.tasks for update to authenticated
using (public.is_admin() or establishment_id = public.my_establishment())
with check (public.is_admin() or establishment_id = public.my_establishment());

drop policy if exists task_completions_select on public.task_completions;
create policy task_completions_select on public.task_completions for select to authenticated
using (exists(select 1 from public.tasks t where t.id=task_id and (public.is_admin() or t.establishment_id=public.my_establishment())));

drop policy if exists task_completions_insert on public.task_completions;
create policy task_completions_insert on public.task_completions for insert to authenticated
with check (completed_by=auth.uid() and exists(select 1 from public.tasks t where t.id=task_id and (public.is_admin() or t.establishment_id=public.my_establishment())));

drop policy if exists requests_select on public.requests;
create policy requests_select on public.requests for select to authenticated
using (public.is_admin() or establishment_id = public.my_establishment());

drop policy if exists requests_insert on public.requests;
create policy requests_insert on public.requests for insert to authenticated
with check (establishment_id = public.my_establishment());

drop policy if exists requests_update on public.requests;
create policy requests_update on public.requests for update to authenticated
using (public.is_manager() and (public.is_admin() or establishment_id = public.my_establishment()))
with check (public.is_manager() and (public.is_admin() or establishment_id = public.my_establishment()));

drop policy if exists reports_select on public.reports;
create policy reports_select on public.reports for select to authenticated
using (public.is_admin() or establishment_id = public.my_establishment());

drop policy if exists reports_insert on public.reports;
create policy reports_insert on public.reports for insert to authenticated
with check (public.is_manager() and (public.is_admin() or establishment_id = public.my_establishment()));

drop policy if exists reports_update on public.reports;
create policy reports_update on public.reports for update to authenticated
using (public.is_manager() and (public.is_admin() or establishment_id = public.my_establishment()))
with check (public.is_manager() and (public.is_admin() or establishment_id = public.my_establishment()));

drop policy if exists notifications_select on public.notifications;
create policy notifications_select on public.notifications for select to authenticated
using (user_id = auth.uid());

drop policy if exists notifications_update on public.notifications;
create policy notifications_update on public.notifications for update to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

grant usage on schema public to authenticated;
grant select, insert, update, delete on public.establishments, public.profiles, public.documents, public.tasks, public.task_completions, public.requests, public.reports, public.notifications to authenticated;
grant execute on function public.my_role(), public.my_establishment(), public.is_admin(), public.is_manager() to authenticated;

-- Private document storage
insert into storage.buckets (id, name, public)
values ('team-documents','team-documents',false)
on conflict (id) do nothing;

drop policy if exists team_documents_select on storage.objects;
create policy team_documents_select on storage.objects for select to authenticated
using (bucket_id='team-documents' and (public.is_admin() or (storage.foldername(name))[1] = public.my_establishment()::text));

drop policy if exists team_documents_insert on storage.objects;
create policy team_documents_insert on storage.objects for insert to authenticated
with check (bucket_id='team-documents' and public.is_manager() and (storage.foldername(name))[1] = public.my_establishment()::text);

drop policy if exists team_documents_update on storage.objects;
create policy team_documents_update on storage.objects for update to authenticated
using (bucket_id='team-documents' and public.is_manager() and (storage.foldername(name))[1] = public.my_establishment()::text)
with check (bucket_id='team-documents' and public.is_manager() and (storage.foldername(name))[1] = public.my_establishment()::text);

drop policy if exists team_documents_delete on storage.objects;
create policy team_documents_delete on storage.objects for delete to authenticated
using (bucket_id='team-documents' and public.is_manager() and (storage.foldername(name))[1] = public.my_establishment()::text);
