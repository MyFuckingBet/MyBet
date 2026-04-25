-- ============================================================
-- MyBet - Schema Supabase
-- Cole este SQL no SQL Editor do seu projeto Supabase
-- ============================================================

-- Tabela de salas
create table if not exists rooms (
  id uuid default gen_random_uuid() primary key,
  slug text unique not null,
  name text not null,
  admin_name text not null,
  admin_pix text,
  created_at timestamptz default now()
);

-- Tabela de apostas
create table if not exists bets (
  id uuid default gen_random_uuid() primary key,
  room_id uuid references rooms(id) on delete cascade not null,
  title text not null,
  status text default 'open' check (status in ('open', 'resolved')),
  result text check (result in ('SIM', 'NAO', null)),
  pool_sim numeric default 0,
  pool_nao numeric default 0,
  created_at timestamptz default now(),
  resolved_at timestamptz
);

-- Tabela de palpites
create table if not exists picks (
  id uuid default gen_random_uuid() primary key,
  bet_id uuid references bets(id) on delete cascade not null,
  player_name text not null,
  player_pix text,
  side text not null check (side in ('SIM', 'NAO')),
  amount numeric not null check (amount > 0),
  payout numeric,
  created_at timestamptz default now()
);

-- Índices para performance
create index if not exists idx_bets_room on bets(room_id);
create index if not exists idx_picks_bet on picks(bet_id);
create index if not exists idx_rooms_slug on rooms(slug);

-- RLS: habilitar
alter table rooms enable row level security;
alter table bets enable row level security;
alter table picks enable row level security;

-- Políticas: acesso público de leitura (app privado entre amigos)
create policy "rooms_read" on rooms for select using (true);
create policy "rooms_insert" on rooms for insert with check (true);
create policy "bets_read" on bets for select using (true);
create policy "bets_insert" on bets for insert with check (true);
create policy "bets_update" on bets for update using (true);
create policy "picks_read" on picks for select using (true);
create policy "picks_insert" on picks for insert with check (true);
create policy "picks_update" on picks for update using (true);

-- Função para resolver aposta e calcular payouts
create or replace function resolve_bet(
  p_bet_id uuid,
  p_result text
) returns void
language plpgsql
security definer
as $$
declare
  v_pool_sim numeric;
  v_pool_nao numeric;
  v_total numeric;
  v_winner_pool numeric;
  v_pick record;
  v_payout numeric;
begin
  -- Buscar os pools
  select pool_sim, pool_nao into v_pool_sim, v_pool_nao
  from bets where id = p_bet_id;

  v_total := v_pool_sim + v_pool_nao;
  v_winner_pool := case when p_result = 'SIM' then v_pool_sim else v_pool_nao end;

  -- Calcular payout de cada vencedor
  for v_pick in
    select * from picks where bet_id = p_bet_id and side = p_result
  loop
    v_payout := round((v_pick.amount / v_winner_pool) * v_total, 2);
    update picks set payout = v_payout where id = v_pick.id;
  end loop;

  -- Zerar payout dos perdedores
  update picks set payout = 0
  where bet_id = p_bet_id and side != p_result;

  -- Atualizar status da aposta
  update bets
  set status = 'resolved', result = p_result, resolved_at = now()
  where id = p_bet_id;
end;
$$;

-- Realtime: habilitar para as tabelas
alter publication supabase_realtime add table bets;
alter publication supabase_realtime add table picks;
