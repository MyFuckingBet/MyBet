-- MyBet v3 - Schema completo com 3 tipos de aposta
-- Cole no SQL Editor do Supabase e clique Run

drop function if exists resolve_outcome cascade;
drop function if exists resolve_bet cascade;
drop table if exists picks cascade;
drop table if exists outcomes cascade;
drop table if exists bets cascade;
drop table if exists rooms cascade;

create table rooms (
  id uuid default gen_random_uuid() primary key,
  slug text unique not null,
  name text not null,
  admin_name text not null,
  admin_pix text,
  created_at timestamptz default now()
);

-- bet_type: 'binary' | 'timeline' | 'choice'
create table bets (
  id uuid default gen_random_uuid() primary key,
  room_id uuid references rooms(id) on delete cascade not null,
  title text not null,
  bet_type text not null default 'binary' check (bet_type in ('binary','timeline','choice')),
  status text default 'open' check (status in ('open','resolved')),
  created_at timestamptz default now()
);

-- Para binary: 1 outcome (o próprio sim/não)
-- Para timeline: N outcomes (prazos), cada um com sim/não
-- Para choice: N outcomes (pessoas/opções), quem apostar nessa opção quer que ela ganhe
create table outcomes (
  id uuid default gen_random_uuid() primary key,
  bet_id uuid references bets(id) on delete cascade not null,
  label text not null,
  pool_sim numeric default 0,   -- usado em binary e timeline
  pool_nao numeric default 0,   -- usado em binary e timeline
  pool_choice numeric default 0, -- usado em choice (apostas nessa opção)
  status text default 'open' check (status in ('open','resolved')),
  result text,                   -- 'SIM','NAO' para binary/timeline | outcome_id vencedor para choice
  resolved_at timestamptz,
  sort_order int default 0
);

create table picks (
  id uuid default gen_random_uuid() primary key,
  outcome_id uuid references outcomes(id) on delete cascade not null,
  player_name text not null,
  player_pix text,
  side text,                     -- 'SIM'|'NAO' para binary/timeline | null para choice (aposta na própria outcome)
  amount numeric not null check (amount > 0),
  payout numeric,
  created_at timestamptz default now()
);

create index idx_bets_room on bets(room_id);
create index idx_outcomes_bet on outcomes(bet_id);
create index idx_picks_outcome on picks(outcome_id);
create index idx_rooms_slug on rooms(slug);

alter table rooms enable row level security;
alter table bets enable row level security;
alter table outcomes enable row level security;
alter table picks enable row level security;

create policy "rooms_all" on rooms for all using (true) with check (true);
create policy "bets_all" on bets for all using (true) with check (true);
create policy "outcomes_all" on outcomes for all using (true) with check (true);
create policy "picks_all" on picks for all using (true) with check (true);

-- Resolve binary/timeline outcome (SIM ou NAO ganhou)
create or replace function resolve_outcome(
  p_outcome_id uuid,
  p_result text
) returns void language plpgsql security definer as $$
declare
  v_pool_sim numeric; v_pool_nao numeric; v_total numeric;
  v_winner_pool numeric; v_pick record; v_payout numeric; v_bet_id uuid;
begin
  select pool_sim, pool_nao, bet_id into v_pool_sim, v_pool_nao, v_bet_id
  from outcomes where id = p_outcome_id;
  v_total := v_pool_sim + v_pool_nao;
  v_winner_pool := case when p_result = 'SIM' then v_pool_sim else v_pool_nao end;
  if v_winner_pool > 0 then
    for v_pick in select * from picks where outcome_id = p_outcome_id and side = p_result loop
      v_payout := round((v_pick.amount / v_winner_pool) * v_total * 0.90, 2);
      update picks set payout = v_payout where id = v_pick.id;
    end loop;
  end if;
  update picks set payout = 0 where outcome_id = p_outcome_id and side != p_result;
  update outcomes set status='resolved', result=p_result, resolved_at=now() where id=p_outcome_id;
  if not exists (select 1 from outcomes where bet_id=v_bet_id and status='open') then
    update bets set status='resolved' where id=v_bet_id;
  end if;
end; $$;

-- Resolve choice (qual opção ganhou — passa o outcome_id vencedor)
create or replace function resolve_choice(
  p_bet_id uuid,
  p_winner_outcome_id uuid
) returns void language plpgsql security definer as $$
declare
  v_total numeric; v_winner_pool numeric; v_pick record; v_payout numeric;
begin
  select coalesce(sum(pool_choice),0) into v_total from outcomes where bet_id = p_bet_id;
  select pool_choice into v_winner_pool from outcomes where id = p_winner_outcome_id;
  if v_winner_pool > 0 then
    for v_pick in select * from picks where outcome_id = p_winner_outcome_id loop
      v_payout := round((v_pick.amount / v_winner_pool) * v_total * 0.90, 2);
      update picks set payout = v_payout where id = v_pick.id;
    end loop;
  end if;
  -- Zera payout dos perdedores
  update picks set payout = 0
  where outcome_id in (select id from outcomes where bet_id=p_bet_id and id != p_winner_outcome_id);
  update outcomes set status='resolved', result='winner', resolved_at=now() where bet_id=p_bet_id;
  update outcomes set result='loser' where bet_id=p_bet_id and id != p_winner_outcome_id;
  update outcomes set result='winner' where id=p_winner_outcome_id;
  update bets set status='resolved' where id=p_bet_id;
end; $$;

alter publication supabase_realtime add table bets;
alter publication supabase_realtime add table outcomes;
alter publication supabase_realtime add table picks;
