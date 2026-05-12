import type { Metadata, Viewport } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import './globals.css'

const geist = Geist({ 
  subsets: ["latin"],
  variable: '--font-geist-sans',
});
const geistMono = Geist_Mono({ 
  subsets: ["latin"],
  variable: '--font-geist-mono',
});

export const metadata: Metadata = {
  title: 'SolanaPilot Registry | Decentralized Program Explorer',
  description: 'Browse and explore Solana programs registered from the SolanaPilot VS Code extension. View metadata, deployment activity, and program details on Solana devnet.',
  keywords: ['Solana', 'blockchain', 'smart contracts', 'programs', 'registry', 'DeFi', 'Web3', 'devnet'],
  authors: [{ name: 'SolanaPilot' }],
  creator: 'SolanaPilot',
  publisher: 'SolanaPilot',
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://solanapilot.dev',
    siteName: 'SolanaPilot Registry',
    title: 'SolanaPilot Registry | Decentralized Program Explorer',
    description: 'Browse and explore Solana programs registered from the SolanaPilot VS Code extension.',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'SolanaPilot Registry',
    description: 'Decentralized program indexing for Solana devnet',
  },
  robots: {
    index: true,
    follow: true,
  },
}

export const viewport: Viewport = {
  themeColor: '#0a0a0a',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className={`${geist.variable} ${geistMono.variable} bg-background`}>
      <body className="font-sans antialiased min-h-screen">
        {children}
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
