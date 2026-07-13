import type { NextConfig } from 'next';

const supabaseHost = (() => {
  try {
    return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://placeholder.supabase.co')
      .hostname;
  } catch {
    return 'placeholder.supabase.co';
  }
})();

// Em dev o Next.js usa eval (React Refresh/HMR) e WebSocket local —
// o CSP estrito vale só para produção, senão TODO o JS do cliente é bloqueado.
const isDev = process.env.NODE_ENV !== 'production';

const securityHeaders = [
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      // 'unsafe-inline' é exigido pela hidratação do Next; eval só em dev
      `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''}`,
      "style-src 'self' 'unsafe-inline'",
      "worker-src 'self' blob:",
      `img-src 'self' data: blob: https://${supabaseHost} https://img.youtube.com https://i.ytimg.com`,
      "font-src 'self'",
      `connect-src 'self' ${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'} https://${supabaseHost} wss://${supabaseHost}${
        isDev ? ' ws://localhost:3000 ws://127.0.0.1:3000' : ''
      }`,
      'frame-src https://www.youtube.com https://www.youtube-nocookie.com https://player.vimeo.com',
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join('; '),
  },
];

const nextConfig: NextConfig = {
  transpilePackages: ['@blog/shared'],
  images: {
    remotePatterns: [{ protocol: 'https', hostname: supabaseHost }],
  },
  async headers() {
    return [{ source: '/(.*)', headers: securityHeaders }];
  },
};

export default nextConfig;
