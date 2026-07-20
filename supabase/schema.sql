create extension if not exists pgcrypto;

create table if not exists customers (
  id uuid primary key default gen_random_uuid(),
  company_name text not null,
  contact_name text,
  phone text,
  email text,
  address text,
  created_at timestamptz not null default now()
);

create table if not exists operators (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  role text not null default 'Operatör',
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists jobs (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references customers(id) on delete set null,
  operator_id uuid references operators(id) on delete set null,
  job_no text not null,
  part_name text not null,
  material text,
  thickness numeric,
  quantity integer not null default 1,
  due_date date,
  status text not null default 'Bekliyor',
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists inventory (
  id uuid primary key default gen_random_uuid(),
  material text not null,
  thickness numeric not null,
  width_mm integer,
  height_mm integer,
  quantity integer not null default 0,
  critical_level integer not null default 2,
  created_at timestamptz not null default now()
);

create table if not exists quotes (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references customers(id) on delete set null,
  quote_no text not null unique,
  valid_until date,
  vat_rate numeric not null default 20,
  discount_rate numeric not null default 0,
  subtotal numeric not null default 0,
  discount_total numeric not null default 0,
  vat_total numeric not null default 0,
  grand_total numeric not null default 0,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists quote_items (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references quotes(id) on delete cascade,
  description text not null,
  quantity numeric not null default 1,
  unit text not null default 'Adet',
  unit_price numeric not null default 0,
  line_total numeric not null default 0
);

create table if not exists company_settings (
  id integer primary key default 1 check (id = 1),
  company_name text,
  slogan text,
  phone text,
  email text,
  address text,
  tax_office text,
  tax_no text,
  iban text,
  logo_data_url text
);

insert into operators (full_name, role, active)
select 'Yusuf Altuntaş', 'Yönetici', true
where not exists (select 1 from operators where full_name = 'Yusuf Altuntaş');

insert into operators (full_name, role, active)
select 'Yasin Altuntaş', 'Operatör', true
where not exists (select 1 from operators where full_name = 'Yasin Altuntaş');

insert into company_settings (id, company_name, slogan)
values (1, 'Laserce Metal', 'Metalin Sanatla Buluşması')
on conflict (id) do nothing;

alter table customers enable row level security;
alter table operators enable row level security;
alter table jobs enable row level security;
alter table inventory enable row level security;
alter table quotes enable row level security;
alter table quote_items enable row level security;
alter table company_settings enable row level security;

drop policy if exists "customers_all" on customers;
create policy "customers_all" on customers for all using (true) with check (true);

drop policy if exists "operators_all" on operators;
create policy "operators_all" on operators for all using (true) with check (true);

drop policy if exists "jobs_all" on jobs;
create policy "jobs_all" on jobs for all using (true) with check (true);

drop policy if exists "inventory_all" on inventory;
create policy "inventory_all" on inventory for all using (true) with check (true);

drop policy if exists "quotes_all" on quotes;
create policy "quotes_all" on quotes for all using (true) with check (true);

drop policy if exists "quote_items_all" on quote_items;
create policy "quote_items_all" on quote_items for all using (true) with check (true);

drop policy if exists "company_settings_all" on company_settings;
create policy "company_settings_all" on company_settings for all using (true) with check (true);
