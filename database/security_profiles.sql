-- PIZZA COSY — sécurité des profils et comptes
-- À exécuter dans Supabase SQL Editor.
-- Cette migration retire le droit UPDATE direct sur profiles et passe
-- les modifications sensibles par des fonctions contrôlées côté PostgreSQL.

create or replace function public.update_my_profile(
  p_full_name text,
  p_phone text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Non authentifié.';
  end if;

  update public.profiles
  set
    full_name = nullif(trim(p_full_name), ''),
    phone = nullif(trim(p_phone), ''),
    updated_at = now()
  where id = auth.uid();

  if not found then
    raise exception 'Profil introuvable.';
  end if;

  return true;
end;
$$;

create or replace function public.complete_first_login(
  p_full_name text,
  p_phone text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Non authentifié.';
  end if;

  update public.profiles
  set
    full_name = nullif(trim(p_full_name), ''),
    phone = nullif(trim(p_phone), ''),
    must_set_password = false,
    updated_at = now()
  where id = auth.uid()
    and must_set_password = true;

  if not found then
    raise exception 'Cette procédure de première connexion n’est plus disponible.';
  end if;

  return true;
end;
$$;

create or replace function public.admin_update_profile(
  p_user_id uuid,
  p_full_name text,
  p_phone text,
  p_role public.user_role,
  p_is_active boolean
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_role public.user_role;
  admin_count integer;
begin
  if auth.uid() is null then
    raise exception 'Non authentifié.';
  end if;

  if not exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'admin'::public.user_role
  ) then
    raise exception 'Accès réservé aux administrateurs.';
  end if;

  select role
    into target_role
  from public.profiles
  where id = p_user_id
  for update;

  if target_role is null then
    raise exception 'Utilisateur introuvable.';
  end if;

  if p_user_id = auth.uid()
     and (p_role <> 'admin'::public.user_role or p_is_active = false) then
    raise exception 'Vous ne pouvez pas retirer vos propres droits administrateur ni désactiver votre compte.';
  end if;

  if target_role = 'admin'::public.user_role
     and (p_role <> 'admin'::public.user_role or p_is_active = false) then

    select count(*)
      into admin_count
    from public.profiles
    where role = 'admin'::public.user_role
      and is_active = true;

    if admin_count <= 1 then
      raise exception 'Impossible de retirer le dernier administrateur actif.';
    end if;
  end if;

  update public.profiles
  set
    full_name = nullif(trim(p_full_name), ''),
    phone = nullif(trim(p_phone), ''),
    role = p_role,
    is_active = p_is_active,
    updated_at = now()
  where id = p_user_id;

  return true;
end;
$$;

revoke update on table public.profiles from authenticated;

revoke execute on function public.update_my_profile(text,text) from public, anon;
revoke execute on function public.complete_first_login(text,text) from public, anon;
revoke execute on function public.admin_update_profile(uuid,text,text,public.user_role,boolean) from public, anon;

grant execute on function public.update_my_profile(text,text) to authenticated;
grant execute on function public.complete_first_login(text,text) to authenticated;
grant execute on function public.admin_update_profile(uuid,text,text,public.user_role,boolean) to authenticated;

drop policy if exists profiles_update_self on public.profiles;


-- RLS opérationnelle pour les tâches
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
for select to authenticated
using (
  id = auth.uid()
  or public.is_admin()
  or (
    public.is_manager()
    and establishment_id = public.my_establishment()
  )
);

drop policy if exists tasks_select on public.tasks;
create policy tasks_select on public.tasks
for select to authenticated
using (
  public.is_admin()
  or (
    public.is_manager()
    and establishment_id = public.my_establishment()
  )
  or assigned_to = auth.uid()
);

drop policy if exists tasks_update on public.tasks;
create policy tasks_update on public.tasks
for update to authenticated
using (
  public.is_admin()
  or (
    public.is_manager()
    and establishment_id = public.my_establishment()
  )
  or assigned_to = auth.uid()
)
with check (
  public.is_admin()
  or (
    public.is_manager()
    and establishment_id = public.my_establishment()
  )
  or assigned_to = auth.uid()
);

create index if not exists profiles_establishment_idx
  on public.profiles(establishment_id);

create index if not exists tasks_assigned_to_status_idx
  on public.tasks(assigned_to, status);


-- Validation des tâches par RPC : un salarié ne peut pas modifier arbitrairement une tâche.
create or replace function public.complete_task(
  p_task_id uuid,
  p_done boolean
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_establishment uuid;
  target_assignee uuid;
begin
  if auth.uid() is null then
    raise exception 'Non authentifié.';
  end if;

  select establishment_id, assigned_to
    into target_establishment, target_assignee
  from public.tasks
  where id = p_task_id
  for update;

  if target_establishment is null then
    raise exception 'Tâche introuvable.';
  end if;

  if not (
    exists (
      select 1 from public.profiles
      where id = auth.uid()
        and role in ('admin'::public.user_role,'manager'::public.user_role)
        and (
          role = 'admin'::public.user_role
          or establishment_id = target_establishment
        )
        and is_active = true
    )
    or target_assignee = auth.uid()
  ) then
    raise exception 'Vous ne pouvez pas modifier cette tâche.';
  end if;

  update public.tasks
  set
    status = case when p_done then 'done'::public.task_status else 'todo'::public.task_status end,
    completed_at = case when p_done then now() else null end,
    updated_at = now()
  where id = p_task_id;

  if p_done then
    insert into public.task_completions(task_id, completed_by)
    values (p_task_id, auth.uid());
  end if;

  return true;
end;
$$;

revoke update on table public.tasks from authenticated;
revoke execute on function public.complete_task(uuid,boolean) from public, anon;
grant execute on function public.complete_task(uuid,boolean) to authenticated;


-- Lecture sécurisée du profil courant.
-- Le profil est lu via une fonction SECURITY DEFINER afin que
-- l'authentification ne dépende pas d'une policy RLS récursive.

create or replace function public.get_my_profile()
returns public.profiles
language sql
security definer
set search_path = ''
as $$
  select p
  from public.profiles p
  where p.id = auth.uid()
  limit 1;
$$;

revoke execute on function public.get_my_profile() from public, anon;
grant execute on function public.get_my_profile() to authenticated;


-- ============================================================
-- PIZZA COSY — ACCÈS À PLUSIEURS ÉTABLISSEMENTS
-- ============================================================

alter table public.establishments
  add column if not exists group_name text not null default 'Franchises',
  add column if not exists is_active boolean not null default true;

create table if not exists public.user_establishments (
  user_id uuid not null references public.profiles(id) on delete cascade,
  establishment_id uuid not null references public.establishments(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, establishment_id)
);

create index if not exists user_establishments_user_idx
  on public.user_establishments(user_id);

create index if not exists user_establishments_establishment_idx
  on public.user_establishments(establishment_id);

insert into public.establishments(name, code, group_name, is_active)
values
  ('Bourgoin-Jallieu','BOURGOIN','Franchises',true),
  ('Bron','BRON','Franchises',true),
  ('Caluire-et-Cuire','CALUIRE','Franchises',true),
  ('Grenoble Gare','GRENOBLE-GARE','Franchises',true),
  ('Lyon 6','LYON-6','Franchises',true),
  ('Villeurbanne','VILLEURBANNE','Franchises',true),
  ('Voiron','VOIRON','Franchises',true)
on conflict (code) do update
set name=excluded.name,
    group_name=excluded.group_name,
    is_active=true;

insert into public.user_establishments(user_id, establishment_id)
select p.id, p.establishment_id
from public.profiles p
where p.establishment_id is not null
on conflict do nothing;

insert into public.user_establishments(user_id, establishment_id)
select p.id, e.id
from public.profiles p
cross join public.establishments e
where p.role = 'admin'::public.user_role
  and e.is_active = true
on conflict do nothing;

alter table public.user_establishments enable row level security;

drop policy if exists user_establishments_select on public.user_establishments;
create policy user_establishments_select
on public.user_establishments
for select to authenticated
using (
  user_id = auth.uid()
  or public.is_admin()
);

drop policy if exists user_establishments_insert on public.user_establishments;
create policy user_establishments_insert
on public.user_establishments
for insert to authenticated
with check (public.is_admin());

drop policy if exists user_establishments_delete on public.user_establishments;
create policy user_establishments_delete
on public.user_establishments
for delete to authenticated
using (public.is_admin());

grant select on public.user_establishments to authenticated;
grant insert, delete on public.user_establishments to authenticated;
grant select on public.establishments to authenticated;

drop policy if exists establishments_select_authenticated on public.establishments;
create policy establishments_select_authenticated
on public.establishments
for select to authenticated
using (
  is_active = true
  and (
    public.is_admin()
    or exists (
      select 1
      from public.user_establishments ue
      where ue.user_id = auth.uid()
        and ue.establishment_id = establishments.id
    )
  )
);

create or replace function public.get_my_establishments()
returns table (
  id uuid,
  name text,
  code text,
  group_name text
)
language sql
security definer
set search_path = ''
stable
as $$
  select e.id, e.name, e.code, e.group_name
  from public.establishments e
  join public.user_establishments ue
    on ue.establishment_id = e.id
  where ue.user_id = auth.uid()
    and e.is_active = true
  order by e.group_name, e.name;
$$;

revoke execute on function public.get_my_establishments() from public, anon;
grant execute on function public.get_my_establishments() to authenticated;

create or replace function public.admin_get_user_establishments()
returns table (
  user_id uuid,
  establishment_id uuid
)
language sql
security definer
set search_path = ''
stable
as $$
  select ue.user_id, ue.establishment_id
  from public.user_establishments ue
  where exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'::public.user_role
      and p.is_active = true
  );
$$;

revoke execute on function public.admin_get_user_establishments() from public, anon;
grant execute on function public.admin_get_user_establishments() to authenticated;

create or replace function public.admin_set_user_establishments(
  p_user_id uuid,
  p_establishment_ids uuid[]
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_exists boolean;
begin
  if not exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'::public.user_role
      and p.is_active = true
  ) then
    raise exception 'Accès réservé aux administrateurs.';
  end if;

  if p_user_id is null then
    raise exception 'Utilisateur invalide.';
  end if;

  select exists (
    select 1
    from public.profiles p
    where p.id = p_user_id
  ) into target_exists;

  if not target_exists then
    raise exception 'Utilisateur introuvable.';
  end if;

  if coalesce(array_length(p_establishment_ids, 1), 0) = 0 then
    raise exception 'Sélectionnez au moins un magasin.';
  end if;

  if exists (
    select 1
    from unnest(p_establishment_ids) x
    where not exists (
      select 1
      from public.establishments e
      where e.id = x
        and e.is_active = true
    )
  ) then
    raise exception 'Un des magasins sélectionnés est invalide.';
  end if;

  delete from public.user_establishments
  where user_id = p_user_id;

  insert into public.user_establishments(user_id, establishment_id)
  select p_user_id, x
  from unnest(p_establishment_ids) x
  on conflict do nothing;

  update public.profiles
  set establishment_id = p_establishment_ids[1],
      updated_at = now()
  where id = p_user_id;

  return true;
end;
$$;

revoke execute on function public.admin_set_user_establishments(uuid,uuid[]) from public, anon;
grant execute on function public.admin_set_user_establishments(uuid,uuid[]) to authenticated;
