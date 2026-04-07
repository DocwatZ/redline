# <span style="color:#e53e3e">RED</span>LINE

<img src="public/favicon.svg" width="48" alt="REDLINE logo — R in red, L in white">

> **Privacy-first, self-hosted real-time communication platform**

Security via Obscurity — and by design.

---

## 🎯 What is REDLINE?

REDLINE is a production-ready, self-hosted communication platform built for teams and individuals who demand **absolute privacy** and **real-time performance**. Zero telemetry, zero third-party dependencies. Your data on your hardware.



### Core Features
- 💬 **Real-time text chat** via ActionCable (WebSockets)
- 🔊 **Voice & video calls** via LiveKit (WebRTC SFU)
- 📨 **Direct messages** between users
- 🏠 **Rooms** — public and private, text/voice/announcement types
- 👥 **Presence system** — online/away/busy/offline status
- 🔒 **Secure auth** — Devise with account locking + rate limiting
- 📱 **Progressive Web App** — installable, offline-capable
- ♿ **WCAG 2.1 AA accessible** — dark-first UI, skip nav, ARIA, keyboard nav

---

## 📸 Screenshots

### Sign In
![Sign In](docs/screenshots/login.png)

### Chat Room
![Chat Room](docs/screenshots/chat.png)

### Room Discovery
![Room Discovery](docs/screenshots/rooms.png)

---

## 🛠️ Technology Stack

| Layer | Technology |
|-------|-----------|
| Backend | Ruby on Rails 7.1 |
| Real-time | ActionCable + WebSockets |
| Media (WebRTC) | LiveKit SFU |
| Database | PostgreSQL 16 |
| Cache / PubSub | Redis 7 |
| Infrastructure | Docker Compose |
| Auth | Devise (bcrypt, lockable) |
| Rate limiting | Rack::Attack |
| Frontend | Hotwire (Turbo + Stimulus) |
| PWA | Service Worker + Web Manifest |

---

## 🚀 Quick Start (Docker)

```bash
# 1. Clone and configure
git clone https://github.com/DocwatZ/REDLINE.git
cd REDLINE
cp .env.example .env
# Edit .env — fill in SECRET_KEY_BASE, POSTGRES_PASSWORD, REDIS_PASSWORD, LIVEKIT keys

# 2. Generate a secret key
docker run --rm ruby:3.2-slim ruby -e "require 'securerandom'; puts SecureRandom.hex(64)"

# 3. Start everything
docker compose up -d

# 4. Open in browser
open http://localhost:3000
```

### Unraid users

If you are deploying on Unraid, use the dedicated guide:

- [Ultimate Unraid Setup Guide](Ultimate%20Unraid%20Setup%20Guide.md)

---

## ⚙️ Environment Variables

See `.env.example` for all required variables.

| Variable | Description |
|----------|-------------|
| `SECRET_KEY_BASE` | Rails secret key (generate with `rails secret`) |
| `DATABASE_URL` | PostgreSQL connection string |
| `REDIS_URL` | Redis connection string |
| `LIVEKIT_URL` | LiveKit server WebSocket URL |
| `LIVEKIT_API_KEY` | LiveKit API key |
| `LIVEKIT_API_SECRET` | LiveKit API secret |

---

## 🏗️ Architecture

```
Browser ──── Rails (Puma) ──── PostgreSQL
   │              │
   │         ActionCable ──── Redis (PubSub)
   │              │
 WebRTC ──── LiveKit SFU ──── TURN Server
```

---

## ♿ Accessibility

REDLINE is built **accessibility-first**:

- **Dark mode by default** with WCAG 2.1 AA+ contrast ratios (text ≥ 4.5:1)
- **Skip navigation** link (first focusable element on every page)
- **ARIA labels** on all interactive elements
- **Keyboard navigable** — full Tab/Enter/Escape support
- **Screen reader** compatible — role="log" for chat, aria-live regions
- **44×44px minimum** touch targets for all buttons (WCAG 2.5.5)
- **Focus-visible** rings on all interactive elements
- **Reduced motion** support via prefers-reduced-motion

---

## 🔒 Security

- Minimum 12-character passwords enforced
- Account locking after 10 failed attempts (email unlock)
- Rate limiting on auth endpoints via Rack::Attack
- CSRF protection on all forms
- Non-root Docker container
- All secrets via environment variables (never in code)

---

## 🏠 Self-Hosting (Unraid / TrueNAS)

1. Deploy using the included `docker-compose.yml`
2. Reverse proxy with NGINX or Traefik for HTTPS/WSS
3. **Deploy a TURN server** for reliable voice/video outside your LAN — most users will need this
4. Configure LiveKit with STUN/TURN for external call reliability (see `livekit.yaml`)
5. Unraid-specific end-to-end instructions: [Ultimate Unraid Setup Guide](Ultimate%20Unraid%20Setup%20Guide.md)

### ⚠️ Updating REDLINE — Always Rebuild the Image

REDLINE's JavaScript is served via Rails importmap (ES modules, no bundler). Asset fingerprints are baked into the Docker image during `assets:precompile` at build time.

**After every `git pull`, you must rebuild the image** — a simple container restart is not enough:

```bash
git pull
docker compose down
docker compose build --no-cache
docker compose up -d
docker exec -it redline-web bin/rails db:migrate
```

> Running `docker compose up -d` without `build` will reuse the old image and serve stale JavaScript.
> This causes features that depend on JavaScript (link previews, real-time chat, form submission) to silently stop working even though the Rails server responds normally.

#### For contributors

JavaScript modules use bare module specifiers (e.g. `import consumer from "channels/consumer"`) so that the importmap resolves them to the correct fingerprinted asset URLs. **Do not use relative imports** (e.g. `./consumer`) inside `app/javascript/` — the browser resolves relative imports from the fingerprinted file URL, not via the importmap, resulting in a 404 that silently breaks all JavaScript.

### ⚠️ Voice/Video Outside Your LAN Requires TURN

WebRTC (LiveKit) relies on direct peer or SFU connections. Users behind strict NAT or typical home/office routers will experience voice/video failures without a TURN relay server.

**Recommended for Unraid:** install [`ich777/stun-turn-server`](https://hub.docker.com/r/ich777/stun-turn-server) from Community Apps, then configure LiveKit to use it. See the [Ultimate Unraid Setup Guide](Ultimate%20Unraid%20Setup%20Guide.md) — specifically the **TURN Server Setup** section — for full step-by-step instructions.

---

## 📄 License

REDLINE is open-source software.
