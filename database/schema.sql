-- TeamHub / Pizza Cosy
-- PostgreSQL / Supabase compatible schema
-- Authentication is handled by Supabase Auth (auth.users).

create extension if not exists pgcrypto;

create type public.user_role as enum ('admin','manager','employee');
create type public.task_priority as enum ('normal','high','urgent');
create type public.task_status as enum ('todo','done');
create type public.request_status as enum ('new','in_progress','resolved','closed');
create type public.document_category as enum ('technical','procedure','haccp','other');

create table public.establishments (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  code text unique,
  created_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  role public.user_role not null default 'employee',
  establishment_id uuid references public.establishments(id) on delete set null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.documents (
  id uuid primary key default gen_random_uuid(),
  establishment_id uuid references public.establishments(id) on delete cascade,
  title text not null,
  category public.document_category not null default 'technical',
  storage_path text not null,
  file_name text not null,
  version integer not null default 1,
  uploaded_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  establishment_id uuid references public.establishments(id) on delete cascade,
  title text not null,
  description text,
  assigned_to uuid references public.profiles(id) on delete set null,
  created_by uuid references public.profiles(id) on delete set null,
  due_date date not null,
  priority public.task_priority not null default 'normal',
  status public.task_status not null default 'todo',
  recurrence text,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  updated_at timestamptz not null default now()
);

create table public.task_completions (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  completed_by uuid references public.profiles(id) on delete set null,
  completed_at timestamptz not null default now()
);

create table public.requests (
  id uuid primary key default gen_random_uuid(),
  establishment_id uuid references public.establishments(id) on delete cascade,
  title text not null,
  description text,
  request_type text not null,
  priority public.task_priority not null default 'normal',
  status public.request_status not null default 'new',
  created_by uuid references public.profiles(id) on delete set null,
  assigned_to uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  updated_at timestamptz not null default now()
);

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  establishment_id uuid references public.establishments(id) on delete cascade,
  week_label text not null,
  revenue numeric(12,2),
  clients integer,
  average_ticket numeric(10,2),
  rating numeric(4,2),
  comments text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique(establishment_id, week_label)
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  type text not null,
  title text not null,
  message text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index tasks_assigned_to_idx on public.tasks(assigned_to);
create index tasks_due_date_idx on public.tasks(due_date);
create index requests_status_idx on public.requests(status);
create index documents_establishment_idx on public.documents(establishment_id);
create index notifications_user_idx on public.notifications(user_id, read_at);

-- Storage bucket expected: team-documents
-- Recommended folder convention:
-- {establishment_id}/{document_id}/{file_name}

-- The application backend will enforce:
-- admin: all establishments
-- manager: own establishment
-- employee: own tasks, documents and requests allowed by policy
