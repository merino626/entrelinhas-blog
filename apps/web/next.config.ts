import type { NextConfig } from 'next';

const supabaseHost = (() => {
  try {
    return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://placeholder.supabase.co')
      .hostname;
  } catch {
    return 'placeholder.supabase.co';
  }
})();

const securityHeaders = [
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      // Next.js precisa de inline para hidratação; sem eval em produção
      "script-src 'self' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline'",
      `img-src 'self' data: blob: https://${supabaseHost} https://img.youtube.com https://i.ytimg.com`,
      "font-src 'self'",
      `connect-src 'self' ${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'} https://${supabaseHost} wss://${supabaseHost}`,
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
