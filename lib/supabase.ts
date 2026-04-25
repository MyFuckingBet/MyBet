import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

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
  const sim = pool_nao > 0 ? total / pool_sim : 999
  const nao = pool_sim > 0 ? total / pool_nao : 999
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
