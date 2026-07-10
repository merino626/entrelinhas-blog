// Mantido em sincronia com packages/shared/src/index.ts (LIMITS).
// Duplicado aqui porque a API compila com tsc/CommonJS e o pacote shared
// é distribuído como TypeScript puro (consumível apenas como tipos).
export const LIMITS = {
  username: { min: 3, max: 24, pattern: /^[a-z0-9_]+$/ },
  displayName: { min: 2, max: 48 },
  bio: { max: 280 },
  password: { min: 10, max: 128 },
  postTitle: { min: 4, max: 140 },
  postExcerpt: { max: 300 },
  comment: { min: 1, max: 2000 },
  commentMaxLinks: 2,
  uploadImageMaxBytes: 5 * 1024 * 1024,
  avatarMaxBytes: 2 * 1024 * 1024,
  /** Intervalo mínimo entre comentários do mesmo usuário (anti-spam). */
  commentMinIntervalMs: 15_000,
} as const;

/** Usernames que não podem ser registrados. */
export const RESERVED_USERNAMES = new Set([
  'admin', 'administrador', 'root', 'suporte', 'support', 'api', 'blog',
  'sistema', 'system', 'moderador', 'mod', 'staff', 'oficial', 'official',
]);
