import { createClient, SupabaseClient } from '@supabase/supabase-js'

let _supabase: SupabaseClient | null = null

export function getSupabase() {
  if (!_supabase) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ''
    _supabase = createClient(url, key)
  }
  return _supabase
}

export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, prop) { return (getSupabase() as any)[prop] }
})

export type BetType = 'binary' | 'timeline' | 'choice'

export type Profile = {
  id: string; name: string; avatar_url: string | null
  pix_key: string | null; phone: string | null; created_at: string
}

export type Room = {
  id: string; slug: string; name: string
  admin_id: string | null; admin_pix: string | null; created_at: string
}

export type Bet = {
  id: string; room_id: string; title: string
  bet_type: BetType; status: 'open' | 'resolved'
  created_by: string | null; created_at: string
}

export type Outcome = {
  id: string; bet_id: string; label: string
  pool_sim: number; pool_nao: number; pool_choice: number
  status: 'open' | 'resolved'
  result: string | null; resolved_at: string | null; sort_order: number
}

export type Pick = {
  id: string; outcome_id: string
  user_id: string | null; player_name: string
  player_pix: string | null; side: string | null
  amount: number; payout: number | null; created_at: string
}

export type Debt = {
  id: string; from_user_id: string; to_user_id: string
  amount: number; bet_id: string | null
  settled: boolean; created_at: string
  from_profile?: Profile; to_profile?: Profile
}

export function calcOdds(pool_sim: number, pool_nao: number) {
  const total = pool_sim + pool_nao
  if (total === 0) return { sim: 2.0, nao: 2.0, pct_sim: 50 }
  const sim = pool_sim > 0 ? total / pool_sim : 99
  const nao = pool_nao > 0 ? total / pool_nao : 99
  const pct_sim = Math.round((pool_sim / total) * 100)
  return { sim: +sim.toFixed(2), nao: +nao.toFixed(2), pct_sim }
}

export function calcChoiceOdds(myPool: number, totalPool: number) {
  if (myPool === 0 || totalPool === 0) return 99
  return +(totalPool / myPool).toFixed(2)
}

export function generateSlug() {
  const words = ['bola','gato','pato','show','jogo','dado','fogo','voto','card','mega']
  return words[Math.floor(Math.random() * words.length)] + (Math.floor(Math.random() * 9000) + 1000)
}
