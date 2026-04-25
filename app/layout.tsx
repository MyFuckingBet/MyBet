import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'MyBet — Apostas entre amigos',
  description: 'Crie apostas privadas com seus amigos. Odds ao vivo, pagamento via PIX.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="content">{children}</body>
    </html>
  )
}
