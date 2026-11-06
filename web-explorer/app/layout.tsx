import type { Metadata, Viewport } from 'next'
import { Inter, JetBrains_Mono } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import { ThemeProvider } from '@/components/theme-provider'
import './globals.css'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains-mono',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'SolanaPilot Registry | Program Explorer',
  description:
    'Browse and explore Solana programs registered from the SolanaPilot VS Code extension on Solana devnet.',
  keywords: ['Solana', 'blockchain', 'smart contracts', 'programs', 'registry', 'devnet'],
  authors: [{ name: 'SolanaPilot' }],
  creator: 'SolanaPilot',
  publisher: 'solanapilot-dev',
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://solanapilot.dev',
    siteName: 'SolanaPilot Registry',
    title: 'SolanaPilot Registry | Program Explorer',
    description: 'Browse and explore Solana programs registered from the SolanaPilot extension.',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#F4F4F6' },
    { media: '(prefers-color-scheme: dark)', color: '#121214' },
  ],
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${inter.variable} ${jetbrainsMono.variable}`}
    >
      <body className="min-h-screen bg-bg text-text antialiased font-sans">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {children}
        </ThemeProvider>
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
