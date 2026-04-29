import type { Metadata, Viewport } from 'next';
import './globals.css';
import { Providers } from '../components/layout/providers';

export const metadata: Metadata = {
  title: {
    template: '%s | Zacoo',
    default: 'Zacoo — AI 캐릭터 채팅 플랫폼',
  },
  description: '좋아하는 캐릭터와 대화하고, 나만의 캐릭터를 만들어보세요. AI 기반 캐릭터 채팅 플랫폼.',
  keywords: ['AI 채팅', '캐릭터', '롤플레이', 'AI', '버추얼 캐릭터', 'Zacoo'],
  authors: [{ name: 'Zacoo' }],
  creator: 'Zacoo',
  openGraph: {
    type: 'website',
    locale: 'ko_KR',
    url: 'https://Zacoo.ai',
    siteName: 'Zacoo',
    title: 'Zacoo — AI 캐릭터 채팅 플랫폼',
    description: '좋아하는 캐릭터와 대화하세요.',
    images: [{ url: '/og-image.png', width: 1200, height: 630 }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Zacoo',
    description: '좋아하는 캐릭터와 대화하세요.',
  },
  manifest: '/manifest.json',
  icons: {
    icon: '/favicon.ico',
    apple: '/apple-touch-icon.png',
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: '#FFFFFF',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <body className="bg-background text-text-primary antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
