'use client'
import { useState, useEffect, useCallback } from 'react'
import { supabase, type Bet, type Outcome, type Pick, calcOdds, calcChoiceOdds } from '@/lib/supabase'

interface Props { bet: Bet; isAdmin: boolean; onUpdate: () => void; adminPix: string | null; currentUserId?: string }

export default function BetCard({ bet, isAdmin, onUpdate, adminPix, currentUserId }: Props) {
  const [outcomes, setOutcomes] = useState<Outcome[]>([])
  const [picks, setPicks] = useState<Pick[]>([])
  const [expanded, setExpanded] = useState(false)
  const [activePick, setActivePick] = useState<{outcomeId: string; side?: 'SIM'|'NAO'}|null>(null)
  const [playerName, setPlayerName] = useState('')
  const [playerPix, setPlayerPix] = useState('')
  const [amount, setAmount] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [resolving, setResolving] = useState<string|null>(null)

  const load = useCallback(async () => {
    const { data: outs } = await supabase.from('outcomes').select().eq('bet_id', bet.id).order('sort_order')
    const outList = outs || []
    setOutcomes(outList)
    if (outList.length > 0) {
      const { data: pks } = await supabase.from('picks').select().in('outcome_id', outList.map((o: Outcome) => o.id))
      setPicks(pks || [])
    }
    // Pre-fill user info if logged in
    if (currentUserId) {
      const { data: profile } = await supabase.from('profiles').select('name, pix_key').eq('id', currentUserId).single()
      if (profile) {
        if (!playerName) setPlayerName(profile.name)
        if (!playerPix) setPlayerPix(profile.pix_key || '')
      }
    }
  }, [bet.id, currentUserId])

  useEffect(() => { load() }, [load])

  async function handlePick(e: React.FormEvent) {
    e.preventDefault()
    if (!activePick || !playerName.trim() || !amount) return
    setLoading(true); setError('')
    try {
      const val = parseFloat(amount)
      if (isNaN(val) || val <= 0) throw new Error('Valor inválido')
      const outcome = outcomes.find(o => o.id === activePick.outcomeId)!
      const { data: { session } } = await supabase.auth.getSession()
      await supabase.from('picks').insert({
        outcome_id: activePick.outcomeId,
        user_id: session?.user?.id || null,
        player_name: playerName.trim(),
        player_pix: playerPix.trim() || null,
        side: activePick.side || null,
        amount: val,
      })
      if (bet.bet_type === 'choice') {
        await supabase.from('outcomes').update({ pool_choice: outcome.pool_choice + val }).eq('id', outcome.id)
      } else {
        const field = activePick.side === 'SIM' ? 'pool_sim' : 'pool_nao'
        await supabase.from('outcomes').update({ [field]: (outcome[field as keyof Outcome] as number) + val }).eq('id', outcome.id)
      }
      setActivePick(null); setAmount(''); setError('')
      await load(); onUpdate()
    } catch (err: any) { setError(err.message || 'Erro ao apostar') }
    finally { setLoading(false) }
  }

  async function handleResolveBT(outcomeId: string, result: 'SIM'|'NAO') {
    setResolving(outcomeId)
    await supabase.rpc('resolve_outcome', { p_outcome_id: outcomeId, p_result: result })
    await load(); onUpdate(); setResolving(null)
  }

  async function handleResolveChoice(winnerId: string) {
    setResolving(winnerId)
    await supabase.rpc('resolve_choice', { p_bet_id: bet.id, p_winner_outcome_id: winnerId })
    await load(); onUpdate(); setResolving(null)
  }

  const totalPool = outcomes.reduce((a, o) => a + o.pool_sim + o.pool_nao + o.pool_choice, 0)
  const allResolved = outcomes.length > 0 && outcomes.every(o => o.status === 'resolved')
  const openCount = outcomes.filter(o => o.status === 'open').length
  const typeLabel: Record<string, string> = { binary: '⚡ Sim/Não', timeline: '⏱️ Quando?', choice: '🏆 Quem ganha?' }

  return (
    <div className={`card overflow-hidden transition-all ${allResolved ? 'opacity-70' : 'glow-green'}`}>
      <div className="p-4 cursor-pointer select-none" onClick={() => setExpanded(!expanded)}>
        <div className="flex items-start justify-between gap-3 mb-2">
          <div className="font-semibold text-white text-base leading-snug flex-1">{bet.title}</div>
          <div className="flex items-center gap-2 shrink-0">
            <span className={`pill ${allResolved ? 'pill-resolved' : 'pill-open'}`}>
              {allResolved ? 'Encerrada' : `${openCount} aberta${openCount !== 1 ? 's' : ''}`}
            </span>
            <span className="text-[#4A6658] text-xs">{expanded ? '▲' : '▼'}</span>
          </div>
        </div>
        <div className="flex items-center gap-3 text-xs text-[#4A6658]">
          <span>{typeLabel[bet.bet_type]}</span>
          <span>·</span>
          <span>R$ {totalPool.toFixed(2)} no bolo</span>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-[#1E2D24]">
          {/* BINARY */}
          {bet.bet_type === 'binary' && outcomes[0] && (() => {
            const o = outcomes[0]
            const odds = calcOdds(o.pool_sim, o.pool_nao)
            const total = o.pool_sim + o.pool_nao
            const outPicks = picks.filter(p => p.outcome_id === o.id)
            const isPickingHere = activePick?.outcomeId === o.id
            return (
              <div className="p-4 space-y-3">
                <OddsBar odds={odds} total={total} />
                {outPicks.length > 0 && <PicksList picks={outPicks} resolved={o.status === 'resolved'} />}
                {o.status === 'resolved' && <PayoutList picks={outPicks} adminPix={adminPix} />}
                {o.status === 'open' && !isPickingHere && (
                  <div className="grid grid-cols-2 gap-2">
                    <button onClick={() => setActivePick({ outcomeId: o.id, side: 'SIM' })} className="btn btn-green py-2.5 text-sm">✓ Apostar SIM</button>
                    <button onClick={() => setActivePick({ outcomeId: o.id, side: 'NAO' })} className="btn btn-red py-2.5 text-sm">✗ Apostar NÃO</button>
                  </div>
                )}
                {o.status === 'open' && isPickingHere && (
                  <PickForm odds={odds} side={activePick?.side} playerName={playerName} setPlayerName={setPlayerName}
                    playerPix={playerPix} setPlayerPix={setPlayerPix} amount={amount} setAmount={setAmount}
                    loading={loading} error={error} onSubmit={handlePick} onCancel={() => { setActivePick(null); setError('') }} />
                )}
                {o.status === 'open' && isAdmin && !isPickingHere && (
                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-[#1E2D24]">
                    <button onClick={() => handleResolveBT(o.id, 'SIM')} disabled={!!resolving} className="btn btn-outline py-2 text-xs">🏁 Resolver: SIM</button>
                    <button onClick={() => handleResolveBT(o.id, 'NAO')} disabled={!!resolving} className="btn btn-outline py-2 text-xs">🏁 Resolver: NÃO</button>
                  </div>
                )}
              </div>
            )
          })()}

          {/* TIMELINE */}
          {bet.bet_type === 'timeline' && outcomes.map(o => {
            const odds = calcOdds(o.pool_sim, o.pool_nao)
            const total = o.pool_sim + o.pool_nao
            const outPicks = picks.filter(p => p.outcome_id === o.id)
            const isPickingHere = activePick?.outcomeId === o.id
            return (
              <div key={o.id} className="p-4 border-b border-[#1E2D24] last:border-0 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="font-semibold text-white text-sm">{o.label}</div>
                  {o.status === 'resolved'
                    ? <span className={`pill ${o.result === 'SIM' ? 'pill-winner' : 'pill-loser'}`}>{o.result === 'SIM' ? '✓ SIM' : '✗ NÃO'}</span>
                    : <span className="text-xs text-[#4A6658]">R$ {total.toFixed(2)}</span>}
                </div>
                <OddsBar odds={odds} total={total} small />
                {outPicks.length > 0 && <PicksList picks={outPicks} resolved={o.status === 'resolved'} />}
                {o.status === 'resolved' && <PayoutList picks={outPicks} adminPix={adminPix} />}
                {o.status === 'open' && !isPickingHere && (
                  <div className="grid grid-cols-2 gap-2">
                    <button onClick={() => setActivePick({ outcomeId: o.id, side: 'SIM' })} className="btn btn-green py-2 text-xs">✓ SIM</button>
                    <button onClick={() => setActivePick({ outcomeId: o.id, side: 'NAO' })} className="btn btn-red py-2 text-xs">✗ NÃO</button>
                  </div>
                )}
                {o.status === 'open' && isPickingHere && (
                  <PickForm odds={odds} side={activePick?.side} playerName={playerName} setPlayerName={setPlayerName}
                    playerPix={playerPix} setPlayerPix={setPlayerPix} amount={amount} setAmount={setAmount}
                    loading={loading} error={error} onSubmit={handlePick} onCancel={() => { setActivePick(null); setError('') }} />
                )}
                {o.status === 'open' && isAdmin && !isPickingHere && (
                  <div className="grid grid-cols-2 gap-2 pt-1 border-t border-[#1E2D24]">
                    <button onClick={() => handleResolveBT(o.id, 'SIM')} disabled={!!resolving} className="btn btn-outline py-1.5 text-xs">🏁 SIM</button>
                    <button onClick={() => handleResolveBT(o.id, 'NAO')} disabled={!!resolving} className="btn btn-outline py-1.5 text-xs">🏁 NÃO</button>
                  </div>
                )}
              </div>
            )
          })}

          {/* CHOICE */}
          {bet.bet_type === 'choice' && (() => {
            const totalPool = outcomes.reduce((a, o) => a + o.pool_choice, 0)
            return (
              <div className="p-4 space-y-2">
                {outcomes.map(o => {
                  const odd = calcChoiceOdds(o.pool_choice, totalPool)
                  const pct = totalPool > 0 ? Math.round((o.pool_choice / totalPool) * 100) : 0
                  const outPicks = picks.filter(p => p.outcome_id === o.id)
                  const isPickingHere = activePick?.outcomeId === o.id
                  const isWinner = o.status === 'resolved' && o.result === 'winner'
                  const isLoser = o.status === 'resolved' && o.result === 'loser'
                  return (
                    <div key={o.id} className={`rounded-xl border p-3 transition-all ${isWinner ? 'border-[#00D4A0] bg-[#00D4A010]' : isLoser ? 'border-[#1E2D24] opacity-50' : 'border-[#1E2D24]'}`}>
                      <div className="flex items-center justify-between mb-2">
                        <div className="font-semibold text-white text-sm">{isWinner && '🏆 '}{o.label}</div>
                        {o.status === 'resolved'
                          ? <span className={`pill ${isWinner ? 'pill-winner' : 'pill-loser'}`}>{isWinner ? 'Ganhou' : 'Perdeu'}</span>
                          : <span className="text-xs text-[#00D4A0] font-bold">{odd}x</span>}
                      </div>
                      <div className="flex h-1.5 rounded-full overflow-hidden bg-[#1E2D24] mb-1">
                        <div className="bg-[#00D4A0] transition-all duration-500" style={{ width: pct + '%' }} />
                      </div>
                      <div className="text-xs text-[#4A6658] mb-2">{pct}% do bolo · R$ {o.pool_choice.toFixed(2)}</div>
                      {outPicks.length > 0 && <PicksList picks={outPicks} resolved={o.status === 'resolved'} choice />}
                      {isWinner && <PayoutList picks={outPicks} adminPix={adminPix} />}
                      {o.status === 'open' && !isPickingHere && (
                        <button onClick={() => setActivePick({ outcomeId: o.id })} className="btn btn-outline w-full py-2 text-xs mt-2">
                          Apostar em {o.label}
                        </button>
                      )}
                      {o.status === 'open' && isPickingHere && (
                        <div className="mt-2">
                          <PickForm choice playerName={playerName} setPlayerName={setPlayerName}
                            playerPix={playerPix} setPlayerPix={setPlayerPix} amount={amount} setAmount={setAmount}
                            loading={loading} error={error} onSubmit={handlePick} onCancel={() => { setActivePick(null); setError('') }} />
                        </div>
                      )}
                      {o.status === 'open' && isAdmin && !isPickingHere && (
                        <button onClick={() => handleResolveChoice(o.id)} disabled={!!resolving}
                          className="btn btn-outline w-full py-1.5 text-xs mt-1 border-[#00D4A0] text-[#00D4A0]">
                          {resolving === o.id ? '...' : `🏁 ${o.label} ganhou`}
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
            )
          })()}
        </div>
      )}
    </div>
  )
}

function OddsBar({ odds, total, small }: any) {
  return (
    <>
      <div className={`flex ${small ? 'h-1.5' : 'h-2'} rounded-full overflow-hidden bg-[#1E2D24]`}>
        <div className="bg-[#00D4A0] transition-all duration-500" style={{ width: odds.pct_sim + '%' }} />
        <div className="bg-[#FF4D6A] flex-1" />
      </div>
      <div className="flex justify-between text-xs font-semibold">
        <span className="text-[#00D4A0]">SIM {odds.pct_sim}% · {odds.sim}x</span>
        {!small && <span className="text-[#4A6658]">R$ {total?.toFixed(2)}</span>}
        <span className="text-[#FF4D6A]">{odds.nao}x · {100 - odds.pct_sim}% NÃO</span>
      </div>
    </>
  )
}

function PicksList({ picks, resolved, choice }: any) {
  return (
    <div className="space-y-1 pt-1 border-t border-[#1E2D24]">
      {picks.map((p: Pick) => (
        <div key={p.id} className="flex items-center justify-between text-xs py-0.5">
          <div className="flex items-center gap-1.5">
            <div className={`w-1.5 h-1.5 rounded-full ${choice ? 'bg-[#00D4A0]' : p.side === 'SIM' ? 'bg-[#00D4A0]' : 'bg-[#FF4D6A]'}`} />
            <span className="text-[#E8F0EC]">{p.player_name}</span>
            {!choice && <span className={`font-semibold ${p.side === 'SIM' ? 'text-[#00D4A0]' : 'text-[#FF4D6A]'}`}>{p.side}</span>}
          </div>
          <div className="text-[#4A6658]">
            R$ {p.amount.toFixed(2)}
            {resolved && p.payout !== null && p.payout > 0 && <span className="text-[#00D4A0] font-semibold ml-1.5">→ R$ {p.payout.toFixed(2)}</span>}
            {resolved && p.payout === 0 && <span className="text-[#FF4D6A] ml-1.5">perdeu</span>}
          </div>
        </div>
      ))}
    </div>
  )
}

function PayoutList({ picks, adminPix }: any) {
  const winners = picks.filter((p: Pick) => p.payout && p.payout > 0)
  if (winners.length === 0) return null
  return (
    <div className="mt-2 p-2.5 rounded-xl bg-[#0D1510] text-xs space-y-1">
      <div className="text-[#4A6658] uppercase tracking-wider text-[10px] mb-1.5">Acerto via PIX</div>
      {winners.map((p: Pick) => (
        <div key={p.id}>
          <span className="text-[#00D4A0] font-semibold">🏆 {p.player_name} recebe R$ {((p.payout || 0) - p.amount).toFixed(2)} de lucro</span>
          {p.player_pix && <div className="text-[#4A6658] mt-0.5">PIX: <span className="text-white">{p.player_pix}</span></div>}
        </div>
      ))}
      {adminPix && (
        <div className="pt-1.5 mt-1 border-t border-[#1E2D24] text-[#4A6658]">
          PIX do admin: <span className="text-white">{adminPix}</span>
        </div>
      )}
    </div>
  )
}

function PickForm({ odds, side, choice, playerName, setPlayerName, playerPix, setPlayerPix, amount, setAmount, loading, error, onSubmit, onCancel }: any) {
  const potentialWin = odds && side && amount ? parseFloat(amount) * (side === 'SIM' ? odds.sim : odds.nao) : null
  return (
    <form onSubmit={onSubmit} className="space-y-2 pt-2 border-t border-[#1E2D24]">
      {!choice && (
        <div className="grid grid-cols-2 gap-2 text-xs font-semibold text-center">
          <div className={`py-1.5 rounded-lg ${side === 'SIM' ? 'bg-[#00D4A0] text-[#0A0F0D]' : 'bg-[#1E2D24] text-[#4A6658]'}`}>✓ SIM {odds?.sim}x</div>
          <div className={`py-1.5 rounded-lg ${side === 'NAO' ? 'bg-[#FF4D6A] text-white' : 'bg-[#1E2D24] text-[#4A6658]'}`}>✗ NÃO {odds?.nao}x</div>
        </div>
      )}
      <input className="input text-sm" placeholder="Seu nome" value={playerName} onChange={e => setPlayerName(e.target.value)} required />
      <input className="input text-sm" placeholder="Sua chave PIX (para receber)" value={playerPix} onChange={e => setPlayerPix(e.target.value)} />
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#4A6658] text-sm">R$</span>
        <input className="input text-sm pl-8" type="number" placeholder="Valor" min="0.01" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} required />
      </div>
      {potentialWin && (
        <div className="text-xs text-center text-[#4A6658] bg-[#0D1510] rounded-lg p-2">
          Se ganhar: <span className="text-[#00D4A0] font-semibold">R$ {potentialWin.toFixed(2)}</span>
        </div>
      )}
      {error && <p className="text-[#FF4D6A] text-xs">{error}</p>}
      <div className="grid grid-cols-2 gap-2">
        <button type="button" onClick={onCancel} className="btn btn-outline py-2.5 text-sm">Cancelar</button>
        <button type="submit" disabled={loading} className="btn btn-green py-2.5 text-sm disabled:opacity-50">
          {loading ? 'Confirmando...' : 'Confirmar'}
        </button>
      </div>
    </form>
  )
}
