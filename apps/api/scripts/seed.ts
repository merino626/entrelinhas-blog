/**
 * Seed inicial — roda com: pnpm --filter @blog/api run seed
 *
 * Requer no .env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, DATABASE_URL.
 * Idempotente: pode rodar mais de uma vez sem duplicar nada.
 *
 * 1. Cria os buckets públicos de storage (post-media, avatars)
 * 2. Cria o primeiro usuário ADMIN (e-mail/senha via env ou padrão de dev)
 * 3. Cria categorias iniciais
 */
import { createClient } from '@supabase/supabase-js';
import { PrismaClient } from '@prisma/client';
import * as fs from 'node:fs';
import * as path from 'node:path';

// Carrega .env manualmente (sem dependência de dotenv)
const envPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*"?([^"]*)"?\s*$/);
    if (match && process.env[match[1]] === undefined) {
      process.env[match[1]] = match[2];
    }
  }
}

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL ?? 'admin@example.com';
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? 'TroqueEstaSenha123';
const ADMIN_USERNAME = process.env.SEED_ADMIN_USERNAME ?? 'fundador';

async function main() {
  if (!SUPABASE_URL || !SERVICE_KEY) {
    console.error('Preencha SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no apps/api/.env');
    process.exit(1);
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const prisma = new PrismaClient();

  // 1. Buckets públicos
  for (const bucket of ['post-media', 'avatars']) {
    const { error } = await supabase.storage.createBucket(bucket, {
      public: true,
      fileSizeLimit: 6 * 1024 * 1024,
      allowedMimeTypes: ['image/webp'],
    });
    if (error && !/already exists/i.test(error.message)) {
      console.error(`Erro criando bucket ${bucket}:`, error.message);
      process.exit(1);
    }
    console.log(`✓ bucket ${bucket}`);
  }

  // 2. Primeiro admin
  const { data: created, error: userErr } = await supabase.auth.admin.createUser({
    email: ADMIN_EMAIL,
    password: ADMIN_PASSWORD,
    email_confirm: true,
    user_metadata: { username: ADMIN_USERNAME, display_name: 'Fundador' },
  });

  let adminId = created?.user?.id;
  if (userErr) {
    if (/already/i.test(userErr.message)) {
      const existing = await prisma.profile.findUnique({ where: { username: ADMIN_USERNAME } });
      adminId = existing?.id;
      console.log('✓ admin já existia');
    } else {
      console.error('Erro criando admin:', userErr.message);
      process.exit(1);
    }
  }
  if (adminId) {
    await prisma.profile.update({ where: { id: adminId }, data: { role: 'ADMIN' } });
    console.log(`✓ admin ${ADMIN_EMAIL} (username: ${ADMIN_USERNAME}) com papel ADMIN`);
    if (!process.env.SEED_ADMIN_PASSWORD) {
      console.log('  ⚠ Senha padrão de desenvolvimento em uso — TROQUE em produção.');
    }
  }

  // 3. Categorias iniciais
  const categories = [
    { name: 'Tecnologia', slug: 'tecnologia', description: 'Programação, ferramentas e novidades técnicas.' },
    { name: 'Tutoriais', slug: 'tutoriais', description: 'Guias passo a passo.' },
    { name: 'Carreira', slug: 'carreira', description: 'Crescimento profissional e mercado.' },
  ];
  for (const c of categories) {
    await prisma.category.upsert({
      where: { slug: c.slug },
      create: c,
      update: {},
    });
    console.log(`✓ categoria ${c.name}`);
  }

  await prisma.$disconnect();
  console.log('\nSeed concluído.');
}

void main();
