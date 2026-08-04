import './globals.css'

export const metadata = {
  title: {
    default: 'First Chord OS',
    template: '%s | First Chord OS',
  },
  description: 'First Chord internal operating dashboard',
  manifest: '/manifest.webmanifest',
  icons: {
    apple: '/fc-logo-square.png',
  },
  appleWebApp: {
    capable: true,
    title: 'Messages',
    statusBarStyle: 'default',
  },
}

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#f8fafc',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
