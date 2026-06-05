export default function manifest() {
  return {
    name: 'First Chord OS',
    short_name: 'First Chord',
    description: 'First Chord internal operating dashboard',
    start_url: '/admin/planning',
    scope: '/admin',
    display: 'standalone',
    background_color: '#f8fafc',
    theme_color: '#f8fafc',
    icons: [
      {
        src: '/first-chord-banner.png',
        sizes: '512x512',
        type: 'image/png',
      },
    ],
  };
}
