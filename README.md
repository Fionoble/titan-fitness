# Titan Fitness

A privacy-first AI-powered workout companion built as a Progressive Web App. Titan generates personalized workouts based on your available equipment, tracks your progress, and provides an AI coach for real-time guidance — all with your data stored locally on your device.

**Live app: [titan.fio.dev](https://titan.fio.dev)**

> 🌱 **A personal project.** Titan is just one of a handful of small PWAs I build for myself to help with everyday life — not a commercial product, just my own everyday tools.

## Features

- **AI-generated workouts** — Get daily workouts or full 7-day programs tailored to your equipment and preferences
- **Equipment-aware** — Only suggests exercises you can actually do with the gear you have
- **Active workout tracking** — Log sets, reps, and weight in real-time with rest timers and count-in countdowns
- **Program mode** — Generate structured weekly programs with configurable active days and built-in rest days
- **AI Coach** — Chat with Titan AI for exercise modifications, injury accommodations, and workout advice
- **Nutrition tracking** — Log meals via barcode scan, AI recognition, or manual entry
- **Progress tracking** — Volume charts, consistency rings, calendar view, and workout history
- **Privacy-first** — All data stays on your device in IndexedDB. No accounts, no server-side storage
- **Installable PWA** — Add to your home screen for a native app experience on iOS and Android

## Tech Stack

- **UI**: [Preact](https://preactjs.com/) + TypeScript
- **Styling**: [Tailwind CSS](https://tailwindcss.com/) v4
- **Build**: [Vite](https://vite.dev/)
- **Package manager**: [pnpm](https://pnpm.io/)
- **Data**: IndexedDB via [idb](https://github.com/nicedoc/idb)
- **PWA**: [vite-plugin-pwa](https://vite-pwa-org.netlify.app/) + Workbox
- **AI**: Anthropic Claude / OpenAI (user provides their own API key)

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v18+)
- [pnpm](https://pnpm.io/) (v10+)

### Setup

```bash
git clone https://github.com/Fionoble/titan-fitness.git
cd titan-fitness
pnpm install
```

### Development

```bash
pnpm dev
```

This starts the Vite dev server at `http://localhost:5173`.

### Build

```bash
pnpm build
```

### Preview production build

```bash
pnpm preview
```

## Using Titan

Titan is available as a PWA at **[titan.fio.dev](https://titan.fio.dev)**.

### Install on your phone

**iOS (Safari)**
1. Open [titan.fio.dev](https://titan.fio.dev) in Safari
2. Tap the Share button
3. Tap **Add to Home Screen**

**Android (Chrome)**
1. Open [titan.fio.dev](https://titan.fio.dev) in Chrome
2. Tap the menu (three dots)
3. Tap **Add to Home Screen** or **Install app**

### Setup

1. Go to **Profile** and set your name
2. Go to **Equipment** and toggle the gear you have access to
3. To use AI features (workout generation, AI coach, nutrition scanning), add your API key in **Profile > AI Settings**. Supports Anthropic (Claude) and OpenAI keys.

### Workout modes

- **Daily mode** — Generates a fresh workout each day based on your equipment
- **Program mode** — Generates a structured 7-day program. Configure how many active days you want (3-6) in your profile settings

## Contributing

Contributions are welcome! Please follow these guidelines:

1. **Fork the repo** and create your branch from `main`
2. **All changes must be submitted as pull requests** — direct pushes to `main` are not accepted
3. **PRs must be reviewed and tested** before merging
4. Make sure your changes build without errors (`pnpm build`)
5. Keep PRs focused — one feature or fix per PR
6. Write clear commit messages that explain *why*, not just *what*

### Opening a PR

```bash
git checkout -b my-feature
# make your changes
git add <files>
git commit -m "Add my feature"
git push -u origin my-feature
```

Then open a pull request against `main` on [GitHub](https://github.com/Fionoble/titan-fitness/pulls).

## License

ISC
