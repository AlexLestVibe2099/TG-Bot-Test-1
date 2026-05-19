-- Выполните в Supabase: SQL Editor → New query → Run

create table if not exists categories (
  id text primary key,
  label text not null,
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists managers (
  id text primary key,
  name text not null,
  role text not null,
  telegram_chat_id bigint,
  is_active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists leads (
  id uuid primary key default gen_random_uuid(),
  external_id text not null unique,
  created_at timestamptz not null,
  telegram_user_id bigint not null,
  username text not null default '',
  display_name text not null,
  phone text not null,
  category_id text not null references categories (id),
  category_label text not null,
  description text not null,
  urgency text not null,
  has_documents text not null,
  contact_method text not null,
  status text not null default 'Новая'
);

create index if not exists leads_created_at_idx on leads (created_at desc);
create index if not exists leads_telegram_user_id_idx on leads (telegram_user_id);

-- Начальные данные (можно менять в Table Editor)
insert into categories (id, label, sort_order) values
  ('family', 'Семейное право', 1),
  ('labor', 'Трудовой спор', 2),
  ('realty', 'Недвижимость', 3),
  ('debts', 'Долги', 4),
  ('business', 'Бизнес', 5),
  ('inheritance', 'Наследство', 6),
  ('other', 'Другое', 7)
on conflict (id) do nothing;

insert into managers (id, name, role, sort_order) values
  ('mgr_1', 'Анна Смирнова', 'Семейное право, наследство', 1),
  ('mgr_2', 'Дмитрий Козлов', 'Трудовые споры, бизнес', 2),
  ('mgr_3', 'Елена Волкова', 'Недвижимость, долги', 3)
on conflict (id) do nothing;
