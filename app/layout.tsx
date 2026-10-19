import type { Metadata } from 'next';
import { SWRegistration } from '@/components/sw-registration';
import './globals.css';

export const metadata: Metadata = {
  title: 'SayBack — Hear it backwards. Say it back!',
  description: 'A mobile-first reverse-audio party game. Record, reverse, imitate, guess.',
  icons: [
    { rel: 'icon', type: 'image/png', sizes: '32x32', url: '/icons/favicon-32x32.svg' },
    { rel: 'icon', type: 'image/png', sizes: '16x16', url: '/icons/favicon-16x16.svg' },
    { rel: 'apple-touch-icon', sizes: '180x180', url: '/icons/apple-touch-icon.svg' },
  ],
  openGraph: {
    title: 'SayBack',
    description: 'Hear it backwards. Say it back!',
    type: 'website',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="scroll-smooth">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="theme-color" content="#0f172a" />
        <link rel="manifest" href="/manifest.json" />
      </head>
      <body className="min-h-screen">
        <SWRegistration />
        {children}
      </body>
    </html>
  );
}
