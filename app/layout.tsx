import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'MyBet — Apostas entre amigos',
  description: 'Apostas privadas com odds ao vivo. Crie uma sala e aposte com seus amigos.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  )
}
