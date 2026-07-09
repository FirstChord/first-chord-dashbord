// Overrides the root manifest so this route installs as its own
// home-screen app ("FC Messages") separate from the planning app.
export const metadata = {
  manifest: '/manifest-messages.webmanifest',
  icons: {
    apple: '/fc-logo-square.png',
  },
  appleWebApp: {
    capable: true,
    title: 'Messages',
    statusBarStyle: 'default',
  },
};

export default function IncomingMessagesLayout({ children }) {
  return children;
}
