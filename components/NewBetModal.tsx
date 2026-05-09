'use client'
import { useState } from 'react'
import { supabase, type BetType } from '@/lib/supabase'

interface Props { roomId: string; onClose: () => void; onCreated: () => void }

const BET_TYPES: { type: BetType; emoji: string; label: string; desc: string; example: string }[] = [
  { type: 'binary',   emoji: '⚡', label: 'Sim ou Não',        desc: 'Uma pergunta, dois lados',          example: '"O Rique vai cair da cadeira?"' },
  { type: 'timeline', emoji: '⏱️', label: 'Quando vai ser?',   desc: 'Vários prazos, cada um com SIM/NÃO', example: '"Em 30min / Em 1h / Em 2h"' },
  { type: 'choice',   emoji: '🏆', label: 'Quem vai ganhar?',  desc: 'Várias opções, aposta em uma',       example: '"Pedro / João / Ana / Rique"' },
]

export default function NewBetModal({ roomId, onClose, onCreated }: Props) {
  const [step, setStep] = useState<'type'|'details'>('type')
  const [betType, setBetType] = useState<BetType|null>(null)
  const [title, setTitle] = useState('')
  const [options, setOptions] = useState(['', ''])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  function selectType(t: BetType) { setBetType(t); setStep('details') }

  function updateOption(i: number, val: string) {
    const next = [...options]; next[i] = val; setOptions(next)
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim() || !betType) return
    const validOptions = betType === 'binary' ? ['Aposta'] : options.map(o => o.trim()).filter(Boolean)
    if (betType !== 'binary' && validOptions.length < 2) {
      setError('Adicione pelo menos 2 opções.'); return
    }
    setLoading(true); setError('')
    try {
      const { data: bet, error: betErr } = await supabase.from('bets')
        .insert({ room_id: roomId, title: title.trim(), bet_type: betType, status: 'open' })
        .select().single()
      if (betErr) throw betErr

      const rows = betType === 'binary'
        ? [{ bet_id: bet.id, label: 'Aposta', sort_order: 0, pool_sim: 0, pool_nao: 0, pool_choice: 0 }]
        : validOptions.map((label, i) => ({ bet_id: bet.id, label, sort_order: i, pool_sim: 0, pool_nao: 0, pool_choice: 0 }))

      const { error: outErr } = await supabase.from('outcomes').insert(rows)
      if (outErr) throw outErr
      onCreated(); onClose()
    } catch { setError('Erro ao criar. Tente novamente.') }
    finally { setLoading(false) }
  }

  const placeholders: Record<BetType, string[]> = {
    binary: [],
    timeline: ['Ex: Em 30 minutos', 'Ex: Em 1 hora', 'Ex: Em 2 horas'],
    choice: ['Ex: Pedro', 'Ex: João', 'Ex: Ana', 'Ex: Rique'],
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
      <div className="card w-full max-w-md animate-slide-up">
        <div className="p-5 border-b border-[#1E2D24] flex items-center justify-between">
          <div className="flex items-center gap-3">
            {step === 'details' && (
              <button onClick={() => setStep('type')} className="text-[#4A6658] hover:text-white text-sm">← Voltar</button>
            )}
            <div className="font-display text-lg font-bold text-white">Nova aposta</div>
          </div>
          <button onClick={onClose} className="text-[#4A6658] hover:text-white text-xl">✕</button>
        </div>

        {/* STEP 1: escolher tipo */}
        {step === 'type' && (
          <div className="p-5 space-y-3">
            <p className="text-sm text-[#4A6658] mb-4">Que tipo de aposta você quer criar?</p>
            {BET_TYPES.map(bt => (
              <button key={bt.type} onClick={() => selectType(bt.type)}
                className="w-full text-left p-4 rounded-xl border border-[#1E2D24] bg-[#0D1510] hover:border-[#00D4A0] transition-all group">
                <div className="flex items-start gap-3">
                  <span className="text-2xl">{bt.emoji}</span>
                  <div className="flex-1">
                    <div className="font-semibold text-white group-hover:text-[#00D4A0] transition-colors">{bt.label}</div>
                    <div className="text-xs text-[#4A6658] mt-0.5">{bt.desc}</div>
                    <div className="text-xs text-[#4A6658] mt-1 italic">{bt.example}</div>
                  </div>
                  <span className="text-[#4A6658] group-hover:text-[#00D4A0] transition-colors">→</span>
                </div>
              </button>
            ))}
          </div>
        )}

        {/* STEP 2: preencher detalhes */}
        {step === 'details' && betType && (
          <form onSubmit={handleCreate} className="p-5 space-y-4">
            <div>
              <label className="block text-xs text-[#4A6658] mb-1.5 font-medium uppercase tracking-wider">Pergunta</label>
              <textarea className="input resize-none" rows={2}
                placeholder={betType === 'binary' ? 'Ex: O cachorro vai fazer coco?' : betType === 'timeline' ? 'Ex: O cachorro vai fazer coco?' : 'Ex: Quem vai beber mais chopp?'}
                value={title} onChange={e => setTitle(e.target.value)} required autoFocus />
            </div>

            {betType !== 'binary' && (
              <div>
                <label className="block text-xs text-[#4A6658] mb-2 font-medium uppercase tracking-wider">
                  {betType === 'timeline' ? 'Prazos' : 'Opções'}
                </label>
                <div className="space-y-2">
                  {options.map((o, i) => (
                    <div key={i} className="flex gap-2 items-center">
                      <input className="input flex-1 text-sm"
                        placeholder={(placeholders[betType]?.[i]) || `Opção ${i + 1}`}
                        value={o} onChange={e => updateOption(i, e.target.value)} />
                      {options.length > 2 && (
                        <button type="button" onClick={() => setOptions(options.filter((_, idx) => idx !== i))}
                          className="text-[#4A6658] hover:text-[#FF4D6A] text-lg w-8">✕</button>
                      )}
                    </div>
                  ))}
                </div>
                {options.length < 6 && (
                  <button type="button" onClick={() => setOptions([...options, ''])}
                    className="mt-2 text-xs text-[#00D4A0] hover:text-white transition-colors">
                    + Adicionar {betType === 'timeline' ? 'prazo' : 'opção'}
                  </button>
                )}
              </div>
            )}

            {error && <p className="text-[#FF4D6A] text-sm">{error}</p>}
            <div className="grid grid-cols-2 gap-3 pt-1">
              <button type="button" onClick={onClose} className="btn btn-outline py-3">Cancelar</button>
              <button type="submit" disabled={loading} className="btn btn-green py-3">
                {loading ? 'Criando...' : 'Criar aposta →'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
