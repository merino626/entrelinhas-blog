-- Busca full-text em português: coluna tsvector gerada + índice GIN.
-- Pesos: A = título, B = resumo, C = conteúdo (HTML com tags removidas).
ALTER TABLE "posts" ADD COLUMN "search_vector" tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('portuguese', coalesce("title", '')), 'A') ||
    setweight(to_tsvector('portuguese', coalesce("excerpt", '')), 'B') ||
    setweight(to_tsvector('portuguese', regexp_replace(coalesce("content_html", ''), '<[^>]+>', ' ', 'g')), 'C')
  ) STORED;

CREATE INDEX "posts_search_vector_idx" ON "posts" USING GIN ("search_vector");
