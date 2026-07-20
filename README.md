# Entrelinhas — blog com CMS, comunidade e segurança desde o dia zero

Monorepo pnpm com três pacotes:

| Pacote | Stack | O que faz |
|---|---|---|
| `apps/api` | NestJS 11 + Prisma 6 + Supabase (Postgres/Auth/Storage) | API REST versionada (`/api/v1`), RBAC, rate limiting, sanitização, notificações |
| `apps/web` | Next.js 15 (App Router) + Tailwind 4 + Tiptap | Site público (SSR/ISR + SEO) e CMS `/admin` |
| `packages/shared` | TypeScript puro | Tipos/contratos compartilhados entre API e front |

## Primeiros passos

```bash
pnpm install
```

### 1. Preencher as chaves do Supabase (obrigatório para auth/uploads)

No painel do Supabase (**Settings → API Keys**), copie:

- **anon / publishable key** → `SUPABASE_ANON_KEY` em `apps/api/.env` **e** `NEXT_PUBLIC_SUPABASE_ANON_KEY` em `apps/web/.env.local`
- **service_role / secret key** → `SUPABASE_SERVICE_ROLE_KEY` em `apps/api/.env` (⚠ nunca no front)
- (opcional, projetos com JWT legado) **JWT Secret** → `SUPABASE_JWT_SECRET`; se vazio, a API valida tokens via JWKS automaticamente

O banco já está migrado (`prisma migrate deploy` já foi executado). Para re-aplicar em outro ambiente: `pnpm --filter @blog/api run prisma:deploy`.

### 2. Seed (buckets + primeiro admin + categorias)

```bash
pnpm --filter @blog/api run seed
```

Cria os buckets `post-media`/`avatars`, o primeiro usuário admin e 3 categorias iniciais. **Defina `SEED_ADMIN_EMAIL`/`SEED_ADMIN_PASSWORD`/`SEED_ADMIN_USERNAME` no `.env` antes de rodar** — sem isso o script usa um e-mail e senha padrão previsíveis, que não devem ser usados fora de ambiente local descartável.

### 3. Rodar

```bash
pnpm dev          # API em :3001 e web em :3000
pnpm dev:api      # só API  (docs Swagger em http://localhost:3001/api/docs)
pnpm dev:web      # só web
```

## Papéis (RBAC)

- **USER** — comenta, responde (com @menção), reage 👍/👎, curte, salva, segue autores/categorias
- **REDATOR** — tudo acima + cria/edita/publica os *próprios* posts no `/admin`
- **ADMIN** — tudo + posts de qualquer autor, categorias, papéis de usuários (não altera o próprio papel — anti-lockout)

Promova alguém em **/admin/usuarios** ou via API `PATCH /api/v1/users/:id/role`.

## Decisões de segurança

- **Senhas/tokens**: Supabase Auth (hash + refresh rotation com detecção de reuso). Access token só em memória no browser; refresh token em cookie `httpOnly` restrito a `/api/v1/auth`.
- **Sessões/dispositivos**: cada sessão é registrada (`user_sessions`); revogar uma sessão coloca o `session_id` na blacklist — o JWT correspondente passa a ser rejeitado imediatamente e o refresh é bloqueado. “Sair de todos os dispositivos” revoga tudo (local + GoTrue global).
- **Rate limiting**: 120 req/min global por IP; login/registro 5/min; comentários 6/min; reações/follows 30/min; uploads 20/min.
- **XSS**: HTML do editor passa por allow-list (`sanitize-html`) no servidor; iframes só de YouTube/Vimeo; `javascript:` e handlers `on*` eliminados. Comentários renderizados como texto puro pelo React.
- **SQL injection**: 100% Prisma (queries parametrizadas), zero SQL concatenado.
- **Uploads**: toda imagem é decodificada e re-encodada (sharp → webp), o que valida por magic bytes, destrói payloads poliglotas e remove EXIF/geolocalização.
- **Anti-abuso**: intervalo mínimo entre comentários, máx. 2 links/comentário, constraints `unique` contra likes duplicados, CORS restrito, `helmet` + CSP, origin-check nas rotas de cookie, RLS habilitada em todas as tabelas (defesa em profundidade).
- **Notificações anti-flood**: eventos iguais “estacam” numa única notificação não lida (“Fulano e mais 12 curtiram…”) — curtir/descurtir em loop não infla contadores nem gera spam.

## Realtime

O sino de notificações usa Supabase Realtime (com RLS: cada usuário só recebe as próprias). Sem a anon key configurada no front, cai automaticamente em polling.

## Deploy (gratuito)

- `apps/web` → Vercel (root `apps/web`)
- `apps/api` → Render/Fly (build `pnpm --filter @blog/api build`, start `node dist/src/main.js`)
- Em produção cross-domain: `COOKIE_SAMESITE=none`, `COOKIE_SECURE=true`, `WEB_ORIGIN=https://seu-dominio`

## Roadmap (fora do escopo atual)

Infoprodutos/cursos, upload direto de vídeo, Turnstile/captcha no registro, exportação de dados (LGPD), moderação dedicada de comentários no admin.
