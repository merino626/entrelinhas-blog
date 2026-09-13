<div align="center">

# Entrelinhas

**A blog platform with a CMS, community features, and RBAC/security built in from day one — not bolted on after a tutorial.**

[![NestJS](https://img.shields.io/badge/NestJS-11-E0234E?logo=nestjs&logoColor=white)](https://nestjs.com/)
[![Next.js](https://img.shields.io/badge/Next.js-15-000000?logo=nextdotjs&logoColor=white)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Prisma](https://img.shields.io/badge/Prisma-6-2D3748?logo=prisma&logoColor=white)](https://www.prisma.io/)
[![Supabase](https://img.shields.io/badge/Supabase-Postgres%20%2F%20Auth%20%2F%20Storage-3ECF8E?logo=supabase&logoColor=white)](https://supabase.com/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-4-06B6D4?logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![Jest](https://img.shields.io/badge/Jest-tested-C21325?logo=jest&logoColor=white)](https://jestjs.io/)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

**English** · [Português (BR)](README.pt-BR.md)

</div>

---

## Table of contents

- [Screenshots](#screenshots)
- [Why I built this](#why-i-built-this)
- [What it actually does](#what-it-actually-does)
- [Features](#features)
- [Tech stack](#tech-stack)
- [Architecture](#architecture)
- [Engineering decisions worth calling out](#engineering-decisions-worth-calling-out)
- [Security model](#security-model)
- [Project structure](#project-structure)
- [Running it locally](#running-it-locally)
- [Deployment](#deployment)
- [Roadmap](#roadmap)
- [License](#license)

---

## Screenshots

### Dark mode with no flash of the wrong theme

The saved preference is applied by an inline script before the page hydrates — not a client-side effect racing the first paint.

![Theme toggle](docs/screenshots/theme-toggle.gif)

### Commenting and reacting, live on the deployed app

Optimistic UI: the like count and the new comment appear immediately, reconciled against the server response right after.

![Comment and reaction](docs/screenshots/comment-reaction.gif)

### The public site

|                                          Home feed                                          |                                        Post page                                        |
| :----------------------------------------------------------------------------------------------: | :------------------------------------------------------------------------------------------: |
| ![Home](docs/screenshots/home.png)<br>_Latest posts, trending, and category filters — SSR/ISR, no client-side spinner_ | ![Post detail](docs/screenshots/post-detail.png)<br>_Auto-generated table of contents, reactions, follow-the-author_ |

|                                          Category page                                          |                                        Author profile                                        |
| :----------------------------------------------------------------------------------------------: | :------------------------------------------------------------------------------------------: |
| ![Category](docs/screenshots/categoria.png)<br>_Every post filed under one category, with its own follow button_ | ![Author](docs/screenshots/autor.png)<br>_Public profile: role badge, follower count, published posts_ |

### Auth, including a from-scratch password recovery flow

|                                          Login                                          |                                        Register                                        |
| :----------------------------------------------------------------------------------------------: | :------------------------------------------------------------------------------------------: |
| ![Login](docs/screenshots/login.png)<br>_Refresh token in an `httpOnly` cookie — the access token never touches `localStorage`_ | ![Register](docs/screenshots/registro.png)<br>_Password policy enforced identically on client and server_ |

![Forgot password](docs/screenshots/recuperar-senha.png)
_Always the same generic response, whether or not the e-mail exists — see [Engineering decisions](#engineering-decisions-worth-calling-out)_

### Notifications and account security

|                                          Notifications                                          |                                        Active sessions                                        |
| :----------------------------------------------------------------------------------------------: | :------------------------------------------------------------------------------------------: |
| ![Notifications](docs/screenshots/notificacoes.png)<br>_Realtime via Supabase, falls back to polling automatically_ | ![Sessions](docs/screenshots/perfil-seguranca.png)<br>_Every device that has ever logged in — revoke any one individually_ |

### The `/admin` CMS

|                                          Post editor (Tiptap)                                          |                                        Post list                                        |
| :----------------------------------------------------------------------------------------------: | :------------------------------------------------------------------------------------------: |
| ![Editor](docs/screenshots/admin-editor.png)<br>_Rich text, image/video embeds, cover swap — every image re-encoded server-side_ | ![Posts](docs/screenshots/admin-posts.png)<br>_A REDATOR only sees and edits their own posts; an ADMIN sees everyone's_ |

|                                          Categories                                          |                                        User roles (RBAC)                                        |
| :----------------------------------------------------------------------------------------------: | :------------------------------------------------------------------------------------------: |
| ![Categories](docs/screenshots/admin-categorias.png)<br>_Create/delete, post count per category_ | ![Users](docs/screenshots/admin-usuarios.png)<br>_Promote/demote — notice the admin's own row has no role selector_ |

_The interface itself is entirely in Brazilian Portuguese — screenshots above are the real, deployed app with real data (no mock/seed placeholders), captured against [blog.merinodev.tech](https://blog.merinodev.tech)._

---

## Why I built this

Most portfolio CRUD apps stop at "users can log in and post things." I wanted to build the version of that idea that actually holds up to the questions a security-minded reviewer would ask: What happens if a session is stolen? Can the last admin lock themselves out? What happens to an S3-shaped `post-media` bucket when a post is deleted — does storage silently leak forever? Does the app leak whether an e-mail address has an account through its own password-reset flow?

Entrelinhas is a real, three-service deployment (Vercel + Render + Supabase) I designed to answer "yes, I thought about that" to as many of those questions as I reasonably could, while still shipping a genuinely pleasant blog to read and write on — RBAC for three roles, threaded comments with reactions, a rich-text CMS, realtime notifications, and a password-recovery flow I added and load-tested against my own production Supabase project while working on this README (the [engineering decisions](#engineering-decisions-worth-calling-out) section below has the story).

## What it actually does

1. Anyone can read published posts, filter by category, follow an author or a category, and search full-text — no account required.
2. A registered **USER** can comment (with @mention replies), react 👍/👎 to comments, like/save posts, and follow authors/categories — every action triggers an aggregated, anti-flood notification to the recipient.
3. A **REDATOR** ("writer") gets `/admin` access to create, edit, and publish **their own** posts through a Tiptap-based rich-text editor with autosave and a live draft preview.
4. An **ADMIN** gets everything a REDATOR has, across every author's posts, plus category management and the power to promote/demote other users — except themself, on purpose.
5. Every account can review its own logged-in devices and revoke any one individually, or everywhere at once, from `/perfil`.
6. Forgetting a password doesn't require an account manually reset by an admin: `/recuperar-senha` triggers a real Supabase Auth (GoTrue) recovery e-mail, and `/redefinir-senha` consumes the one-time recovery token to set a new one.

---

## Features

### ✍️ CMS
- Tiptap rich-text editor: headings, lists, code blocks with syntax highlighting, image/video embeds (YouTube/Vimeo allow-listed), drag-and-drop and paste-to-upload.
- Autosave plus an explicit "save draft" / "publish" / "unpublish" state machine, with a live draft-preview route only the author (or an admin) can open.
- Auto-generated table of contents from the post's own heading structure, shown alongside the article.
- Every uploaded image is decoded and **re-encoded** to WebP server-side (see [Security model](#security-model)) — not just validated by file extension.

### 👥 Community
- Threaded comments with @mention replies, 👍/👎 reactions, a minimum interval between comments and a cap on links per comment (anti-spam).
- Likes, saves ("read later"), and follows — for both authors and categories.
- Full-text search (Postgres `tsvector` + `websearch_to_tsquery`, ranked by `ts_rank`) and a trending feed, both server-rendered.
- Realtime notification bell over Supabase Realtime (RLS-scoped to the recipient), with an automatic polling fallback if the anon key isn't configured on the frontend.

### 🔑 Auth & accounts
- Supabase Auth (GoTrue) under the hood, but the frontend never talks to it directly — every auth call is proxied through the NestJS API, so the anon/service-role keys never reach the browser for auth purposes.
- Refresh token in an `httpOnly`, `SameSite`-appropriate cookie scoped to `/api/v1/auth`; the access token lives only in memory on the client.
- Full password-recovery flow: `/auth/forgot-password` and `/auth/reset-password`, with the recovery token traveling in the request body — never as a `Bearer` header (see [why](#engineering-decisions-worth-calling-out)).
- Per-device session tracking, with individual or "everywhere" revocation, backed by a real session blacklist checked on every request.
- Self-service account deletion (LGPD) that re-verifies the password first and cleans up Storage files the database cascade can't reach.

### 🛡️ RBAC & admin tools
- Three roles — USER, REDATOR, ADMIN — enforced by a `RolesGuard` reading `@Roles()` metadata, not scattered `if (user.role === ...)` checks.
- Two independent anti-lockout rules: an admin can't change their own role, and the last remaining admin can't delete their own account.
- `/admin/usuarios`, `/admin/categorias`, and a posts list scoped by role (REDATOR sees only their own; ADMIN sees everyone's).

---

## Tech stack

| | |
|---|---|
| **NestJS 11 + Prisma 6** | Versioned REST API (`/api/v1`), RBAC guards, rate limiting, `class-validator` DTOs. |
| **Next.js 15 (App Router)** | Public site (SSR/ISR + SEO: sitemap, RSS, OG images) and the `/admin` CMS, same deployment. |
| **Supabase** | Postgres (via Prisma), Auth (GoTrue — the API's only client), Storage (`post-media`/`avatars` public buckets), Realtime (notifications). |
| **Tiptap** | The CMS's rich-text editor — headings, code blocks with `lowlight`, image/video embeds. |
| **Tailwind CSS 4** | Styling, with a hand-rolled dark mode (see [screenshots](#screenshots)). |
| **Jest** | Unit tests for the auth/RBAC surface — guards, the JWT strategy, the password-recovery service. |
| **pnpm workspaces** | Monorepo: `apps/api`, `apps/web`, `packages/shared` (types shared between both). |

---

## Architecture

Three separately-hosted services, wired together by env vars — no Supabase Edge Function or RLS-only access path; all reads/writes go through the NestJS API using the `service_role` key, with Postgres RLS enabled on every table as defense in depth.

```
┌─────────────┐        ┌──────────────────┐        ┌───────────────────────────┐
│   Vercel    │──HTTP─▶│      Render       │──SQL──▶│         Supabase          │
│  apps/web   │◀──────│     apps/api      │◀──────│  Postgres · Auth · Storage │
│ (Next.js)   │  JSON  │    (NestJS)       │        │  (post-media / avatars)   │
└─────────────┘        └──────────────────┘        └───────────────────────────┘
```

- **Supabase** is the data layer only: Postgres, Auth (GoTrue issues the JWTs the API verifies), and Storage. The frontend holds an anon key solely for the Realtime notification channel — every write, and every auth call, goes through the API.
- **Render** hosts `apps/api` as a long-running Node process (not serverless) — it needs in-memory rate-limit state and stable behavior for the refresh-token cookie.
- **Vercel** hosts `apps/web` — standard Next.js SSR/ISR for the public pages, client-rendered CMS under `/admin`.

---

## Engineering decisions worth calling out

**The password-recovery token never travels as a `Bearer` header.** Supabase's GoTrue issues a real, signed access token for its e-mail recovery flow — and that token would pass the API's own `JwtAuthGuard` like any normal session token would, since it's a legitimately signed JWT for a real user. Sending it as `Authorization: Bearer` would mean a leaked recovery link (forwarded by accident, sitting in a mail client) could authenticate as that user on *any* endpoint, not just the password change. The fix: `POST /auth/reset-password` takes the token as a plain field in the JSON body; the API forwards it to GoTrue's own `/user` endpoint for that one purpose and never attaches it to `req.user`.

**Two independent anti-lockout rules, not one.** `updateRole` refuses to let an admin change their own role; `deleteMe` separately refuses to let the last remaining admin delete their own account (it counts other admins first). Neither check depends on the other — an admin demoting themselves and an admin deleting themselves are different failure modes, and RBAC bugs are exactly the kind that are cheap to prevent and expensive to explain after the fact.

**Notifications collapse instead of flooding.** A `like` storm on a popular post doesn't create N rows — `NotificationsService.emit` looks for an *unread* notification of the same type/entity within a 24h window and, if one exists, bumps a counter and merges in the new actor (deduped, capped at 3 shown) instead of inserting a new row. The same actor liking/unliking/liking again doesn't inflate the counter, and nobody is ever notified of their own actions.

**Every uploaded image is decoded and re-encoded, not just "validated."** `sharp(buffer, { failOn: 'error', limitInputPixels: 40_000_000 }).rotate().resize(...).webp(...)` runs on every upload — cover images and avatars alike. This isn't a MIME-type check: decoding-then-re-encoding is what actually defeats a polyglot file (a valid JPEG that's also a valid something-else) and strips EXIF/GPS metadata, because the output bytes are freshly generated from decoded pixel data, not a copy of the input with a header swapped.

**Full-text search is real Postgres, not a `LIKE '%query%'`.** Posts carry a generated `search_vector` `tsvector` column; the search path uses `websearch_to_tsquery('portuguese', ...)` (so users can type natural queries, not tsquery syntax) ranked by `ts_rank`, as a raw parameterized query alongside the rest of the Prisma-based codebase — the one deliberate exception to "no raw SQL," because Prisma doesn't model `tsvector` operators.

**Storage cleanup is explicit, because the database cascade can't reach it.** Deleting a post cascades its rows in Postgres just fine, but the actual files in Supabase Storage (`post-media`) don't live in a foreign-key relationship with anything — they're objects in a bucket. Every path that removes or replaces a post, a cover image, or an avatar also explicitly calls `removeFileByPublicUrl`/`removeFiles` against Storage; account deletion collects every media path in a transaction *before* deleting the GoTrue user (whose cascade would otherwise take the DB rows pointing at those files with it).

**Dependency security is a process, not a one-time fix.** Making this repo public meant running `pnpm audit` for the first time in a while — it came back with 28 findings (20 high). Most were transitive dependencies of build-only tooling (`@nestjs/cli`, `prisma`'s CLI) that never run in the deployed process, fixed with `pnpm.overrides` scoped to the exact parent package (`"minimatch@3>brace-expansion"`, not a blanket `"brace-expansion"`) so a patch bump for one consumer couldn't silently force an incompatible major onto a different one still on an older `minimatch`. The ones that *did* matter — `sharp` (image re-encoding, described above), `sanitize-html` (an XSS advisory in the exact library sanitizing user-submitted post/comment HTML), and `next` itself (an SSRF in Server Actions) — got bumped directly. One (`@tiptap/core`, a moderate prototype-pollution advisory reachable only from the editor, which is REDATOR/ADMIN-gated) was deliberately left alone: fixing it meant a major-version jump across the entire Tiptap dependency tree, and a real migration belongs in its own change, not hidden inside a security patch.

---

## Security model

| Layer | How it's enforced |
|---|---|
| **Passwords & sessions** | Supabase Auth (hashing, refresh rotation with reuse detection). Access token lives only in browser memory; refresh token sits in an `httpOnly` cookie scoped to `/api/v1/auth`. |
| **Password recovery** | Token travels in the request body, never as `Bearer` — see [engineering decisions](#engineering-decisions-worth-calling-out). `forgot-password` always returns the same response regardless of whether the e-mail exists. |
| **Session revocation** | Every login is recorded (`user_sessions`); revoking one blacklists its `session_id` — the matching JWT is rejected on its very next request, and its refresh is blocked. |
| **RBAC** | `RolesGuard` on `@Roles()` metadata, not inline role checks. Two independent anti-lockout rules (self role-change, last-admin self-deletion) — see above. |
| **XSS** | Editor HTML goes through an allow-list (`sanitize-html`) server-side before storage; iframes restricted to YouTube/Vimeo; `javascript:` URLs and `on*` handlers stripped. Comments render as plain text through React, never `dangerouslySetInnerHTML`. |
| **SQL injection** | Prisma (parameterized queries) everywhere except the one raw, parameterized full-text search query — no string-concatenated SQL anywhere. |
| **Uploads** | Every image decoded and re-encoded to WebP (validates by actual pixel data, destroys polyglot payloads, strips EXIF/GPS). Orphaned Storage objects are explicitly deleted on replace/remove. |
| **CSRF** | Cookie-only routes (`refresh`, `logout`) are behind an `OriginCheckGuard` allow-listing `WEB_ORIGIN`; every other route requires a `Bearer` token a third-party site can't forge. |
| **Rate limiting** | 120 req/min global per IP; login/register/forgot-password/reset-password 5/min; comments 6/min; reactions/follows 30/min; uploads 20/min. |
| **Transport** | `helmet` + CSP, `trust proxy` for real client IPs behind Render, CORS locked to `WEB_ORIGIN`. |
| **Dependencies** | `pnpm audit` clean on every production-reachable package; the one accepted exception is documented, not silent (see above). |

---

## Project structure

```
apps/
├── api/                       # NestJS 11 + Prisma 6
│   ├── src/
│   │   ├── auth/               # login/register/refresh, password recovery, JWT strategy
│   │   ├── common/guards/      # RolesGuard, JwtAuthGuard, OriginCheckGuard
│   │   ├── posts/               # CRUD, full-text search, trending, related posts
│   │   ├── comments/             # threaded comments, reactions, anti-spam
│   │   ├── notifications/        # aggregated/anti-flood emission + Realtime
│   │   ├── media/                 # sharp re-encode pipeline (uploads)
│   │   ├── users/                  # profile, sessions, RBAC role updates, LGPD deletion
│   │   └── supabase/                # GoTrue REST client, Storage admin client
│   ├── prisma/migrations/
│   └── scripts/                # seed (admin + categories), content/cover seeders
│
├── web/                        # Next.js 15 (App Router)
│   ├── app/
│   │   ├── admin/               # CMS: posts, categories, users — role-gated client-side too
│   │   ├── (public routes)/       # /, /blog/[slug], /categoria/[slug], /autor/[username]
│   │   ├── login, registro/       # + recuperar-senha, redefinir-senha
│   │   └── perfil, notificacoes/
│   └── lib/                      # api client (auto session refresh), auth context, realtime
│
└── packages/shared/            # types/limits shared between api and web

docs/screenshots/              # everything embedded in this README
```

---

## Running it locally

```bash
pnpm install
```

### 1. Supabase keys

Copy `apps/api/.env.example` → `apps/api/.env` and `apps/web/.env.example` → `apps/web/.env.local`, then fill in the anon key, the `service_role` key (API only, never the frontend), and the pooled/direct Postgres connection strings from your Supabase project's dashboard.

```bash
pnpm --filter @blog/api run prisma:deploy
pnpm --filter @blog/api run seed     # storage buckets + first admin + categories
```

Set `SEED_ADMIN_EMAIL`/`SEED_ADMIN_PASSWORD` before seeding — without them the script falls back to a predictable dev-only password and prints a warning.

### 2. Run

```bash
pnpm dev          # API on :3001, web on :3000
pnpm dev:api      # Swagger docs at http://localhost:3001/api/docs
```

### 3. Tests

```bash
pnpm --filter @blog/api run test
```

---

## Deployment

Render (`apps/api`) and Vercel (`apps/web`) reference each other's URLs, so the practical order is: deploy the API, deploy the frontend pointing at it, then set `WEB_ORIGIN` on Render to the frontend's real URL. Until that last step, the frontend loads but every API call fails CORS.

A password-recovery link is built from `WEB_ORIGIN` and handed to Supabase as `redirect_to` — but GoTrue silently falls back to its own dashboard-configured **Site URL** if that address isn't also present in **Authentication → URL Configuration → Redirect URLs**. Both need to be set explicitly; it's a five-minute dashboard step this project's own deploy notes exist to not let me forget twice.

---

## Roadmap

Custom SMTP for Auth e-mails (Supabase's built-in mailer caps out at a handful of e-mails/hour — fine for development, not for real signup/recovery volume), Tiptap v3 migration (currently pinned to v2 across the whole dependency tree — see [engineering decisions](#engineering-decisions-worth-calling-out)), Turnstile/captcha on registration, dedicated comment moderation in the admin panel, data export (LGPD/GDPR).

---

## License

Released under the [MIT License](LICENSE) — © 2026 Luis Eduardo.

<div align="center">

Built by [@merino626](https://github.com/merino626).

</div>
