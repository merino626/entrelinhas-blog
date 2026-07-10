'use client';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { getToken } from './token-store';

let client: SupabaseClient | null = null;

/**
 * Cliente Supabase usado APENAS para o canal Realtime de notificações.
 * A RLS garante que o usuário só recebe eventos das próprias notificações.
 * Retorna null se a anon key não estiver configurada (fallback: polling).
 */
export function getRealtimeClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return null;

  client ??= createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const token = getToken();
  if (token) client.realtime.setAuth(token);
  return client;
}
