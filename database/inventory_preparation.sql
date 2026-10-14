-- CosyHub — Inventory and preparation tables
-- Applied to Supabase as migration: create_inventory_preparation_foundation
-- This file documents the additive migration; do not rerun manually unless needed.

create table if not exists public.inventory_products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null default 'À classer',
  unit text not null default 'pièce',
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists inventory_products_name_category_uidx
  on public.inventory_products (lower(name), lower(category));

create table if not exists public.prep_recommendations (
  id uuid primary key default gen_random_uuid(),
  establishment_id uuid not null references public.establishments(id) on delete cascade,
  product_id uuid not null references public.inventory_products(id) on delete cascade,
  service text not null check (service in ('lunch','dinner')),
  recommended_quantity numeric(12,3) not null default 0 check (recommended_quantity >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (establishment_id, product_id, service)
);

create table if not exists public.inventory_sessions (
  id uuid primary key default gen_random_uuid(),
  establishment_id uuid not null references public.establishments(id) on delete cascade,
  service text not null check (service in ('lunch','dinner')),
  service_date date not null,
  status text not null default 'draft' check (status in ('draft','submitted','preparation_generated')),
  created_by uuid references public.profiles(id) on delete set null default auth.uid(),
  submitted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (establishment_id, service, service_date)
);

create table if not exists public.inventory_lines (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.inventory_sessions(id) on delete cascade,
  product_id uuid not null references public.inventory_products(id) on delete restrict,
  stock_quantity numeric(12,3) check (stock_quantity >= 0),
  recommended_quantity numeric(12,3) not null default 0 check (recommended_quantity >= 0),
  prep_quantity numeric(12,3) generated always as (greatest(recommended_quantity - coalesce(stock_quantity, 0), 0)) stored,
  counted_by uuid references public.profiles(id) on delete set null default auth.uid(),
  counted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (session_id, product_id)
);

alter table public.inventory_products enable row level security;
alter table public.prep_recommendations enable row level security;
alter table public.inventory_sessions enable row level security;
alter table public.inventory_lines enable row level security;

-- RLS policies were applied in the Supabase migration.
-- Policies use public.is_admin(), public.is_manager() and public.my_establishment().
