'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'

interface Props {
  roomId: string
  onClose: () => void
  onCreated: () => void
}

export default function NewBetModal({ roomId, onClose, onCreated }: Props) {
  const [title, setTitle] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) return
    setLoading(true); setError('')
    try {
      const { error: err } = await supabase.from('bets').insert({
        room_id: roomId,
        title: title.trim(),
        status: 'open',
        pool_sim: 0,
        pool_nao: 0,
      })
      if (err) throw err
      onCreated()
      onClose()
    } catch {
      setError('Erro ao criar aposta. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="card w-full max-w-md glow-green animate-slide-up">
        <div className="p-5 border-b border-brand-border flex items-center justify-between">
          <div className="font-display text-lg font-bold text-white">Nova aposta</div>
          <button onClick={onClose} className="text-brand-muted hover:text-white text-xl leading-none">✕</button>
        </div>
        <form onSubmit={handleCreate} className="p-5 space-y-4">
          <div>
            <label className="block text-xs text-brand-muted mb-1.5 font-medium uppercase tracking-wider">
              O que está em jogo?
            </label>
            <textarea
              className="input resize-none"
              rows={3}
              placeholder="Ex: O cachorro vai fazer coco nos próximos 30 minutos?"
              value={title}
              onChange={e => setTitle(e.target.value)}
              required
              autoFocus
            />
          </div>
          <div className="text-xs text-brand-muted bg-brand-dark rounded-lg p-3">
            💡 Seja específico! Quanto mais clara a aposta, menos confusão na hora de resolver.
          </div>
          {error && <p className="text-brand-red text-sm">{error}</p>}
          <div className="grid grid-cols-2 gap-3">
            <button type="button" onClick={onClose} className="btn btn-outline py-3">Cancelar</button>
            <button type="submit" disabled={loading} className="btn btn-green py-3 disabled:opacity-50">
              {loading ? 'Criando...' : 'Criar aposta →'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
