# MyBet 🎲

Plataforma de apostas privadas entre amigos com odds ao vivo.

---

## Deploy em 3 passos (sem instalar nada)

### 1. Supabase — banco de dados (5 min)

1. Acesse [supabase.com](https://supabase.com) e crie uma conta gratuita
2. Clique em **New Project** → dê um nome → aguarde ~2 min
3. Vá em **SQL Editor** → cole TODO o conteúdo do arquivo `supabase-schema.sql` → clique **Run**
4. Vá em **Project Settings → API** e copie:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon public key** → `NEXT_PUBLIC_SUPABASE_ANON_KEY`

### 2. GitHub — suba o código (3 min)

1. Crie uma conta em [github.com](https://github.com) (se não tiver)
2. Clique em **New repository** → nome: `mybet` → **Create repository**
3. Arraste todos os arquivos desta pasta para a página do repositório (ou use o botão "uploading an existing file")
4. Clique **Commit changes**

### 3. Vercel — deploy (3 min)

1. Acesse [vercel.com](https://vercel.com) e faça login com sua conta GitHub
2. Clique em **Add New Project** → selecione o repositório `mybet`
3. Em **Environment Variables**, adicione as duas variáveis:
   - `NEXT_PUBLIC_SUPABASE_URL` = sua URL do Supabase
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = sua anon key do Supabase
4. Clique **Deploy** → aguarde ~2 min
5. Sua URL pública estará disponível! Ex: `mybet-abc123.vercel.app`

---

## Como usar

1. **Admin**: Acesse a URL, clique em **Criar sala**, coloque seu nome e chave PIX
2. **Compartilhe**: Copie o link e mande para os amigos no WhatsApp
3. **Aposte**: Cada pessoa entra na sala, clica na aposta e escolhe SIM ou NÃO
4. **Resolva**: O admin decide o resultado → app calcula quem ganhou e quanto
5. **Pague**: Os perdedores transferem via PIX para os ganhadores

---

## Tecnologias

- **Next.js 14** — framework React
- **Supabase** — banco PostgreSQL + realtime
- **Tailwind CSS** — estilização
- **Vercel** — hospedagem

## Odds

As odds são calculadas pelo modelo parimutuel (totalizador):
- `odd_SIM = (pool_SIM + pool_NÃO) / pool_SIM`
- Quanto mais gente aposta num lado, menor a odd desse lado
- Todo o dinheiro vai para os vencedores (sem taxa da casa)
