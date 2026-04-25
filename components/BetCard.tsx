'use client'
import { useState, useEffect } from 'react'
import { supabase, type Bet, type Pick, calcOdds } from '@/lib/supabase'

interface Props {
  bet: Bet
  roomSlug: string
  isAdmin: boolean
  onUpdate: () => void
  adminPix: string | null
}

export default function BetCard({ bet, isAdmin, onUpdate, adminPix }: Props) {
  const [picks, setPicks] = useState<Pick[]>([])
  const [expanded, setExpanded] = useState(false)
  const [showBetForm, setShowBetForm] = useState(false)
  const [showResolve, setShowResolve] = useState(false)
  const [playerName, setPlayerName] = useState('')
  const [playerPix, setPlayerPix] = useState('')
  const [amount, setAmount] = useState('')
  const [side, setSide] = useState<'SIM' | 'NAO' | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    supabase.from('picks').select().eq('bet_id', bet.id).order('created_at').then(({ data }) => setPicks(data || []))
  }, [bet.id, bet.pool_sim, bet.pool_nao])

  const odds = calcOdds(bet.pool_sim, bet.pool_nao)
  const total = bet.pool_sim + bet.pool_nao

  async function handlePick(e: React.FormEvent) {
    e.preventDefault()
    if (!side || !playerName.trim() || !amount) return
    setLoading(true); setError('')
    try {
      const val = parseFloat(amount)
      if (isNaN(val) || val <= 0) throw new Error('Valor inválido')
      // Insert pick
      const { error: pickErr } = await supabase.from('picks').insert({
        bet_id: bet.id, player_name: playerName.trim(), player_pix: playerPix.trim() || null,
        side, amount: val,
      })
      if (pickErr) throw pickErr
      // Update pool
      const field = side === 'SIM' ? 'pool_sim' : 'pool_nao'
      await supabase.from('bets').update({ [field]: (bet[field] + val) }).eq('id', bet.id)
      setShowBetForm(false); setSide(null); setPlayerName(''); setPlayerPix(''); setAmount('')
      onUpdate()
    } catch (err: any) {
      setError(err.message || 'Erro ao apostar')
    } finally { setLoading(false) }
  }

  async function handleResolve(result: 'SIM' | 'NAO') {
    setLoading(true)
    await supabase.rpc('resolve_bet', { p_bet_id: bet.id, p_result: result })
    setShowResolve(false)
    onUpdate()
    setLoading(false)
  }

  // Payment calculation for resolved bets
  const winPicks = picks.filter(p => p.side === bet.result)
  const losePicks = picks.filter(p => p.side !== bet.result)

  return (
    <div className={`card overflow-hidden transition-all ${bet.status === 'resolved' ? 'opacity-80' : 'glow-green'}`}>
      {/* Header */}
      <div className="p-4 cursor-pointer" onClick={() => setExpanded(!expanded)}>
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="font-semibold text-white text-base leading-snug flex-1">{bet.title}</div>
          <div className="flex items-center gap-2 shrink-0">
            <span className={`pill ${bet.status === 'open' ? 'pill-open' : 'pill-resolved'}`}>
              {bet.status === 'open' ? 'Aberta' : bet.result === 'SIM' ? '✓ Sim' : '✗ Não'}
            </span>
            <span className="text-brand-muted text-xs">{expanded ? '▲' : '▼'}</span>
          </div>
        </div>

        {/* Odds bar */}
        <div className="mb-2">
          <div className="flex h-2 rounded-full overflow-hidden bg-brand-border mb-2">
            <div className="bg-brand-green transition-all duration-500" style={{ width: odds.pct_sim + '%' }} />
            <div className="bg-brand-red transition-all duration-500 flex-1" />
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-brand-green font-semibold">SIM {odds.pct_sim}% · {odds.sim}x</span>
            <span className="text-brand-muted text-xs">R$ {total.toFixed(2)} no bolo</span>
            <span className="text-brand-red font-semibold">{odds.nao}x · {100 - odds.pct_sim}% NÃO</span>
          </div>
        </div>
      </div>

      {/* Expanded content */}
      {expanded && (
        <div className="border-t border-brand-border">
          {/* Picks list */}
          {picks.length > 0 && (
            <div className="p-4 space-y-2">
              {picks.map(p => (
                <div key={p.id} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${p.side === 'SIM' ? 'bg-brand-green' : 'bg-brand-red'}`} />
                    <span className="text-white">{p.player_name}</span>
                    <span className={`text-xs font-semibold ${p.side === 'SIM' ? 'text-brand-green' : 'text-brand-red'}`}>{p.side}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-brand-muted">R$ {p.amount.toFixed(2)}</span>
                    {p.payout !== null && p.payout > 0 && (
                      <span className="text-brand-green ml-2 font-semibold">→ R$ {p.payout.toFixed(2)}</span>
                    )}
                    {p.payout === 0 && <span className="text-brand-red ml-2">perdeu</span>}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Payment instructions (resolved) */}
          {bet.status === 'resolved' && picks.length > 0 && (
            <div className="mx-4 mb-4 p-3 rounded-xl bg-brand-dark border border-brand-border">
              <div className="text-xs text-brand-muted uppercase tracking-wider mb-2">Acerto via PIX</div>
              {winPicks.map(winner => {
                const profit = (winner.payout || 0) - winner.amount
                const debtors = losePicks.map(loser => ({
                  ...loser,
                  owes: Math.round((loser.amount / (total - (bet.result === 'SIM' ? bet.pool_sim : bet.pool_nao))) * profit * 100) / 100
                }))
                return (
                  <div key={winner.id} className="mb-2 last:mb-0">
                    <div className="text-brand-green text-sm font-semibold">🏆 {winner.player_name} recebe R$ {profit.toFixed(2)}</div>
                    {winner.player_pix && <div className="text-xs text-brand-muted mt-0.5">PIX: {winner.player_pix}</div>}
                  </div>
                )
              })}
              {adminPix && (
                <div className="mt-2 pt-2 border-t border-brand-border text-xs text-brand-muted">
                  PIX do admin: <span className="text-white">{adminPix}</span>
                </div>
              )}
            </div>
          )}

          {/* Bet form */}
          {bet.status === 'open' && !showBetForm && (
            <div className="p-4 pt-0">
              <button onClick={() => setShowBetForm(true)} className="btn btn-green w-full py-3 text-sm">
                Fazer aposta
              </button>
              {isAdmin && (
                <button onClick={() => setShowResolve(true)} className="btn btn-outline w-full py-2.5 text-sm mt-2">
                  Resolver aposta (admin)
                </button>
              )}
            </div>
          )}

          {/* Bet form fields */}
          {bet.status === 'open' && showBetForm && (
            <form onSubmit={handlePick} className="p-4 pt-0 space-y-3">
              {/* Side selector */}
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={() => setSide('SIM')}
                  className={`py-3 rounded-xl font-semibold text-sm border transition-all ${side === 'SIM' ? 'bg-brand-green text-brand-dark border-brand-green' : 'bg-transparent border-brand-border text-brand-muted hover:border-brand-green hover:text-brand-green'}`}>
                  ✓ SIM · {odds.sim}x
                </button>
                <button type="button" onClick={() => setSide('NAO')}
                  className={`py-3 rounded-xl font-semibold text-sm border transition-all ${side === 'NAO' ? 'bg-brand-red text-white border-brand-red' : 'bg-transparent border-brand-border text-brand-muted hover:border-brand-red hover:text-brand-red'}`}>
                  ✗ NÃO · {odds.nao}x
                </button>
              </div>
              <input className="input" placeholder="Seu nome" value={playerName} onChange={e => setPlayerName(e.target.value)} required />
              <input className="input" placeholder="Sua chave PIX (para receber)" value={playerPix} onChange={e => setPlayerPix(e.target.value)} />
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-brand-muted text-sm">R$</span>
                <input className="input pl-9" type="number" placeholder="Valor" min="0.01" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} required />
              </div>
              {side && amount && (
                <div className="text-xs text-brand-muted bg-brand-dark rounded-lg p-2.5 text-center">
                  Se ganhar: <span className="text-brand-green font-semibold">R$ {(parseFloat(amount) * (side === 'SIM' ? odds.sim : odds.nao)).toFixed(2)}</span>
                  <span className="text-brand-muted ml-1">(odds ao vivo — podem mudar)</span>
                </div>
              )}
              {error && <p className="text-brand-red text-sm">{error}</p>}
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={() => setShowBetForm(false)} className="btn btn-outline py-3 text-sm">Cancelar</button>
                <button type="submit" disabled={loading || !side} className="btn btn-green py-3 text-sm disabled:opacity-50">
                  {loading ? 'Apostando...' : 'Confirmar'}
                </button>
              </div>
            </form>
          )}

          {/* Resolve modal */}
          {showResolve && (
            <div className="p-4 pt-0">
              <div className="card p-4 border-brand-yellow bg-brand-dark">
                <div className="text-sm text-white font-semibold mb-3 text-center">Como terminou?</div>
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={() => handleResolve('SIM')} disabled={loading}
                    className="btn btn-green py-3 text-sm disabled:opacity-50">✓ Aconteceu (SIM)</button>
                  <button onClick={() => handleResolve('NAO')} disabled={loading}
                    className="btn btn-red py-3 text-sm disabled:opacity-50">✗ Não aconteceu (NÃO)</button>
                </div>
                <button onClick={() => setShowResolve(false)} className="btn btn-outline w-full py-2 text-xs mt-2">Cancelar</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
