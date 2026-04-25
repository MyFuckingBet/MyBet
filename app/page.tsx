'use client'
export const dynamic = 'force-dynamic'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase, generateSlug } from '@/lib/supabase'

export default function Home() {
  const router = useRouter()
  const [tab, setTab] = useState<'create' | 'join'>('create')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Create form
  const [roomName, setRoomName] = useState('')
  const [adminName, setAdminName] = useState('')
  const [adminPix, setAdminPix] = useState('')

  // Join form
  const [joinSlug, setJoinSlug] = useState('')

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!roomName.trim() || !adminName.trim()) return
    setLoading(true)
    setError('')
    try {
      const slug = generateSlug()
      const { data, error: err } = await supabase
        .from('rooms')
        .insert({ slug, name: roomName.trim(), admin_name: adminName.trim(), admin_pix: adminPix.trim() || null })
        .select()
        .single()
      if (err) throw err
      // Store admin token in localStorage
      localStorage.setItem(`admin_${data.slug}`, '1')
      router.push(`/room/${data.slug}?admin=1`)
    } catch {
      setError('Erro ao criar sala. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault()
    const slug = joinSlug.trim().toLowerCase()
    if (!slug) return
    setLoading(true)
    setError('')
    try {
      const { data, error: err } = await supabase
        .from('rooms')
        .select()
        .eq('slug', slug)
        .single()
      if (err || !data) throw new Error('Sala não encontrada')
      router.push(`/room/${slug}`)
    } catch {
      setError('Sala não encontrada. Confira o código.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-4 py-12">
      {/* Logo */}
      <div className="mb-12 text-center">
        <div className="font-display text-5xl font-extrabold text-brand-green text-glow tracking-tight mb-2">
          MyBet
        </div>
        <p className="text-brand-muted text-sm">Apostas privadas entre amigos · Odds ao vivo</p>
      </div>

      {/* Card */}
      <div className="card w-full max-w-md glow-green">
        {/* Tabs */}
        <div className="flex border-b border-brand-border">
          <button
            onClick={() => setTab('create')}
            className={`flex-1 py-4 text-sm font-semibold transition-colors ${tab === 'create' ? 'text-brand-green border-b-2 border-brand-green -mb-px' : 'text-brand-muted hover:text-white'}`}
          >
            Criar sala
          </button>
          <button
            onClick={() => setTab('join')}
            className={`flex-1 py-4 text-sm font-semibold transition-colors ${tab === 'join' ? 'text-brand-green border-b-2 border-brand-green -mb-px' : 'text-brand-muted hover:text-white'}`}
          >
            Entrar numa sala
          </button>
        </div>

        <div className="p-6">
          {tab === 'create' ? (
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-xs text-brand-muted mb-1.5 font-medium uppercase tracking-wider">Nome da sala</label>
                <input className="input" placeholder="Ex: Aposta da galera" value={roomName} onChange={e => setRoomName(e.target.value)} required />
              </div>
              <div>
                <label className="block text-xs text-brand-muted mb-1.5 font-medium uppercase tracking-wider">Seu nome (Admin)</label>
                <input className="input" placeholder="Como te chamam?" value={adminName} onChange={e => setAdminName(e.target.value)} required />
              </div>
              <div>
                <label className="block text-xs text-brand-muted mb-1.5 font-medium uppercase tracking-wider">Sua chave PIX <span className="text-brand-muted font-normal normal-case">(opcional)</span></label>
                <input className="input" placeholder="CPF, e-mail, telefone ou chave aleatória" value={adminPix} onChange={e => setAdminPix(e.target.value)} />
              </div>
              {error && <p className="text-brand-red text-sm">{error}</p>}
              <button type="submit" disabled={loading} className="btn btn-green w-full py-3.5 text-base mt-2">
                {loading ? 'Criando...' : 'Criar sala →'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleJoin} className="space-y-4">
              <div>
                <label className="block text-xs text-brand-muted mb-1.5 font-medium uppercase tracking-wider">Código da sala</label>
                <input
                  className="input font-display text-2xl tracking-widest text-center uppercase"
                  placeholder="EX: BOLA1234"
                  value={joinSlug}
                  onChange={e => setJoinSlug(e.target.value)}
                  required
                />
              </div>
              <p className="text-xs text-brand-muted text-center">Peça o código para quem criou a sala</p>
              {error && <p className="text-brand-red text-sm text-center">{error}</p>}
              <button type="submit" disabled={loading} className="btn btn-green w-full py-3.5 text-base">
                {loading ? 'Buscando...' : 'Entrar →'}
              </button>
            </form>
          )}
        </div>
      </div>

      <p className="mt-8 text-xs text-brand-muted text-center max-w-xs">
        MyBet é uma plataforma de apostas recreativas entre amigos.<br />
        Os acertos são feitos diretamente via PIX entre os participantes.
      </p>
    </main>
  )
}
