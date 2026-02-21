# 🦷 DenteSoft

Sistema de gestão para consultório odontológico. Mobile-first, zero custo de infraestrutura.

**Stack:** Next.js 14 · TypeScript · Supabase · Tailwind CSS · Vercel

---

## Módulos implementados

| Módulo | Status |
|---|---|
| 1 — Pacientes (cadastro, busca, ficha, foto) | ✅ |
| 2 — Histórico de Tratamento (atendimentos, procedimentos) | ✅ |
| 3 — Radiografias (upload, galeria, viewer com zoom) | ✅ |
| 4 — Financeiro (lançamentos, parcelas, inadimplentes) | ✅ |
| PWA (offline, installable, safe-area iOS) | ✅ |

---

## Deploy — passo a passo

### 1. Supabase

1. Criar projeto em supabase.com (plano free)
2. Ativar extensões em Database → Extensions:
   - pg_cron (atualização automática de parcelas vencidas)
   - pg_trgm (busca de pacientes por nome)
3. Executar migrations em ordem em SQL Editor:
   - migrations/001_schema_inicial.sql
   - migrations/002_storage_radiografias.sql
   - migrations/003_financeiro_views_indices.sql
   - migrations/004_storage_fotos_pacientes.sql
4. Copiar Project URL e anon public key de Settings → API

### 2. Primeiro usuário

No Supabase SQL Editor:

  -- 1. Criar a clínica
  INSERT INTO clinicas (nome, telefone)
  VALUES ('Clínica Dr. Silva', '(27) 3000-0000')
  RETURNING id;

  -- 2. Criar via Authentication → Users → Invite user
  -- Depois pegar o UUID e rodar:
  INSERT INTO usuarios (id, clinica_id, nome, perfil)
  VALUES ('UUID_AUTH', 'UUID_CLINICA', 'Dr. João Silva', 'dentista');

  -- 3. Procedimentos iniciais
  INSERT INTO procedimentos (clinica_id, nome, valor_padrao) VALUES
    ('UUID_CLINICA', 'Consulta', 150.00),
    ('UUID_CLINICA', 'Limpeza', 180.00),
    ('UUID_CLINICA', 'Extração simples', 250.00),
    ('UUID_CLINICA', 'Restauração', 350.00),
    ('UUID_CLINICA', 'Canal', 800.00),
    ('UUID_CLINICA', 'Clareamento', 600.00);

### 3. Vercel

  git clone <repo>
  cd dentesoft
  npm install
  cp .env.example .env.local
  # Preencher .env.local com credenciais do Supabase
  npm run dev

No dashboard Vercel → Settings → Environment Variables:
  NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
  NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...

### 4. Instalar como PWA no celular

  iOS Safari: Compartilhar → Adicionar à Tela de Início
  Android Chrome: Menu → Instalar aplicativo

Gerar ícones reais:
  npx pwa-asset-generator logo.png public/icons

---

## Estrutura

  src/
  ├── app/
  │   ├── (auth)/login/
  │   ├── (app)/
  │   │   ├── pacientes/         lista, ficha, novo, editar
  │   │   ├── historico/         timeline global
  │   │   ├── radiografias/      galeria global
  │   │   └── financeiro/        painel, lançamento, inadimplentes, parcelas
  │   ├── layout.tsx             root com AuthProvider
  │   └── page.tsx               redirect → /pacientes ou /login
  ├── components/
  │   ├── financeiro/
  │   ├── pacientes/
  │   ├── radiografias/
  │   └── shared/                AuthProvider, FotoUploader, MenuInferior
  ├── lib/
  │   ├── hooks/                 useAtendimentos, useFinanceiro, useRadiografias...
  │   ├── supabase/              client, server, types
  │   └── utils/
  ├── middleware.ts
  └── store/auth.store.ts

---

## Segurança

- RLS ativo em todas as tabelas (dados isolados por clinica_id)
- Buckets de storage privados — sempre createSignedUrl(), nunca getPublicUrl()
- Middleware bloqueia rotas sem sessão
- Signed URLs: 1h (radiografias), 1 semana (fotos)

---

## V2 — Próximos passos

- [ ] Agendamento com calendário semanal
- [ ] Notificações WhatsApp para cobranças vencidas
- [ ] Exportação financeira (CSV/PDF)
- [ ] Odontograma interativo (32 dentes)
- [ ] Múltiplos dentistas com filtro por profissional
