'use client'
export const dynamic = 'force-dynamic'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase, type Profile, type Pick, type Debt } from '@/lib/supabase'

export default function ProfilePage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [picks, setPicks] = useState<Pick[]>([])
  const [debtsOwed, setDebtsOwed] = useState<Debt[]>([])   // eu devo
  const [debtsToMe, setDebtsToMe] = useState<Debt[]>([])   // me devem
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [name, setName] = useState('')
  const [pixKey, setPixKey] = useState('')
  const [avatarUrl, setAvatarUrl] = useState('')
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [tab, setTab] = useState<'debts'|'history'>('debts')
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }: any) => {
      if (!session) { router.push('/'); return }
      setUser(session.user)
      const { data: p } = await supabase.from('profiles').select().eq('id', session.user.id).single()
      if (p) {
        setProfile(p); setName(p.name); setPixKey(p.pix_key || ''); setAvatarUrl(p.avatar_url || '')
      }
      // Histórico de picks
      const { data: pks } = await supabase.from('picks').select().eq('user_id', session.user.id).order('created_at', { ascending: false }).limit(50)
      setPicks(pks || [])
      // Dívidas
      const { data: owed } = await supabase.from('debts').select('*, to_profile:profiles!debts_to_user_id_fkey(*)').eq('from_user_id', session.user.id).eq('settled', false)
      const { data: tome } = await supabase.from('debts').select('*, from_profile:profiles!debts_from_user_id_fkey(*)').eq('to_user_id', session.user.id).eq('settled', false)
      setDebtsOwed(owed || [])
      setDebtsToMe(tome || [])
      setLoading(false)
    })
  }, [router])

  async function saveProfile() {
    if (!user) return
    setSaving(true)
    await supabase.from('profiles').update({ name, pix_key: pixKey || null, avatar_url: avatarUrl || null, updated_at: new Date().toISOString() }).eq('id', user.id)
    setSaving(false)
  }

  async function uploadAvatar(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !user) return
    setUploadingAvatar(true)
    const ext = file.name.split('.').pop()
    const path = `${user.id}.${ext}`
    const { error } = await supabase.storage.from('avatars').upload(path, file, { upsert: true })
    if (!error) {
      const { data } = supabase.storage.from('avatars').getPublicUrl(path)
      setAvatarUrl(data.publicUrl)
    }
    setUploadingAvatar(false)
  }

  async function settleDebt(debtId: string) {
    await supabase.from('debts').update({ settled: true }).eq('id', debtId)
    setDebtsOwed(prev => prev.filter(d => d.id !== debtId))
  }

  if (loading) return (
    <main className="min-h-screen flex items-center justify-center">
      <div className="font-display text-3xl text-[#00D4A0] animate-pulse">MyBet</div>
    </main>
  )

  const totalOwed = debtsOwed.reduce((a, d) => a + d.amount, 0)
  const totalToMe = debtsToMe.reduce((a, d) => a + d.amount, 0)
  const totalWon = picks.filter(p => p.payout && p.payout > 0).reduce((a, p) => a + ((p.payout || 0) - p.amount), 0)
  const totalLost = picks.filter(p => p.payout === 0).reduce((a, p) => a + p.amount, 0)

  return (
    <main className="min-h-screen px-4 py-8 max-w-lg mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => router.back()} className="text-[#4A6658] hover:text-white">←</button>
        <div className="font-display text-2xl font-bold text-[#00D4A0]">Meu Perfil</div>
      </div>

      {/* Avatar + info */}
      <div className="card p-5 mb-4">
        <div className="flex items-center gap-4 mb-4">
          <div className="relative">
            {avatarUrl
              ? <img src={avatarUrl} className="w-20 h-20 rounded-full object-cover border-2 border-[#00D4A0]" alt="" />
              : <div className="w-20 h-20 rounded-full bg-[#1E2D24] flex items-center justify-center text-[#00D4A0] font-display text-3xl font-bold border-2 border-[#1E2D24]">{name[0]?.toUpperCase()}</div>
            }
            <button onClick={() => fileRef.current?.click()}
              className="absolute bottom-0 right-0 w-6 h-6 bg-[#00D4A0] rounded-full flex items-center justify-center text-[#0A0F0D] text-xs font-bold">
              {uploadingAvatar ? '...' : '+'}
            </button>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={uploadAvatar} />
          </div>
          <div className="flex-1">
            <input className="input text-lg font-semibold mb-2" value={name} onChange={e => setName(e.target.value)} placeholder="Seu nome" />
            <input className="input text-sm" value={pixKey} onChange={e => setPixKey(e.target.value)} placeholder="Sua chave PIX" />
          </div>
        </div>
        <button onClick={saveProfile} disabled={saving} className="btn btn-green w-full py-2.5 text-sm">
          {saving ? 'Salvando...' : 'Salvar perfil'}
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="card p-3 text-center">
          <div className="text-xs text-[#4A6658] mb-1">Apostas</div>
          <div className="font-display text-xl font-bold text-white">{picks.length}</div>
        </div>
        <div className="card p-3 text-center">
          <div className="text-xs text-[#4A6658] mb-1">Lucro</div>
          <div className={`font-display text-xl font-bold ${totalWon - totalLost >= 0 ? 'text-[#00D4A0]' : 'text-[#FF4D6A]'}`}>
            {totalWon - totalLost >= 0 ? '+' : ''}R${(totalWon - totalLost).toFixed(0)}
          </div>
        </div>
        <div className="card p-3 text-center">
          <div className="text-xs text-[#4A6658] mb-1">Saldo líquido</div>
          <div className={`font-display text-xl font-bold ${totalToMe - totalOwed >= 0 ? 'text-[#00D4A0]' : 'text-[#FF4D6A]'}`}>
            {totalToMe - totalOwed >= 0 ? '+' : ''}R${(totalToMe - totalOwed).toFixed(0)}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-[#1E2D24] mb-4">
        {(['debts','history'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`flex-1 py-3 text-sm font-semibold transition-colors ${tab === t ? 'text-[#00D4A0] border-b-2 border-[#00D4A0] -mb-px' : 'text-[#4A6658]'}`}>
            {t === 'debts' ? `💸 Dívidas` : `📋 Histórico`}
          </button>
        ))}
      </div>

      {/* Dívidas */}
      {tab === 'debts' && (
        <div className="space-y-3">
          {debtsOwed.length === 0 && debtsToMe.length === 0 && (
            <div className="card p-8 text-center text-[#4A6658]">Nenhuma dívida aberta 🎉</div>
          )}

          {debtsOwed.length > 0 && (
            <div>
              <div className="text-xs text-[#4A6658] uppercase tracking-wider mb-2">Você deve</div>
              {debtsOwed.map(d => (
                <div key={d.id} className="card p-3 mb-2 flex items-center justify-between">
                  <div>
                    <div className="text-[#FF4D6A] font-semibold">R$ {d.amount.toFixed(2)}</div>
                    <div className="text-xs text-[#4A6658]">para {(d as any).to_profile?.name || 'alguém'}</div>
                    {(d as any).to_profile?.pix_key && (
                      <div className="text-xs text-[#4A6658]">PIX: <span className="text-white">{(d as any).to_profile.pix_key}</span></div>
                    )}
                  </div>
                  <button onClick={() => settleDebt(d.id)} className="btn btn-outline px-3 py-1.5 text-xs">Paguei ✓</button>
                </div>
              ))}
            </div>
          )}

          {debtsToMe.length > 0 && (
            <div>
              <div className="text-xs text-[#4A6658] uppercase tracking-wider mb-2">Te devem</div>
              {debtsToMe.map(d => (
                <div key={d.id} className="card p-3 mb-2 flex items-center justify-between">
                  <div>
                    <div className="text-[#00D4A0] font-semibold">R$ {d.amount.toFixed(2)}</div>
                    <div className="text-xs text-[#4A6658]">de {(d as any).from_profile?.name || 'alguém'}</div>
                  </div>
                  <div className="text-xs text-[#4A6658]">aguardando PIX</div>
                </div>
              ))}
              {pixKey && (
                <div className="card p-3 bg-[#0D1510]">
                  <div className="text-xs text-[#4A6658] mb-1">Sua chave PIX para compartilhar:</div>
                  <div className="text-white font-semibold">{pixKey}</div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Histórico */}
      {tab === 'history' && (
        <div className="space-y-2">
          {picks.length === 0 && (
            <div className="card p-8 text-center text-[#4A6658]">Nenhuma aposta ainda</div>
          )}
          {picks.map(p => (
            <div key={p.id} className="card p-3 flex items-center justify-between">
              <div>
                <div className="text-sm text-white font-medium">{p.player_name}</div>
                <div className="text-xs text-[#4A6658]">
                  {p.side ? `Apostou ${p.side}` : 'Apostou'} · R$ {p.amount.toFixed(2)}
                </div>
              </div>
              <div className="text-right">
                {p.payout === null && <span className="text-xs text-[#4A6658]">Pendente</span>}
                {p.payout !== null && p.payout > 0 && <span className="text-[#00D4A0] font-semibold text-sm">+R$ {(p.payout - p.amount).toFixed(2)}</span>}
                {p.payout === 0 && <span className="text-[#FF4D6A] text-sm">-R$ {p.amount.toFixed(2)}</span>}
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  )
}
