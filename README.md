# BeatGrid

**BeatGrid** is a browser-based rhythm game where players say a word on beat, keep the flow, and share the result. It combines a React/Vite frontend, a custom canvas-based gameplay loop, built-in recording, multilingual SEO prerendering, and AI-generated sprite sheets powered by Google Gemini. 

**Live demo:** https://beat.boton.one

## Features

- Rhythm-based word gameplay built around 4 custom words.
- Custom canvas rendering and timed game loop synced to audio.
- AI-generated 2x2 sprite sheets based on player word input.
- Built-in gameplay recording and share flow from the browser.
- Internationalization across 15 supported languages, including RTL support for Arabic.
- PWA support with offline caching via Workbox.
- SEO-friendly localized prerendering for public routes.

## Tech stack

### Frontend
- React 19
- TypeScript
- Vite 8
- React Router 7
- i18next + react-i18next
- Tailwind CSS 4
- Custom Canvas renderer

### Backend
- Express 5
- `@google/genai`
- `@google-cloud/storage`
- Sharp
- Pino, Helmet, Morgan, CORS, compression, rate limiting

### Tooling
- Vitest
- Testing Library
- ESLint
- Docker
- Google Cloud Build

## Project structure

```text
app/                    # App bootstrap and route composition
features/game/          # Main gameplay feature
  application/          # Orchestration hooks and game flow
  domain/               # Core engine and timeline logic
  hooks/                # Feature hooks
  model/                # Constants, presets, and types
  recording/            # Recording service and media flow
  rendering/            # Canvas renderer
  spritesheet/          # Gemini image generation service
  ui/                   # UI components
i18n/                   # Localization config and locale dictionaries
public/                 # Static public assets
scripts/                # Build/prerender scripts
server/                 # Express server and SEO/runtime middleware
shared/                 # Shared config, UI and i18n helpers
```

## Requirements

- Node.js `24.15.0`
- pnpm
- Google Gemini API key and Google Cloud Storage bucket for AI sprite generation

## Installation

```bash
git clone https://github.com/kvkdsg/Beatgrid.git
cd Beatgrid
corepack enable
pnpm install
```

## Environment variables

Create a `.env` file in the project root:

```env
GEMINIAPIKEY=your_gemini_api_key
GCSBUCKETNAME=your_gcs_bucket_name
BASEURL=http://localhost:8080
PORT=8080
LOGLEVEL=info
TRUSTPROXY=1
```

## Available scripts

```bash
pnpm dev            # Start Vite dev server
pnpm build          # TypeScript compile + production build
pnpm prerender      # Generate localized prerendered HTML
pnpm preview        # Preview Vite build locally
pnpm start          # Start production Express server
pnpm lint           # Run ESLint
pnpm typecheck      # Run TypeScript checks
pnpm test           # Run tests
pnpm test:coverage  # Run tests with coverage
```

## Development

Start the local frontend server:

```bash
pnpm dev
```

The Vite dev server runs on `http://localhost:3000` by default.

## Production

Build the project:

```bash
pnpm build
```

This runs the application build and then prerenders localized HTML into `dist/`.

Start the production server:

```bash
pnpm start
```

## Testing

BeatGrid uses Vitest and Testing Library for unit and integration tests.

```bash
pnpm test
pnpm test:coverage
```

## Docker

```bash
docker build -t beatgrid .
docker run -p 8080:8080 --env-file .env beatgrid
```

## Internationalization

Supported locales:

- en
- es
- pt-BR
- fr
- de
- it
- tr
- id
- th
- vi
- ru
- ar
- ja
- ko
- zh-Hans

## Deployment notes

The repository includes:
- a production Dockerfile,
- Google Cloud Build configuration,
- prerendering scripts for localized SEO pages,
- PWA manifest and service worker generation.

## Contributing

Contributions, issues, and ideas are welcome. For non-trivial changes, open an issue first to discuss the proposal before submitting a pull request.

## License

This repository is licensed under the MIT License. See `LICENSE`.

## Brand and assets

The source code is provided under the MIT License. Unless explicitly stated otherwise, the BeatGrid name, branding, domain references, and certain media/assets may remain subject to separate rights and are not automatically granted for unrestricted commercial reuse.