# RakshaLink — Women Safety Alert Platform

An emergency SOS system with live location sharing, a trusted-contact alert
network, and a few extra safety features (walk timer, shake/voice triggers,
quick exit, nearby police stations). Frontend is React + Vite; there's a
small Express backend for contacts, alert dispatch, and incident history.

## Project structure

```
women-safety-app/
├── src/                # React frontend
│   ├── api.js           # fetch wrapper, falls back to local-only mode if no backend
│   ├── context/          # global app state (contacts, SOS, settings, geolocation)
│   ├── components/       # Navbar, Hero, LiveMap (Leaflet), QuickExit, etc.
│   └── pages/             # Home, Dashboard, Contacts, SOS Center, Walk With Me, ...
├── server/               # Express backend
│   ├── index.js           # REST API
│   ├── db.js              # simple JSON file datastore (server/db.json, auto-created)
│   └── notify.js          # notification dispatch — mock by default, Twilio-ready
└── vite.config.js         # includes PWA plugin + dev proxy to the backend
```

## Running it

**Frontend only (offline/local mode — uses localStorage, no SMS dispatch):**
```bash
npm install
npm run dev
```

**Frontend + backend together (recommended):**
```bash
npm install
npm run dev:full
```
This starts the Vite dev server (port 5173) and the API (port 4000) together,
with `/api/*` requests proxied through to the backend automatically.

**Backend only:**
```bash
cd server
npm install
npm run dev
```

The frontend detects whether the backend is reachable on load (see the
"Server connected" / "Offline mode" badge in the navbar) and works fine
either way — it just keeps everything in the browser if there's no API.

## Going live with real SMS

By default, triggering an SOS alert just logs what *would* be sent to each
contact (`server/notify.js`, check your terminal output). To send real SMS:

1. `npm install twilio` inside `server/`
2. Set environment variables: `TWILIO_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER`
3. Uncomment the Twilio block in `server/notify.js`

Nothing else needs to change — the rest of the app just calls `notifyContact()`.

## PWA

The app is installable (manifest + service worker via `vite-plugin-pwa`).
Run `npm run build && npm run preview` and you should see an install prompt
in supported browsers. Map tiles (OpenStreetMap) are cached for offline use
once visited.

## Notes on the demo data

- `server/db.json` is created automatically on first run with a few sample
  contacts. Delete it to reset.
- The map uses OpenStreetMap tiles directly — no API key needed, but it's
  rate-limited for heavy production traffic. Swap the `TileLayer` URL in
  `src/components/LiveMap.jsx` for Mapbox/Maptiler if you outgrow it.
- Voice and shake triggers only work in browsers that support the relevant
  Web APIs (Web Speech API, DeviceMotion) and typically need HTTPS + a real
  mobile device to behave well — desktop Chrome over `http://localhost` is
  fine for development.
