import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'CarrinhoCerto',
  description: 'Organize a coleção de Hot Wheels e evite compras repetidas com um webapp moderno e offline-first.',
  applicationName: 'CarrinhoCerto',
  appleWebApp: {
    capable: true,
    title: 'CarrinhoCerto',
    statusBarStyle: 'black-translucent',
  },
};

export const viewport: Viewport = {
  themeColor: '#080b14',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body className={inter.className}>{children}</body>
    </html>
  );
}