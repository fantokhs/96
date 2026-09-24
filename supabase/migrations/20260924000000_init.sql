-- 96 | Majlis party game — initial schema
-- All access goes through the Next.js API using the service role key.
-- RLS is enabled with NO public policies, so the anon key can't read answers or game state.

create table if not exists public.themes (
  id text primary key,
  name text not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.categories (
  id text primary key default gen_random_uuid()::text,
  theme_id text not null references public.themes(id) on delete cascade,
  name text not null,
  description text,
  color text not null default '#22A06B',
  pattern text not null default 'star' check (pattern in ('star','lattice','arches','chevron','dots','waves')),
  mode text not null default 'normal' check (mode in ('normal','buzzer')),
  sort integer not null default 100,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.questions (
  id text primary key default gen_random_uuid()::text,
  theme_id text not null references public.themes(id) on delete cascade,
  category_id text not null references public.categories(id) on delete cascade,
  question text not null,
  answer text not null,
  type text not null default 'TEXT' check (type in ('TEXT','MULTIPLE_CHOICE','TRUE_FALSE','IMAGE','COMPLETE_PHRASE')),
  points integer not null default 100,
  image_url text,
  options jsonb,
  correct_option integer,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists questions_category_idx on public.questions(category_id);

-- One row per live game. `state` holds the whole game document (players, teams,
-- scores, phase, and a private snapshot of the questions). `version` gives
-- optimistic concurrency so simultaneous votes/buzzes never overwrite each other.
create table if not exists public.sessions (
  code text primary key,
  host_token_hash text not null,
  state jsonb not null,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Player photos and question images (small, already resized in the browser).
create table if not exists public.media (
  id text primary key,
  content_type text not null,
  data text not null,
  created_at timestamptz not null default now()
);

alter table public.themes enable row level security;
alter table public.categories enable row level security;
alter table public.questions enable row level security;
alter table public.sessions enable row level security;
alter table public.media enable row level security;
