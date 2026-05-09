'use client'
export const dynamic = 'force-dynamic'
import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase, type Room, type Bet } from '@/lib/supabase'
import NewBetModal from '@/components/NewBetModal'
import BetCard from '@/components/BetCard'

export default function RoomPage() {
  const params = useParams()
  const router = useRouter()
  const slug = params.slug as string
  const [room, setRoom] = useState<Room | null>(null)
  const [bets, setBets] = useState<Bet[]>([])
  const [loading, setLoading] = useState(true)
  const [showNewBet, setShowNewBet] = useState(false)
  const [copied, setCopied] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const [user, setUser] = useState<any>(null)
  const [adminPix, setAdminPix] = useState<string|null>(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }: any) => {
      setUser(session?.user ?? null)
    })
  }, [])

  const loadRoom = useCallback(async () => {
    const { data: roomData } = await supabase.from('rooms').select().eq('slug', slug).single()
    if (!roomData) return
    setRoom(roomData)

    // Checar admin
    const { data: { session } } = await supabase.auth.getSession()
    const currentUser = session?.user
    const isAdminUser = currentUser && roomData.admin_id === currentUser.id
    const isAdminLocal = localStorage.getItem(`admin_${slug}`) === '1'
    setIsAdmin(isAdminUser || isAdminLocal)

    // Buscar PIX do admin
    if (roomData.admin_id) {
      const { data: adminProfile } = await supabase.from('profiles').select('pix_key').eq('id', roomData.admin_id).single()
      setAdminPix(adminProfile?.pix_key || null)
    }

    const { data: betsData } = await supabase.from('bets').select().eq('room_id', roomData.id).order('created_at', { ascending: false })
    setBets(betsData || [])
    setLoading(false)
  }, [slug])

  useEffect(() => {
    loadRoom()
    const channel = supabase.channel('room-' + slug)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bets' }, loadRoom)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'outcomes' }, loadRoom)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'picks' }, loadRoom)
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [slug, loadRoom])

  function copyLink() {
    navigator.clipboard.writeText(`${window.location.origin}/room/${slug}`)
    setCopied(true); setTimeout(() => setCopied(false), 2000)
  }

  if (loading) return (
    <main className="min-h-screen flex items-center justify-center">
      <div className="font-display text-3xl text-[#00D4A0] animate-pulse">MyBet</div>
    </main>
  )

  if (!room) return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-4">
      <p className="text-white text-lg">Sala não encontrada</p>
      <button onClick={() => router.push('/')} className="btn btn-outline px-6 py-3 text-sm">Voltar</button>
    </main>
  )

  const openBets = bets.filter(b => b.status === 'open')
  const resolvedBets = bets.filter(b => b.status === 'resolved')

  return (
    <main className="min-h-screen px-4 py-8 max-w-lg mx-auto">
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="font-display text-3xl font-extrabold text-[#00D4A0] tracking-tight">{room.name}</div>
          <div className="text-[#4A6658] text-sm mt-1 flex items-center gap-2">
            {isAdmin && <span className="pill pill-open">Admin</span>}
            {user && (
              <button onClick={() => router.push('/profile')} className="text-[#4A6658] hover:text-[#00D4A0] text-xs underline">Meu perfil</button>
            )}
          </div>
        </div>
        <button onClick={copyLink} className="btn btn-outline px-3 py-2 text-xs">
          {copied ? '✓ Copiado' : '🔗 Compartilhar'}
        </button>
      </div>

      <div className="card p-4 mb-5 flex items-center justify-between">
        <div>
          <div className="text-xs text-[#4A6658] uppercase tracking-wider mb-1">Código da sala</div>
          <div className="font-display text-2xl font-bold text-white tracking-widest uppercase">{room.slug}</div>
        </div>
        <div className="text-right">
          <div className="text-xs text-[#4A6658] uppercase tracking-wider mb-1">Abertas</div>
          <div className="font-display text-2xl font-bold text-[#00D4A0]">{openBets.length}</div>
        </div>
      </div>

      {isAdmin && (
        <button onClick={() => setShowNewBet(true)} className="btn btn-green w-full py-3.5 text-base mb-5 animate-pulse-glow">
          + Nova aposta
        </button>
      )}

      {openBets.length > 0 && (
        <div className="mb-5">
          <div className="text-xs text-[#4A6658] uppercase tracking-wider mb-3">Abertas</div>
          <div className="space-y-3">
            {openBets.map(bet => (
              <BetCard key={bet.id} bet={bet} isAdmin={isAdmin} onUpdate={loadRoom} adminPix={adminPix} currentUserId={user?.id} />
            ))}
          </div>
        </div>
      )}

      {bets.length === 0 && (
        <div className="card p-12 text-center">
          <div className="text-5xl mb-4">🎲</div>
          <div className="text-white font-semibold mb-2">Nenhuma aposta ainda</div>
          <div className="text-[#4A6658] text-sm">
            {isAdmin ? 'Clique em "+ Nova aposta" para começar' : 'Aguardando o admin criar uma aposta'}
          </div>
        </div>
      )}

      {resolvedBets.length > 0 && (
        <div>
          <div className="text-xs text-[#4A6658] uppercase tracking-wider mb-3">Encerradas</div>
          <div className="space-y-3">
            {resolvedBets.map(bet => (
              <BetCard key={bet.id} bet={bet} isAdmin={isAdmin} onUpdate={loadRoom} adminPix={adminPix} currentUserId={user?.id} />
            ))}
          </div>
        </div>
      )}

      {showNewBet && (
        <NewBetModal roomId={room.id} onClose={() => setShowNewBet(false)} onCreated={loadRoom} />
      )}
    </main>
  )
}
