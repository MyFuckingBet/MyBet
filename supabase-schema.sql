-- MyBet v4 - Schema completo com autenticação e perfis
-- ATENÇÃO: isso apaga tudo e recria do zero

drop function if exists resolve_outcome cascade;
drop function if exists resolve_choice cascade;
drop function if exists resolve_bet cascade;
drop table if exists debts cascade;
drop table if exists picks cascade;
drop table if exists outcomes cascade;
drop table if exists bets cascade;
drop table if exists rooms cascade;
drop table if exists profiles cascade;

-- Perfis (ligados ao Supabase Auth)
create table profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  name text not null,
  avatar_url text,
  pix_key text,
  phone text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Salas
create table rooms (
  id uuid default gen_random_uuid() primary key,
  slug text unique not null,
  name text not null,
  admin_id uuid references profiles(id),
  admin_pix text,
  created_at timestamptz default now()
);

-- Apostas
create table bets (
  id uuid default gen_random_uuid() primary key,
  room_id uuid references rooms(id) on delete cascade not null,
  title text not null,
  bet_type text not null default 'binary' check (bet_type in ('binary','timeline','choice')),
  status text default 'open' check (status in ('open','resolved')),
  created_by uuid references profiles(id),
  created_at timestamptz default now()
);

-- Ocasionalidades
create table outcomes (
  id uuid default gen_random_uuid() primary key,
  bet_id uuid references bets(id) on delete cascade not null,
  label text not null,
  pool_sim numeric default 0,
  pool_nao numeric default 0,
  pool_choice numeric default 0,
  status text default 'open' check (status in ('open','resolved')),
  result text,
  resolved_at timestamptz,
  sort_order int default 0
);

-- Palpites
create table picks (
  id uuid default gen_random_uuid() primary key,
  outcome_id uuid references outcomes(id) on delete cascade not null,
  user_id uuid references profiles(id),
  player_name text not null,
  player_pix text,
  side text,
  amount numeric not null check (amount > 0),
  payout numeric,
  created_at timestamptz default now()
);

-- Dívidas entre usuários (estilo Splitwise)
create table debts (
  id uuid default gen_random_uuid() primary key,
  from_user_id uuid references profiles(id) not null,  -- quem deve
  to_user_id uuid references profiles(id) not null,    -- quem vai receber
  amount numeric not null,
  bet_id uuid references bets(id),
  settled boolean default false,
  created_at timestamptz default now()
);

-- Índices
create index idx_bets_room on bets(room_id);
create index idx_outcomes_bet on outcomes(bet_id);
create index idx_picks_outcome on picks(outcome_id);
create index idx_picks_user on picks(user_id);
create index idx_rooms_slug on rooms(slug);
create index idx_debts_from on debts(from_user_id);
create index idx_debts_to on debts(to_user_id);

-- RLS
alter table profiles enable row level security;
alter table rooms enable row level security;
alter table bets enable row level security;
alter table outcomes enable row level security;
alter table picks enable row level security;
alter table debts enable row level security;

create policy "profiles_all" on profiles for all using (true) with check (true);
create policy "rooms_all" on rooms for all using (true) with check (true);
create policy "bets_all" on bets for all using (true) with check (true);
create policy "outcomes_all" on outcomes for all using (true) with check (true);
create policy "picks_all" on picks for all using (true) with check (true);
create policy "debts_all" on debts for all using (true) with check (true);

-- Storage para fotos de perfil
insert into storage.buckets (id, name, public) values ('avatars', 'avatars', true) on conflict do nothing;
create policy "avatars_public" on storage.objects for select using (bucket_id = 'avatars');
create policy "avatars_upload" on storage.objects for insert with check (bucket_id = 'avatars');
create policy "avatars_update" on storage.objects for update using (bucket_id = 'avatars');

-- Função: criar perfil automaticamente no signup
create or replace function handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into profiles (id, name, avatar_url, phone)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(new.email, '@', 1), 'Usuário'),
    new.raw_user_meta_data->>'avatar_url',
    new.phone
  )
  on conflict (id) do update set
    name = coalesce(excluded.name, profiles.name),
    avatar_url = coalesce(excluded.avatar_url, profiles.avatar_url);
  return new;
end; $$;

create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();

-- Função: resolver outcome binary/timeline
create or replace function resolve_outcome(
  p_outcome_id uuid, p_result text
) returns void language plpgsql security definer as $$
declare
  v_pool_sim numeric; v_pool_nao numeric; v_total numeric;
  v_winner_pool numeric; v_pick record; v_payout numeric; v_bet_id uuid;
  v_loser record;
begin
  select pool_sim, pool_nao, bet_id into v_pool_sim, v_pool_nao, v_bet_id
  from outcomes where id = p_outcome_id;
  v_total := v_pool_sim + v_pool_nao;
  v_winner_pool := case when p_result = 'SIM' then v_pool_sim else v_pool_nao end;

  if v_winner_pool > 0 then
    for v_pick in select * from picks where outcome_id = p_outcome_id and side = p_result loop
      v_payout := round((v_pick.amount / v_winner_pool) * v_total, 2);
      update picks set payout = v_payout where id = v_pick.id;
    end loop;
  end if;

  update picks set payout = 0 where outcome_id = p_outcome_id and side != p_result;
  update outcomes set status='resolved', result=p_result, resolved_at=now() where id=p_outcome_id;

  -- Registrar dívidas entre usuários com conta
  for v_pick in select * from picks where outcome_id = p_outcome_id and side != p_result and user_id is not null loop
    for v_loser in select * from picks where outcome_id = p_outcome_id and side = p_result and user_id is not null loop
      insert into debts (from_user_id, to_user_id, amount, bet_id)
      values (v_pick.user_id, v_loser.user_id,
        round((v_pick.amount / (case when p_result = 'SIM' then v_pool_nao else v_pool_sim end)) * v_loser.payout, 2),
        v_bet_id);
    end loop;
  end loop;

  if not exists (select 1 from outcomes where bet_id=v_bet_id and status='open') then
    update bets set status='resolved' where id=v_bet_id;
  end if;
end; $$;

-- Função: resolver choice
create or replace function resolve_choice(
  p_bet_id uuid, p_winner_outcome_id uuid
) returns void language plpgsql security definer as $$
declare
  v_total numeric; v_winner_pool numeric; v_pick record; v_payout numeric;
begin
  select coalesce(sum(pool_choice),0) into v_total from outcomes where bet_id = p_bet_id;
  select pool_choice into v_winner_pool from outcomes where id = p_winner_outcome_id;
  if v_winner_pool > 0 then
    for v_pick in select * from picks where outcome_id = p_winner_outcome_id loop
      v_payout := round((v_pick.amount / v_winner_pool) * v_total, 2);
      update picks set payout = v_payout where id = v_pick.id;
    end loop;
  end if;
  update picks set payout = 0
  where outcome_id in (select id from outcomes where bet_id=p_bet_id and id != p_winner_outcome_id);
  update outcomes set status='resolved', result='loser', resolved_at=now() where bet_id=p_bet_id;
  update outcomes set result='winner' where id=p_winner_outcome_id;
  update bets set status='resolved' where id=p_bet_id;
end; $$;

-- Realtime
alter publication supabase_realtime add table bets;
alter publication supabase_realtime add table outcomes;
alter publication supabase_realtime add table picks;
alter publication supabase_realtime add table debts;
