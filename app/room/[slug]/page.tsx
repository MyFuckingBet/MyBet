'use client'
import { useEffect, useState, useCallback } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { supabase, type Room, type Bet, calcOdds } from '@/lib/supabase'
import NewBetModal from '@/components/NewBetModal'
import BetCard from '@/components/BetCard'

export default function RoomPage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const slug = params.slug as string
  const queryAdmin = searchParams.get('admin') === '1'

  const [room, setRoom] = useState<Room | null>(null)
  const [bets, setBets] = useState<Bet[]>([])
  const [loading, setLoading] = useState(true)
  const [showNewBet, setShowNewBet] = useState(false)
  const [copied, setCopied] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)

  useEffect(() => {
    // Check admin from localStorage
    const stored = typeof window !== 'undefined' ? localStorage.getItem(`admin_${slug}`) : null
    setIsAdmin(queryAdmin || stored === '1')
  }, [slug, queryAdmin])

  const loadRoom = useCallback(async () => {
    const { data: roomData } = await supabase.from('rooms').select().eq('slug', slug).single()
    if (!roomData) return
    setRoom(roomData)
    const { data: betsData } = await supabase.from('bets').select().eq('room_id', roomData.id).order('created_at', { ascending: false })
    setBets(betsData || [])
    setLoading(false)
  }, [slug])

  useEffect(() => {
    loadRoom()
    // Realtime subscription
    const channel = supabase
      .channel('room-' + slug)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bets' }, () => loadRoom())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'picks' }, () => loadRoom())
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [slug, loadRoom])

  function copyLink() {
    navigator.clipboard.writeText(window.location.origin + '/room/' + slug)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (loading) return (
    <main className="min-h-screen flex items-center justify-center">
      <div className="text-brand-green font-display text-2xl animate-pulse">MyBet</div>
    </main>
  )

  if (!room) return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-4">
      <p className="text-white text-lg">Sala não encontrada</p>
      <Link href="/" className="btn btn-outline px-6 py-3 text-sm">Voltar ao início</Link>
    </main>
  )

  const openBets = bets.filter(b => b.status === 'open')
  const resolvedBets = bets.filter(b => b.status === 'resolved')

  return (
    <main className="min-h-screen px-4 py-8 max-w-lg mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <div className="font-display text-3xl font-extrabold text-brand-green tracking-tight">{room.name}</div>
          <div className="text-brand-muted text-sm mt-1">Admin: {room.admin_name} {isAdmin && <span className="pill pill-open ml-1">você</span>}</div>
        </div>
        <button onClick={copyLink} className="btn btn-outline px-3 py-2 text-xs flex items-center gap-1.5">
          {copied ? '✓ Copiado' : '🔗 Compartilhar'}
        </button>
      </div>

      {/* Code badge */}
      <div className="card p-4 mb-6 flex items-center justify-between">
        <div>
          <div className="text-xs text-brand-muted uppercase tracking-wider mb-1">Código da sala</div>
          <div className="font-display text-2xl font-bold text-white tracking-widest uppercase">{room.slug}</div>
        </div>
        <div className="text-right">
          <div className="text-xs text-brand-muted uppercase tracking-wider mb-1">Apostas abertas</div>
          <div className="font-display text-2xl font-bold text-brand-green">{openBets.length}</div>
        </div>
      </div>

      {/* New bet button (admin only) */}
      {isAdmin && (
        <button onClick={() => setShowNewBet(true)} className="btn btn-green w-full py-3.5 text-base mb-6 flex items-center justify-center gap-2">
          <span className="text-xl">+</span> Nova aposta
        </button>
      )}

      {/* Open bets */}
      {openBets.length > 0 && (
        <div className="mb-6">
          <div className="text-xs text-brand-muted uppercase tracking-wider mb-3">Abertas</div>
          <div className="space-y-3">
            {openBets.map(bet => <BetCard key={bet.id} bet={bet} roomSlug={slug} isAdmin={isAdmin} onUpdate={loadRoom} adminPix={room.admin_pix} />)}
          </div>
        </div>
      )}

      {/* Empty state */}
      {bets.length === 0 && (
        <div className="card p-10 text-center">
          <div className="text-4xl mb-3">🎲</div>
          <div className="text-white font-semibold mb-1">Nenhuma aposta ainda</div>
          <div className="text-brand-muted text-sm">{isAdmin ? 'Clique em "Nova aposta" para começar' : 'Aguardando o admin criar uma aposta'}</div>
        </div>
      )}

      {/* Resolved bets */}
      {resolvedBets.length > 0 && (
        <div>
          <div className="text-xs text-brand-muted uppercase tracking-wider mb-3">Encerradas</div>
          <div className="space-y-3">
            {resolvedBets.map(bet => <BetCard key={bet.id} bet={bet} roomSlug={slug} isAdmin={isAdmin} onUpdate={loadRoom} adminPix={room.admin_pix} />)}
          </div>
        </div>
      )}

      {/* New bet modal */}
      {showNewBet && room && (
        <NewBetModal roomId={room.id} onClose={() => setShowNewBet(false)} onCreated={loadRoom} />
      )}
    </main>
  )
}
