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
