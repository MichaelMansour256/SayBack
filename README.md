# SayBack — Hear it backwards. Say it back!

A mobile-first reverse-audio party game. Two or more players share one device:
Player A records a secret word, the app reverses it, Player B imitates the
reversed sound, the app reverses the imitation, everyone guesses, then reveal.
All audio stays on-device — no accounts, no uploads, no AI services.
## Quick start
Run: npm install; npm run dev (http://localhost:3000); npm test; npm run type-check; npm run build && npm start.
## Phone testing over HTTPS
Microphone requires a secure context. Deploy to Vercel (HTTPS by default), or tunnel localhost with ngrok/cloudflared and open the HTTPS URL on your phone. Grant mic permission when prompted.
## Deploy to Vercel
Import the repo in the Vercel dashboard or run vercel. No env vars needed. The service worker caches the app shell; recordings stay in memory only.
## Architecture
lib/audio.ts (recording/decoding/PCM reversal/playback), lib/game.ts (validated round state machine), components/game-provider.tsx (session glue), components/screens/* (UI), lib/storage.ts (IndexedDB settings + metadata only).
## Browser limitations
Mic needs HTTPS + gesture; format auto-detected; no background recording guarantee; double-reverse subject to codec artifacts.
## Tests
Automated via npm test (PCM reversal, double-reverse, stereo, empty-buffer, no double-record, no overlap playback, mic-denial message, retry safety, secret gating, invalid transitions). Manual device tests (Android + desktop) not performed here.