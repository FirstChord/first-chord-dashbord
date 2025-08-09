# 🎵 First Chord Music School Dashboard

A modern, interactive dashboard for music tutors to manage students and view live lesson notes from MyMusicStaff (MMS). Built with Next.js and featuring seamless integration with music education platforms.

## ✨ Features

- **Live Lesson Notes** - Real-time integration with MyMusicStaff API
- **Automatic Token Management** - Seamless authentication with token interceptor
- **Student Management** - View and manage your students with real MMS data
- **Multi-Platform Integration** - Links to Soundslice, Theta Music, and parent portals
- **Offline Support** - Cached lesson notes when internet is unavailable
- **Setup Wizard** - Easy configuration for external services
- **Real-time Status** - Visual indicators for live vs cached data

## 🚀 Quick Setup (5 minutes)

### Requirements

- **Node.js** (version 18 or higher) - [Download here](https://nodejs.org/)
- **Git** (usually pre-installed on macOS)
- **Terminal access**

### Installation Steps

1. **Clone the repository:**

```bash
git clone https://github.com/FirstChord/first-chord-dashbord.git
cd first-chord-dashbord/music-school-dashboard
```

2. **Install dependencies:**

```bash
npm install
```

3. **Start the dashboard:**

```bash
npm run dev
```

4. **Open in browser:**

- Go to [http://localhost:3000](http://localhost:3000)
- Select "Finn" as tutor
- Done! 🎵

## 🔥 Live MMS Integration

For real-time lesson notes from MyMusicStaff:

1. **Open MyMusicStaff** in another browser tab
2. **Log in normally** - the dashboard automatically captures fresh tokens
3. **Return to dashboard** - you'll see live lesson notes instantly!

The token interceptor works automatically - no manual setup required.

## 📊 What's Included

- **Student Dashboard** - View all your students at a glance
- **Lesson Notes Panel** - Latest notes from MMS with attendance info
- **Quick Links** - Direct access to Soundslice, Theta Music, parent portals
- **Authentication Status** - Real-time connection indicators
- **Local Database** - SQLite database auto-creates from student data

## 🎯 Perfect for Music Schools

This dashboard is designed specifically for music tutors who use:

- **MyMusicStaff** for lesson management
- **Soundslice** for sheet music
- **Theta Music** for theory training
- Multiple students across different instruments

## 🛠️ Development

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
