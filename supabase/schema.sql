-- HYPE DROP MX — esquema Supabase
-- Cómo usarlo: en el panel de Supabase, abre el SQL Editor, pega
-- este archivo completo y dale a Run. Crea las 3 tablas con sus índices.
-- No lleva ninguna clave ni URL: el servidor se conecta por variables
-- de entorno (SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY).

create table if not exists conversations (
  id uuid primary key default gen_random_uuid(),
  phone text not null,
  business text not null default 'hype-drop-mx',
  status text not null default 'nuevo',
  created_at timestamptz not null default now()
);

create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references conversations (id) on delete cascade,
  direction text not null check (direction in ('in', 'out')),
  body text not null,
  created_at timestamptz not null default now()
);

create table if not exists leads (
  id uuid primary key default gen_random_uuid(),
  phone text not null,
  name text,
  interest text,
  status text not null default 'pendiente',
  created_at timestamptz not null default now()
);

create index if not exists idx_conversations_phone on conversations (phone);
create index if not exists idx_messages_conversation on messages (conversation_id);
create index if not exists idx_leads_status on leads (status);
