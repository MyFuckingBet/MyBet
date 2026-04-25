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

// Backwards-compat alias used throughout the app
export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    return (getSupabase() as any)[prop]
  }
})

export const HOUSE_EDGE = 0.10

export type Room = {
  id: string
  slug: string
  name: string
  admin_name: string
  admin_pix: string | null
  created_at: string
}

export type Bet = {
  id: string
  room_id: string
  title: string
  status: 'open' | 'resolved'
  result: 'SIM' | 'NAO' | null
  pool_sim: number
  pool_nao: number
  created_at: string
  resolved_at: string | null
}

export type Pick = {
  id: string
  bet_id: string
  player_name: string
  player_pix: string | null
  side: 'SIM' | 'NAO'
  amount: number
  payout: number | null
  created_at: string
}

export function calcOdds(pool_sim: number, pool_nao: number) {
  const total = pool_sim + pool_nao
  if (total === 0) return { sim: 2.0, nao: 2.0, pct_sim: 50 }
  const net = total * (1 - HOUSE_EDGE)
  const sim = pool_sim > 0 ? net / pool_sim : 999
  const nao = pool_nao > 0 ? net / pool_nao : 999
  const pct_sim = Math.round((pool_sim / total) * 100)
  return {
    sim: Math.round(sim * 100) / 100,
    nao: Math.round(nao * 100) / 100,
    pct_sim,
  }
}

export function generateSlug() {
  const words = ['bola','gato','pato','show','jogo','dado','fogo','voto','card','mega']
  const nums = Math.floor(Math.random() * 9000) + 1000
  return words[Math.floor(Math.random() * words.length)] + nums
}
