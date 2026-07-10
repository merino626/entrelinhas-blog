import type { Metadata } from 'next';
import { Inter, Fraunces } from 'next/font/google';
import { AuthProvider } from '@/lib/auth-context';
import { Navbar } from '@/components/navbar';
import { Footer } from '@/components/footer';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });
const fraunces = Fraunces({
  subsets: ['latin'],
  variable: '--font-fraunces',
  axes: ['SOFT', 'WONK', 'opsz'],
});

const SITE_NAME = 'Entrelinhas';

export const metadata: Metadata = {
  title: {
    default: `${SITE_NAME} — um blog feito com carinho`,
    template: `%s · ${SITE_NAME}`,
  },
  description:
    'Artigos sobre tecnologia, tutoriais e carreira — escritos com atenção aos detalhes.',
};

// Aplica o tema salvo ANTES da hidratação (evita flash de tema errado)
const themeScript = `
(function () {
  try {
    var stored = localStorage.getItem('theme');
    var dark = stored ? stored === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches;
    if (dark) document.documentElement.classList.add('dark');
  } catch (e) {}
})();
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className={`${inter.variable} ${fraunces.variable} font-sans`}>
        <AuthProvider>
          <div className="flex min-h-dvh flex-col">
            <Navbar />
            <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-20 pt-8 sm:px-6">
              {children}
            </main>
            <Footer />
          </div>
        </AuthProvider>
      </body>
    </html>
  );
}
