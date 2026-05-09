'use client'
export const dynamic = 'force-dynamic'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function AuthCallback() {
  const router = useRouter()

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        await supabase.from('profiles').upsert({
          id: session.user.id,
          name: session.user.user_metadata?.full_name || session.user.user_metadata?.name || session.user.email?.split('@')[0] || 'Usuário',
          avatar_url: session.user.user_metadata?.avatar_url || null,
        }, { onConflict: 'id' })
      }
      router.replace('/')
    })
  }, [router])

  return (
    <main className="min-h-screen flex items-center justify-center">
      <div className="font-display text-3xl text-[#00D4A0] animate-pulse">MyBet</div>
    </main>
  )
}
