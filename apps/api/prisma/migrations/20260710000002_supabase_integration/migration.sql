-- ─────────────────────────────────────────────────────────────────────────────
-- Integração com Supabase Auth: FK, trigger de criação de perfil, RLS, Realtime
-- ─────────────────────────────────────────────────────────────────────────────

-- FK: perfil pertence a um usuário do Supabase Auth (cascata na exclusão da conta)
ALTER TABLE "public"."profiles"
  ADD CONSTRAINT "profiles_id_auth_users_fkey"
  FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;

-- Trigger: cria o profile automaticamente quando um usuário se registra.
-- Resolve colisão de username com sufixo numérico.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  base_username text;
  final_username text;
  n int := 0;
BEGIN
  base_username := lower(coalesce(nullif(new.raw_user_meta_data->>'username', ''), 'user_' || substr(new.id::text, 1, 8)));
  base_username := regexp_replace(base_username, '[^a-z0-9_]', '', 'g');
  IF length(base_username) < 3 THEN
    base_username := 'user_' || substr(new.id::text, 1, 8);
  END IF;
  final_username := base_username;
  WHILE EXISTS (SELECT 1 FROM public.profiles WHERE username = final_username) LOOP
    n := n + 1;
    final_username := base_username || n::text;
  END LOOP;

  INSERT INTO public.profiles (id, username, display_name)
  VALUES (
    new.id,
    final_username,
    coalesce(nullif(new.raw_user_meta_data->>'display_name', ''), 'Usuário')
  );
  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ─────────────────────────────────────────────────────────────────────────────
-- RLS (defesa em profundidade): habilita em TODAS as tabelas public.
-- A API NestJS conecta como owner (postgres) e não é afetada; os roles
-- anon/authenticated ficam negados por padrão, exceto onde há policy explícita.
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE "public"."profiles"          ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."categories"        ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."posts"             ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."post_media"        ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."post_likes"        ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."post_saves"        ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."comments"          ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."comment_reactions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."author_follows"    ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."category_follows"  ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."notifications"     ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."user_sessions"     ENABLE ROW LEVEL SECURITY;

-- Única leitura direta do front no Postgres: Realtime de notificações próprias
GRANT SELECT ON "public"."notifications" TO authenticated;
CREATE POLICY "notifications_select_own" ON "public"."notifications"
  FOR SELECT TO authenticated
  USING (auth.uid() = recipient_id);

-- Publica a tabela no canal Realtime do Supabase (guardado contra duplicidade)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime')
     AND NOT EXISTS (
       SELECT 1 FROM pg_publication_tables
       WHERE pubname = 'supabase_realtime'
         AND schemaname = 'public' AND tablename = 'notifications'
     )
  THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
  END IF;
END $$;
