-- Rabisco · migration 0001
-- Tabelas, RLS, limites e bucket de imagens.
-- Rode no SQL Editor do Supabase (ou com `supabase db push`).
-- Regra do projeto: TODA tabela tem RLS ativa e políticas explícitas.

-- =====================================================================
-- Perfis
-- =====================================================================
create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  username    text not null check (char_length(username) between 1 and 32),
  avatar_url  text,
  role        text not null default 'user' check (role in ('user', 'mod')),
  created_at  timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "perfis: leitura pública"
  on public.profiles for select
  using (true);

create policy "perfis: o dono edita o próprio"
  on public.profiles for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- Só estas colunas podem ser editadas pelo usuário (ninguém muda o próprio "role").
revoke insert, update, delete on public.profiles from anon, authenticated;
grant update (username, avatar_url) on public.profiles to authenticated;

-- Cria o perfil automaticamente no primeiro login (Discord).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, username, avatar_url)
  values (
    new.id,
    left(coalesce(nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
                  nullif(trim(new.raw_user_meta_data ->> 'name'), ''),
                  'artista'), 32),
    new.raw_user_meta_data ->> 'avatar_url'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Moderadores: promova alguém manualmente no SQL Editor:
--   update public.profiles set role = 'mod' where id = '<uuid do usuário>';
create or replace function public.is_mod()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'mod');
$$;

-- =====================================================================
-- Posts
-- =====================================================================
create table public.posts (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles (id) on delete cascade,
  title       text not null check (char_length(title) between 1 and 80),
  image_path  text not null check (image_path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.png$'),
  strokes     jsonb check (strokes is null or pg_column_size(strokes) <= 1000000),
  remix_of    uuid references public.posts (id) on delete set null,
  hidden      boolean not null default false,
  created_at  timestamptz not null default now()
);

create index posts_created_idx on public.posts (created_at desc);
create index posts_user_idx on public.posts (user_id);

alter table public.posts enable row level security;

create policy "posts: leitura dos visíveis, dos próprios e para moderação"
  on public.posts for select
  using (not hidden or user_id = auth.uid() or public.is_mod());

create policy "posts: criar o próprio, na própria pasta"
  on public.posts for insert to authenticated
  with check (
    user_id = auth.uid()
    and hidden = false
    and image_path like auth.uid()::text || '/%'
  );

-- Só moderação oculta/reexibe posts (quem foi ocultado não consegue se reexibir).
create policy "posts: moderação atualiza"
  on public.posts for update to authenticated
  using (public.is_mod())
  with check (public.is_mod());

create policy "posts: apagar o próprio ou moderação"
  on public.posts for delete to authenticated
  using (user_id = auth.uid() or public.is_mod());

-- Limite: 20 posts por hora por usuário.
create or replace function public.limit_posts()
returns trigger
language plpgsql
as $$
begin
  if (select count(*) from public.posts
        where user_id = new.user_id and created_at > now() - interval '1 hour') >= 20 then
    raise exception 'Limite de 20 posts por hora atingido. Tente mais tarde.';
  end if;
  return new;
end;
$$;

create trigger posts_rate_limit
  before insert on public.posts
  for each row execute function public.limit_posts();

-- =====================================================================
-- Curtidas
-- =====================================================================
create table public.likes (
  post_id    uuid not null references public.posts (id) on delete cascade,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

alter table public.likes enable row level security;

create policy "curtidas: leitura pública"
  on public.likes for select
  using (true);

create policy "curtidas: curtir como si mesmo"
  on public.likes for insert to authenticated
  with check (user_id = auth.uid());

create policy "curtidas: descurtir a própria"
  on public.likes for delete to authenticated
  using (user_id = auth.uid());

-- =====================================================================
-- Comentários
-- =====================================================================
create table public.comments (
  id         uuid primary key default gen_random_uuid(),
  post_id    uuid not null references public.posts (id) on delete cascade,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  body       text not null check (char_length(body) between 1 and 500),
  created_at timestamptz not null default now()
);

create index comments_post_idx on public.comments (post_id, created_at);

alter table public.comments enable row level security;

create policy "comentários: leitura pública"
  on public.comments for select
  using (true);

create policy "comentários: comentar como si mesmo"
  on public.comments for insert to authenticated
  with check (user_id = auth.uid());

create policy "comentários: apagar o próprio ou moderação"
  on public.comments for delete to authenticated
  using (user_id = auth.uid() or public.is_mod());

-- =====================================================================
-- Denúncias (só a moderação lê)
-- =====================================================================
create table public.reports (
  id          uuid primary key default gen_random_uuid(),
  post_id     uuid not null references public.posts (id) on delete cascade,
  reporter_id uuid not null references public.profiles (id) on delete cascade,
  reason      text not null check (char_length(reason) between 1 and 300),
  created_at  timestamptz not null default now(),
  unique (post_id, reporter_id)
);

alter table public.reports enable row level security;

create policy "denúncias: denunciar como si mesmo"
  on public.reports for insert to authenticated
  with check (reporter_id = auth.uid());

create policy "denúncias: só moderação lê"
  on public.reports for select to authenticated
  using (public.is_mod());

create policy "denúncias: só moderação apaga"
  on public.reports for delete to authenticated
  using (public.is_mod());

-- =====================================================================
-- Storage: bucket público só para leitura; upload apenas na pasta do dono
-- =====================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('desenhos', 'desenhos', true, 2097152, array['image/png'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Bucket público: as imagens abrem pela URL pública sem política de leitura
-- (assim ninguém consegue listar o bucket inteiro).

create policy "desenhos: upload na própria pasta"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'desenhos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "desenhos: apagar os próprios ou moderação"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'desenhos'
    and ((storage.foldername(name))[1] = auth.uid()::text or public.is_mod())
  );
