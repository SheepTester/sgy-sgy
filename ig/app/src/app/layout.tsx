import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const InterSans = Inter({
  variable: '--font-Inter-sans',
  subsets: ['latin']
})

export const metadata: Metadata = {
  title: 'free food events at ucsd',
  description: 'kitty kat'
}

export const viewport: Viewport = {
  themeColor: '#8E51FF'
}

export default function RootLayout ({
  children
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang='en'>
      <body className={`${InterSans.variable}`}>
        {children}
        <Analytics />
      </body>
    </html>
  )
}
