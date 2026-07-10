import sanitizeHtml from 'sanitize-html';

/**
 * Sanitização allow-list do HTML produzido pelo editor Tiptap.
 * Tudo que não estiver aqui é removido — inclusive <script>, handlers
 * on*, javascript: URLs e iframes fora dos players permitidos.
 */
const OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    'p', 'br', 'strong', 'em', 'u', 's', 'a', 'blockquote', 'code', 'pre',
    'h1', 'h2', 'h3', 'h4', 'ul', 'ol', 'li', 'hr',
    'img', 'figure', 'figcaption', 'iframe', 'span',
  ],
  allowedAttributes: {
    a: ['href', 'title'],
    img: ['src', 'alt', 'title', 'width', 'height', 'loading'],
    iframe: ['src', 'width', 'height', 'allowfullscreen', 'frameborder', 'allow', 'title'],
    code: ['class'],
    pre: ['class', 'spellcheck'],
    span: ['class'],
    ol: ['start'],
  },
  // Apenas classes de syntax highlight (language-*, hljs*) sobrevivem
  allowedClasses: {
    code: [/^language-/, /^hljs/],
    pre: [/^language-/, /^hljs/],
    span: [/^hljs/],
  },
  allowedSchemes: ['https', 'http', 'mailto'],
  allowedSchemesByTag: { img: ['https'] },
  allowProtocolRelative: false,
  allowedIframeHostnames: [
    'www.youtube.com',
    'www.youtube-nocookie.com',
    'player.vimeo.com',
  ],
  transformTags: {
    a: (tagName, attribs) => ({
      tagName,
      attribs: { ...attribs, rel: 'noopener noreferrer nofollow', target: '_blank' },
    }),
    img: (tagName, attribs) => ({
      tagName,
      attribs: { ...attribs, loading: 'lazy' },
    }),
  },
  disallowedTagsMode: 'discard',
};

export function sanitizePostHtml(dirty: string): string {
  return sanitizeHtml(dirty, OPTIONS);
}

/** Remove todas as tags (para excerpt/tempo de leitura). */
export function stripHtml(html: string): string {
  return sanitizeHtml(html, { allowedTags: [], allowedAttributes: {} })
    .replace(/\s+/g, ' ')
    .trim();
}

export function readingTimeMin(html: string): number {
  const words = stripHtml(html).split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}
