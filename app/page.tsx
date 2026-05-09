'use client'
export const dynamic = 'force-dynamic'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase, generateSlug } from '@/lib/supabase'

export default function Home() {
  const router = useRouter()
  const [tab, setTab] = useState<'create'|'join'>('create')
  const [loading, setLoading] = useState(false)
  const [checkingAuth, setCheckingAuth] = useState(true)
  const [error, setError] = useState('')
  const [roomName, setRoomName] = useState('')
  const [joinSlug, setJoinSlug] = useState('')
  const [user, setUser] = useState<any>(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }: any) => {
      setUser(session?.user ?? null)
      setCheckingAuth(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_: any, session: any) => {
      setUser(session?.user ?? null)
    })
    return () => subscription.unsubscribe()
  }, [])

  async function loginWithGoogle() {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin }
    })
  }

  async function loginWithPhone() {
    const phone = prompt('Digite seu número com DDD (ex: 11999999999):')
    if (!phone) return
    const { error } = await supabase.auth.signInWithOtp({ phone: '+55' + phone.replace(/\D/g, '') })
    if (error) { alert('Erro: ' + error.message); return }
    const code = prompt('Digite o código SMS recebido:')
    if (!code) return
    await supabase.auth.verifyOtp({ phone: '+55' + phone.replace(/\D/g, ''), token: code, type: 'sms' })
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!roomName.trim()) return
    setLoading(true); setError('')
    try {
      const slug = generateSlug()
      const { data, error: err } = await supabase.from('rooms').insert({
        slug, name: roomName.trim(),
        admin_id: user?.id || null,
        admin_pix: null
      }).select().single()
      if (err) throw err
      if (!user) localStorage.setItem(`admin_${data.slug}`, '1')
      router.push(`/room/${data.slug}`)
    } catch { setError('Erro ao criar sala.') }
    finally { setLoading(false) }
  }

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault()
    const slug = joinSlug.trim().toLowerCase()
    if (!slug) return
    setLoading(true); setError('')
    try {
      const { data, error: err } = await supabase.from('rooms').select().eq('slug', slug).single()
      if (err || !data) throw new Error('not found')
      router.push(`/room/${slug}`)
    } catch { setError('Sala não encontrada.') }
    finally { setLoading(false) }
  }

  if (checkingAuth) return (
    <main className="min-h-screen flex items-center justify-center">
      <div className="font-display text-3xl text-[#00D4A0] animate-pulse">MyBet</div>
    </main>
  )

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-4 py-12">
      <div className="mb-10 text-center">
        <div className="font-display text-6xl font-extrabold text-[#00D4A0] text-glow tracking-tight mb-2">MyBet</div>
        <p className="text-[#4A6658] text-sm">Apostas privadas entre amigos · Odds ao vivo</p>
      </div>

      {/* Login / perfil */}
      <div className="w-full max-w-md mb-4">
        {user ? (
          <div className="card p-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              {user.user_metadata?.avatar_url
                ? <img src={user.user_metadata.avatar_url} className="w-8 h-8 rounded-full" alt="" />
                : <div className="w-8 h-8 rounded-full bg-[#1E2D24] flex items-center justify-center text-[#00D4A0] font-bold text-sm">{(user.user_metadata?.full_name || user.email || 'U')[0].toUpperCase()}</div>
              }
              <span className="text-sm text-white font-medium">{user.user_metadata?.full_name || user.email}</span>
            </div>
            <div className="flex gap-2">
              <button onClick={() => router.push('/profile')} className="btn btn-outline px-3 py-1.5 text-xs">Perfil</button>
              <button onClick={() => supabase.auth.signOut()} className="btn btn-outline px-3 py-1.5 text-xs text-[#4A6658]">Sair</button>
            </div>
          </div>
        ) : (
          <div className="card p-4 space-y-2">
            <p className="text-xs text-[#4A6658] text-center mb-2">Entre para salvar histórico e rastrear dívidas</p>
            <button onClick={loginWithGoogle} className="btn btn-outline w-full py-2.5 text-sm gap-2">
              <svg width="18" height="18" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
              Entrar com Google
            </button>
            <button onClick={loginWithPhone} className="btn btn-outline w-full py-2.5 text-sm">
              📱 Entrar com telefone
            </button>
          </div>
        )}
      </div>

      <div className="card w-full max-w-md glow-green animate-slide-up">
        <div className="flex border-b border-[#1E2D24]">
          {(['create','join'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`flex-1 py-4 text-sm font-semibold transition-colors ${tab === t ? 'text-[#00D4A0] border-b-2 border-[#00D4A0] -mb-px' : 'text-[#4A6658] hover:text-white'}`}>
              {t === 'create' ? 'Criar sala' : 'Entrar numa sala'}
            </button>
          ))}
        </div>
        <div className="p-6">
          {tab === 'create' ? (
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-xs text-[#4A6658] mb-1.5 font-medium uppercase tracking-wider">Nome da sala</label>
                <input className="input" placeholder="Ex: Aposta da galera" value={roomName} onChange={e => setRoomName(e.target.value)} required />
              </div>
              {error && <p className="text-[#FF4D6A] text-sm">{error}</p>}
              <button type="submit" disabled={loading} className="btn btn-green w-full py-3.5 text-base">
                {loading ? 'Criando...' : 'Criar sala →'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleJoin} className="space-y-4">
              <div>
                <label className="block text-xs text-[#4A6658] mb-1.5 font-medium uppercase tracking-wider">Código da sala</label>
                <input className="input font-display text-2xl tracking-widest text-center uppercase"
                  placeholder="BOLA1234" value={joinSlug} onChange={e => setJoinSlug(e.target.value)} required />
              </div>
              {error && <p className="text-[#FF4D6A] text-sm text-center">{error}</p>}
              <button type="submit" disabled={loading} className="btn btn-green w-full py-3.5 text-base">
                {loading ? 'Buscando...' : 'Entrar →'}
              </button>
            </form>
          )}
        </div>
      </div>
    </main>
  )
}
