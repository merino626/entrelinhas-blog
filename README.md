# Entrelinhas — a blog platform with CMS, community features, and security built in from day one

A pnpm monorepo with three packages:

| Package | Stack | What it does |
|---|---|---|
| `apps/api` | NestJS 11 + Prisma 6 + Supabase (Postgres/Auth/Storage) | Versioned REST API (`/api/v1`), RBAC, rate limiting, sanitization, notifications |
| `apps/web` | Next.js 15 (App Router) + Tailwind 4 + Tiptap | Public site (SSR/ISR + SEO) and the `/admin` CMS |
| `packages/shared` | Plain TypeScript | Types/contracts shared between the API and the frontend |

## Architecture

Three separately-hosted services, wired together by env vars:

```
┌─────────────┐        ┌──────────────────┐        ┌───────────────────────────┐
│   Vercel    │──HTTP─▶│      Render       │──SQL──▶│         Supabase          │
│  apps/web   │◀──────│     apps/api      │◀──────│  Postgres · Auth · Storage │
│ (Next.js)   │  JSON  │    (NestJS)       │        │  (post-media / avatars)   │
└─────────────┘        └──────────────────┘        └───────────────────────────┘
```

- **Supabase** is the data layer: Postgres (accessed through Prisma), Auth (GoTrue — issues the JWTs the API verifies), and Storage (two public buckets, `post-media` and `avatars`). Nothing runs "on" Supabase besides the managed Postgres/Auth/Storage services — there's no Supabase Edge Function or RLS-only access path; all reads/writes go through the NestJS API using the `service_role` key.
- **Render** hosts `apps/api` — a long-running Node process (NestJS), not a serverless function, since it needs persistent rate-limiting/session state in memory and a stable outbound IP-ish behavior for cookies.
- **Vercel** hosts `apps/web` — a standard Next.js deployment (SSR/ISR for public pages, client-rendered CMS under `/admin`).

## Local development

```bash
pnpm install
```

### 1. Fill in the Supabase keys (required for auth/uploads)

Copy `apps/api/.env.example` → `apps/api/.env` and `apps/web/.env.example` → `apps/web/.env.local`, then in the Supabase dashboard (**Settings → API Keys**) copy:

- **anon / publishable key** → `SUPABASE_ANON_KEY` in `apps/api/.env` **and** `NEXT_PUBLIC_SUPABASE_ANON_KEY` in `apps/web/.env.local`
- **service_role / secret key** → `SUPABASE_SERVICE_ROLE_KEY` in `apps/api/.env` (⚠ never expose this in the frontend)
- (optional, legacy-JWT projects only) **JWT Secret** → `SUPABASE_JWT_SECRET`; if left empty, the API validates tokens via JWKS automatically

Also fill in `DATABASE_URL`/`DIRECT_URL` (Supabase → **Settings → Database → Connection string**, pooled + direct) and run migrations:

```bash
pnpm --filter @blog/api run prisma:deploy
```

### 2. Seed (storage buckets + first admin + categories)

```bash
pnpm --filter @blog/api run seed
```

Creates the `post-media`/`avatars` public buckets, the first admin user, and 3 starter categories. **Set `SEED_ADMIN_EMAIL`/`SEED_ADMIN_PASSWORD`/`SEED_ADMIN_USERNAME` in `.env` before running it** — without them the script falls back to a predictable email/password, which must never be used outside a throwaway local environment.

### 3. Run

```bash
pnpm dev          # API on :3001, web on :3000
pnpm dev:api      # API only (Swagger docs at http://localhost:3001/api/docs)
pnpm dev:web      # web only
```

## Roles (RBAC)

- **USER** — comments, replies (with @mentions), reacts 👍/👎, likes, saves, follows authors/categories
- **REDATOR** ("writer") — everything above + creates/edits/publishes their *own* posts in `/admin`
- **ADMIN** — everything + posts by any author, categories, user roles (cannot change their own role — anti-lockout)

Promote someone from **/admin/usuarios** or via `PATCH /api/v1/users/:id/role`.

## Security decisions

