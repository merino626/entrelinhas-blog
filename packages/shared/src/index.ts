// Tipos compartilhados entre a API (NestJS) e o frontend (Next.js).
// Fonte única de verdade para enums e formatos de resposta.

export type Role = 'ADMIN' | 'REDATOR' | 'USER';

export type PostStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';

export type ReactionType = 'LIKE' | 'DISLIKE';

export type NotificationType =
  | 'POST_LIKE'
  | 'COMMENT_REPLY'
  | 'COMMENT_REACTION'
  | 'NEW_FOLLOWER'
  | 'FOLLOWED_AUTHOR_POST';

export interface PublicProfile {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  bio: string | null;
  role: Role;
  createdAt: string;
  followersCount?: number;
  followingCount?: number;
  postsCount?: number;
  isFollowedByMe?: boolean;
}

export interface CategorySummary {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  postsCount?: number;
  isFollowedByMe?: boolean;
}

export interface PostSummary {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  coverImageUrl: string | null;
  status: PostStatus;
  publishedAt: string | null;
  createdAt: string;
  readingTimeMin: number;
  viewCount: number;
  likesCount: number;
  commentsCount: number;
  author: Pick<PublicProfile, 'id' | 'username' | 'displayName' | 'avatarUrl'>;
  category: Pick<CategorySummary, 'id' | 'name' | 'slug'> | null;
  likedByMe?: boolean;
  savedByMe?: boolean;
}

export interface PostDetail extends PostSummary {
  contentHtml: string;
}

/** Post completo para edição no CMS (inclui o JSON do Tiptap). */
export interface PostEditable extends PostDetail {
  contentJson: unknown;
}

export interface CommentView {
  id: string;
  postId: string;
  content: string;
  createdAt: string;
  deleted: boolean;
  author: Pick<PublicProfile, 'id' | 'username' | 'displayName' | 'avatarUrl'> | null;
  parentCommentId: string | null;
  mentionedUser: Pick<PublicProfile, 'id' | 'username' | 'displayName'> | null;
  likesCount: number;
  dislikesCount: number;
  myReaction: ReactionType | null;
}

export interface NotificationView {
  id: string;
  type: NotificationType;
  entityType: 'POST' | 'COMMENT' | 'PROFILE';
  entityId: string;
  /** Últimos atores (máx. 3) para exibir "Fulano, Beltrano e mais N". */
  actors: Pick<PublicProfile, 'id' | 'username' | 'displayName' | 'avatarUrl'>[];
  aggregatedCount: number;
  isRead: boolean;
  lastEventAt: string;
  createdAt: string;
  /** Contexto para montar o link (ex.: slug do post). */
  meta: Record<string, string> | null;
}

export interface SessionView {
  id: string;
  userAgent: string | null;
  ip: string | null;
  createdAt: string;
  lastSeenAt: string;
  current: boolean;
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

export interface AuthTokens {
  accessToken: string;
  /** Epoch em segundos em que o access token expira. */
  expiresAt: number;
  user: PublicProfile;
}

export interface ApiError {
  statusCode: number;
  message: string | string[];
  error?: string;
}

// Limites compartilhados (validados no back, exibidos no front)
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
} as const;
