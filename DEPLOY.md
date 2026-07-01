# RakshaLink — Complete Real-World Setup Guide

Follow this from top to bottom. By the end, real SMS alerts will fire,
GPS will be live, shake/voice will work on your phone, and the app will
be installable as a home screen app.

---

## Part 1 — Twilio (real SMS alerts)

### 1.1 Create a free account
1. Go to **https://www.twilio.com/try-twilio**
2. Sign up with your email
3. Verify your phone number (Twilio sends a code)

### 1.2 Get your credentials
1. Open **https://console.twilio.com**
2. From the dashboard, copy:
   - **Account SID** (starts with `AC...`)
   - **Auth Token** (click the eye icon to reveal)

### 1.3 Get a Twilio phone number
1. In the Twilio Console → **Phone Numbers → Manage → Buy a number**
2. Make sure it has **SMS capability** (tick the SMS checkbox)
3. Buy it — free trial credit covers this
4. Copy the number (e.g. `+12025551234`)

### 1.4 (Trial accounts only) Verify recipient numbers
Twilio trial accounts can only SMS **verified** numbers.
1. Go to **Console → Phone Numbers → Verified Caller IDs**
2. Add and verify every phone number that will receive alerts
   (i.e. all your trusted contacts' numbers)
3. This limit goes away when you upgrade to a paid account (~$20/mo)

### 1.5 Set the webhook for "SAFE" replies (optional but recommended)
1. Console → Phone Numbers → your number → **Configure**
2. Under "A message comes in", set:
   - Webhook URL: `https://your-domain.com/api/webhooks/twilio-reply`
   - HTTP method: POST
3. Save. Now when a contact replies "SAFE" to an alert, it logs in your history.

---

## Part 2 — Deploy the backend to a server

### Option A — Railway (easiest, free tier available)

1. Go to **https://railway.app** → New Project → Deploy from GitHub
2. Push your project to GitHub first:
   ```bash
   git init
   git add .
   git commit -m "initial commit"
   gh repo create raksha-link --public --push
   ```
3. In Railway, select your repo
4. Set the **Root Directory** to `server`
5. Set **Start Command** to `node index.js`
6. Add environment variables (Settings → Variables):
   ```
   TWILIO_SID          = ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
   TWILIO_AUTH_TOKEN   = your_auth_token_here
   TWILIO_FROM_NUMBER  = +1xxxxxxxxxx
   FRONTEND_URL        = https://your-frontend-domain.com
   PORT                = 4000
   ```
7. Railway gives you a URL like `https://raksha-link-api.railway.app` — copy it.

### Option B — Render (also free tier)

1. Go to **https://render.com** → New → Web Service
2. Connect your GitHub repo
3. Settings:
   - Root directory: `server`
   - Build command: `npm install`
   - Start command: `node index.js`
4. Add the same environment variables as above
5. Deploy — Render gives you `https://raksha-link-api.onrender.com`

### Option C — Your own VPS (DigitalOcean / Hetzner)

```bash
# SSH into your server
ssh root@your-server-ip

# Install Node 20
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs

# Clone your project
git clone https://github.com/you/raksha-link.git
cd raksha-link/server
npm install

# Create .env
nano .env
# Paste your Twilio credentials and FRONTEND_URL

# Install PM2 to keep it running
npm install -g pm2
pm2 start index.js --name raksha-api
pm2 save
pm2 startup   # follow the printed command to auto-start on reboot

# Open the port (if using ufw)
ufw allow 4000
```

---

## Part 3 — Deploy the frontend

### 3.1 Point the frontend at your real backend

Edit `src/api.js` — change the BASE url for production:

```js
const BASE = import.meta.env.VITE_API_URL || '/api';
```

Then create `server/.env` (frontend build env):
```
VITE_API_URL=https://your-backend-url.railway.app/api
```

### 3.2 Build
```bash
npm run build
# Output is in the dist/ folder
```

### Option A — Vercel (easiest for frontend)
```bash
npm install -g vercel
vercel --prod
```
Vercel auto-detects Vite. It'll ask for your project name and deploy.
Add `VITE_API_URL` in Vercel's Environment Variables dashboard.

### Option B — Netlify
```bash
npm install -g netlify-cli
netlify deploy --prod --dir dist
```

### Option C — Serve from your VPS (serves both frontend + backend)
```bash
# On your VPS, after running the backend
cd raksha-link
npm run build

# Install serve
npm install -g serve

# Serve the frontend on port 80
serve dist -l 80
# or use Nginx (see below)
```

### Nginx config (if using your own server)
```nginx
server {
    listen 80;
    server_name your-domain.com;

    # Frontend
    root /home/ubuntu/raksha-link/dist;
    index index.html;
    location / { try_files $uri $uri/ /index.html; }

    # Backend proxy
    location /api {
        proxy_pass http://localhost:4000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### HTTPS (required for GPS, voice, shake on phones)
```bash
apt install certbot python3-certbot-nginx
certbot --nginx -d your-domain.com
# Certbot auto-renews every 90 days
```

---

## Part 4 — Phone features (GPS, shake, voice)

These work automatically once the app is on HTTPS. Open your deployed URL on your phone.

### Enable GPS (continuous tracking)
1. Open the app → **Settings**
2. Click **"Start continuous watch"** → browser asks for location → tap **Allow**
3. You'll see coordinates update in real time

### Enable Shake-to-SOS
**Android:** Toggle it on in Settings — no extra step.

**iPhone:**
1. Open the app in **Safari** (not Chrome — iOS Chrome blocks DeviceMotion)
2. Go to Settings → tap **"Enable shake (grant motion access)"**
3. iOS shows a permission popup → tap **Allow**

### Enable Voice safe word
1. Settings → set your safe word (e.g. "help me now")
2. Toggle Voice on → browser asks for microphone → Allow
3. Works in Chrome on Android. On iPhone, use Safari.

### Install as home screen app (PWA)

**Android (Chrome):**
- Three dots menu → **Add to Home screen** → Add

**iPhone (Safari):**
- Share button → **Add to Home Screen** → Add

The app now appears on your home screen, runs fullscreen, and works offline.

---

## Part 5 — Test everything end-to-end

```bash
# 1. Is the backend running?
curl https://your-backend.railway.app/api/health
# Should return: {"ok":true,"twilio":true,...}

# 2. Test a real SMS alert
curl -X POST https://your-backend.railway.app/api/alerts/trigger \
  -H "Content-Type: application/json" \
  -d '{"lat":28.6139,"lng":77.2090,"locationLabel":"Test","triggeredBy":"test"}'
# All contacts should get an SMS within 5 seconds
```

### Checklist
- [ ] `curl /api/health` returns `"twilio":true`
- [ ] Test SMS arrives on a contact's phone
- [ ] App opens on phone browser at your HTTPS domain
- [ ] Location shows live coordinates in Settings
- [ ] SOS hold-button sends SMS + shows notified contacts
- [ ] PWA installs to home screen
- [ ] Shake trigger works (Android or Safari/iOS)
- [ ] Quick exit button navigates to the Notes decoy page

---

## Costs (approximate)

| Service | Free tier | After free tier |
|---------|-----------|-----------------|
| Twilio trial | $15 credit (~500 SMS) | ~$0.0075/SMS |
| Railway | $5/mo free credit | ~$5-10/mo |
| Vercel | Unlimited for personal | Free |
| Domain | — | ~$10/yr |
| **Total to run for real** | **$0 to start** | **~$15-20/mo** |