- **Passwords/tokens**: Supabase Auth (hashing + refresh rotation with reuse detection). The access token lives only in browser memory; the refresh token sits in an `httpOnly` cookie scoped to `/api/v1/auth`.
- **Sessions/devices**: every session is recorded (`user_sessions`); revoking one blacklists its `session_id` — the matching JWT is rejected immediately and its refresh is blocked. "Log out everywhere" revokes all of them (local + GoTrue global).
- **Rate limiting**: 120 req/min global per IP; login/register 5/min; comments 6/min; reactions/follows 30/min; uploads 20/min.
- **XSS**: editor HTML goes through an allow-list (`sanitize-html`) server-side; iframes are restricted to YouTube/Vimeo; `javascript:` URLs and `on*` handlers are stripped. Comments are rendered as plain text by React.
- **SQL injection**: 100% Prisma (parameterized queries), zero string-concatenated SQL.
- **Uploads**: every image is decoded and re-encoded (sharp → webp), which validates by magic bytes, destroys polyglot payloads, and strips EXIF/geolocation metadata. Storage objects are deleted whenever the media they belong to is replaced or removed (avatar swaps, post cover changes, edited-out content images, deleted posts) so nothing accumulates as orphaned storage.
- **Anti-abuse**: minimum interval between comments, max 2 links/comment, `unique` constraints against duplicate likes, restricted CORS, `helmet` + CSP, origin-check on cookie routes, RLS enabled on every table (defense in depth).
- **Anti-flood notifications**: repeated events collapse into a single unread notification ("Fulano and 12 others liked…") — like/unlike loops don't inflate counts or spam the feed.

## Realtime

The notification bell uses Supabase Realtime (with RLS: each user only receives their own events). Without the anon key configured on the frontend, it falls back to polling automatically.

## Deployment

### 1. Supabase (data layer)

1. Create a Supabase project. Note the **Project URL**, **anon key**, and **service_role key** (**Settings → API**).
2. Grab the pooled and direct Postgres connection strings (**Settings → Database → Connection string**) for `DATABASE_URL`/`DIRECT_URL`.
3. Run `pnpm --filter @blog/api run prisma:deploy` once (from a machine with those env vars set) to apply migrations.
4. Run `pnpm --filter @blog/api run seed` once to create the `post-media`/`avatars` storage buckets and the first admin account.

### 2. Render (API)

- **Root Directory**: `apps/api`
- **Build Command**: `pnpm install --frozen-lockfile && pnpm run prisma:generate && pnpm run build`
- **Start Command**: `node dist/src/main.js`
- **Environment variables**: everything in `apps/api/.env.example`, plus:
  - `WEB_ORIGIN` → the Vercel production domain(s), comma-separated (e.g. `https://entrelinhas-blog-web.vercel.app`)
  - `COOKIE_SAMESITE=none` and `COOKIE_SECURE=true` (API and frontend live on different domains, so the refresh-token cookie must be cross-site)
  - **Do not add a `PORT` variable at all** — Render injects its own, and the app reads `process.env.PORT` (falling back to `3001` only when the var is completely absent). A `PORT` variable left *blank* in the dashboard is not the same as unset — it makes the app bind to a random OS port and breaks Render's health checks. If that ever happens, delete the variable rather than trying to fill it in.

### 3. Vercel (frontend)

- **Root Directory**: `apps/web`
- **Framework Preset**: Next.js (auto-detected)
- **Build/Install Command**: defaults (Vercel resolves the pnpm workspace correctly even with a subfolder root)
- **Environment variables**: everything in `apps/web/.env.example`:
  - `NEXT_PUBLIC_API_URL` → the Render service URL, **without** a trailing `/api/v1` (the code appends it)
  - `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` → same Supabase project as the API

Vercel provisions three domains per project: a stable production alias (`*.vercel.app`), a stable `git-main` branch alias, and a per-deployment URL that changes on every deploy. Use the production alias (and optionally the `git-main` one) in Render's `WEB_ORIGIN` — never the per-deployment URL, since it won't survive the next deploy. If you attach a custom domain in Vercel later, add it to `WEB_ORIGIN` too.

### Wiring order

Because the two services reference each other's URLs, the practical order is: deploy the API first (Render), deploy the frontend pointing at it (Vercel), then go back to Render and set `WEB_ORIGIN` to the Vercel URL you just got. Until that last step, the frontend loads but every API call fails CORS.

## Roadmap (out of current scope)

Paid products/courses, direct video upload, Turnstile/captcha on registration, data export (LGPD/GDPR), dedicated comment moderation in the admin panel.
