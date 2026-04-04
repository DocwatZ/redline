# Ultimate Unraid Setup Guide

This is the end-to-end REDLINE deployment guide for Unraid users.

It covers:

- Unraid UI steps
- Unraid CLI steps
- Docker Compose deployment
- Docker service and storage planning
- LiveKit and reverse proxy requirements
- **TURN server setup for external voice/video** (ich777/stun-turn-server)
- First-run verification
- Admin promotion
- Guidance for porting REDLINE to Unraid Community Apps

> Screenshots are intentionally omitted for now so this guide can be validated first and then expanded with visual callouts later.

---

## 1. What this guide deploys

A working REDLINE server on Unraid includes these services:

| Service | Purpose | Default internal name |
| --- | --- | --- |
| Rails web app | Main REDLINE UI and API | `web` |
| PostgreSQL | Primary database | `db` |
| Redis | ActionCable/pub-sub/cache | `redis` |
| LiveKit | Voice/video backend | `livekit` |
| TURN server | WebRTC relay for external users | `turn` (recommended) |

REDLINE also expects:

- a valid `SECRET_KEY_BASE`
- matching LiveKit credentials in both `.env` and `livekit.yaml`
- persistent storage for PostgreSQL, Redis, Rails storage, and LiveKit config
- HTTPS and WebSocket support when accessed outside your LAN

---

## 2. Before you start

### Required prerequisites

You should have all of the following before you begin:

1. **A working Unraid server**
   - Docker enabled in Unraid
   - Sufficient free storage in your cache/appdata location
   - Terminal access through the Unraid web terminal or SSH
2. **A static LAN IP for Unraid**
3. **A DNS name** if you want remote access
4. **A reverse proxy** for HTTPS/WSS if you want secure external access
5. **Basic Unraid permissions to create shares, folders, and containers**

### Recommended Unraid setup

In the Unraid UI:

1. Go to **Settings → Docker**.
2. Confirm **Enable Docker** is set to **Yes**.
3. Confirm your **Docker vDisk** or **Docker directory** is healthy and has free space.
4. Make sure your **appdata** share exists.
5. Make sure the **Terminal** button works, or that SSH access is enabled.

Optional but strongly recommended:

- Community Applications plugin
- A reverse proxy stack such as NGINX Proxy Manager, Traefik, or SWAG
- A TURN-capable public setup for better voice/video reliability outside your LAN — see [Section 9: TURN Server Setup](#9-turn-server-setup-ich777stun-turn-server) for the recommended approach using `ich777/stun-turn-server`

---

## 3. Ports you need to understand

| Port | Service | Required? | Notes |
| --- | --- | --- | --- |
| `3000` | REDLINE web app | Yes | Main HTTP service before proxying |
| `7880` | LiveKit HTTP/WebSocket | Yes | Client signaling and health reachability |
| `7881` | LiveKit RTC TCP | Recommended | Useful for clients that cannot use UDP |
| `7882/udp` | LiveKit RTC UDP | Yes | Best media performance |
| `3478/udp+tcp` | TURN/STUN (coturn) | Recommended | Standard STUN/TURN port — needed for external voice/video |
| `5349/udp+tcp` | TURNS (TURN over TLS) | Recommended | Encrypted TURN — preferred for browser clients |
| `49152–65535/udp` | TURN relay range | Recommended | Per-session relay ports allocated by coturn |

If you use a reverse proxy:

- external users should normally reach REDLINE through **HTTPS 443**
- your proxy must support **WebSockets**
- your proxy should forward requests for:
  - the REDLINE app
  - `/cable` WebSocket traffic
  - LiveKit WebSocket traffic if LiveKit is exposed externally

---

## 4. Recommended Unraid folder layout

Use persistent bind mounts under `appdata` instead of Docker named volumes. That keeps REDLINE aligned with common Unraid backup and restore workflows.

Recommended layout:

```text
/mnt/user/appdata/redline/
├── compose/
│   ├── docker-compose.yml
│   ├── .env
│   └── livekit.yaml
├── postgres/
├── redis/
└── storage/
```

You can create it in the Unraid CLI with:

```bash
mkdir -p /mnt/user/appdata/redline/compose
mkdir -p /mnt/user/appdata/redline/postgres
mkdir -p /mnt/user/appdata/redline/redis
mkdir -p /mnt/user/appdata/redline/storage
```

---

## 5. Prepare the REDLINE stack files

### Option A: Unraid CLI

Open the Unraid terminal and run:

```bash
cd /mnt/user/appdata/redline
git clone https://github.com/DocwatZ/REDLINE.git source
cp source/.env.example compose/.env
cp source/livekit.yaml compose/livekit.yaml
cp source/docker-compose.yml compose/docker-compose.yml
```

### Option B: Unraid file manager / share workflow

If you prefer using shares in the UI:

1. Create the `/mnt/user/appdata/redline/` folders first.
2. Download the REDLINE repository on another system.
3. Copy these files into `/mnt/user/appdata/redline/compose/`:
   - `docker-compose.yml`
   - `.env.example` renamed to `.env`
   - `livekit.yaml`

The CLI route is easier and less error-prone.

---

## 6. Make the Compose file Unraid-friendly

The repository Compose file uses Docker named volumes. On Unraid, bind mounts are easier to manage and back up.

Edit `/mnt/user/appdata/redline/compose/docker-compose.yml` and use this version:

> The `web` build context below depends on the repository being cloned to `/mnt/user/appdata/redline/source` in section 5.

```yaml
services:
  db:
    image: postgres:16-alpine
    container_name: redline-db
    restart: unless-stopped
    environment:
      POSTGRES_DB: ${POSTGRES_DB:-redline}
      POSTGRES_USER: ${POSTGRES_USER:-redline}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:?POSTGRES_PASSWORD is required}
    volumes:
      - /mnt/user/appdata/redline/postgres:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER:-redline}"]
      interval: 10s
      timeout: 5s
      retries: 5
    networks:
      - redline

  redis:
    image: redis:7-alpine
    container_name: redline-redis
    restart: unless-stopped
    command: redis-server --requirepass ${REDIS_PASSWORD:?REDIS_PASSWORD is required}
    volumes:
      - /mnt/user/appdata/redline/redis:/data
    healthcheck:
      test: ["CMD", "redis-cli", "--pass", "${REDIS_PASSWORD}", "ping"]
      interval: 10s
      timeout: 3s
      retries: 5
    networks:
      - redline

  web:
    build:
      context: /mnt/user/appdata/redline/source
      dockerfile: Dockerfile
    container_name: redline-web
    restart: unless-stopped
    depends_on:
      db:
        condition: service_healthy
      redis:
        condition: service_healthy
    environment:
      RAILS_ENV: production
      RAILS_LOG_TO_STDOUT: "true"
      SECRET_KEY_BASE: ${SECRET_KEY_BASE:?SECRET_KEY_BASE is required}
      DATABASE_URL: postgresql://${POSTGRES_USER:-redline}:${POSTGRES_PASSWORD}@db/${POSTGRES_DB:-redline}
      REDIS_URL: redis://:${REDIS_PASSWORD}@redis:6379/0
      LIVEKIT_URL: ${LIVEKIT_URL:?LIVEKIT_URL is required}
      LIVEKIT_API_KEY: ${LIVEKIT_API_KEY}
      LIVEKIT_API_SECRET: ${LIVEKIT_API_SECRET}
      DEVISE_MAILER_FROM: ${DEVISE_MAILER_FROM:-redline@localhost}
    ports:
      - "${PORT:-3000}:3000"
    volumes:
      - /mnt/user/appdata/redline/storage:/rails/storage
    command: >
      bash -c "bundle exec rails db:prepare &&
               bundle exec rails assets:precompile &&
               bundle exec rails server -b 0.0.0.0 -p 3000"
    networks:
      - redline

  livekit:
    image: livekit/livekit-server:latest
    container_name: redline-livekit
    restart: unless-stopped
    command: --config /etc/livekit.yaml
    environment:
      LIVEKIT_CONFIG: /etc/livekit.yaml
    volumes:
      - /mnt/user/appdata/redline/compose/livekit.yaml:/etc/livekit.yaml:ro
    ports:
      - "7880:7880"
      - "7881:7881"
      - "7882:7882/udp"
    networks:
      - redline

networks:
  redline:
    driver: bridge
```

Why this version is better for Unraid:

- persistent data stays in `appdata`
- LiveKit config is explicit
- container names are easier to identify in the Unraid Docker page
- the build context points to your cloned REDLINE source

---

## 7. Configure `.env`

Edit:

```text
/mnt/user/appdata/redline/compose/.env
```

At minimum, set:

```env
SECRET_KEY_BASE=YOUR_SECRET_KEY_HERE
POSTGRES_DB=redline
POSTGRES_USER=redline
POSTGRES_PASSWORD=replace-with-a-strong-password
REDIS_PASSWORD=replace-with-a-strong-password
LIVEKIT_URL=ws://YOUR-UNRAID-IP:7880
LIVEKIT_API_KEY=replace-with-your-livekit-key
LIVEKIT_API_SECRET=replace-with-your-livekit-secret
DEVISE_MAILER_FROM=redline@yourdomain.com
PORT=3000
```

Generate strong values from the Unraid terminal:

```bash
openssl rand -hex 64
openssl rand -hex 24
openssl rand -hex 16
```

Use them like this:

- `SECRET_KEY_BASE`: use 128 hex characters, which is the output of `openssl rand -hex 64`
- `POSTGRES_PASSWORD`: long random string
- `REDIS_PASSWORD`: long random string
- `LIVEKIT_API_KEY`: random value
- `LIVEKIT_API_SECRET`: random value

For example, if your Unraid server is `192.168.1.100`, then `LIVEKIT_URL` would be `ws://192.168.1.100:7880`.

Optional variables:

- `GITHUB_CLIENT_ID`
- `GITHUB_CLIENT_SECRET`
- `STEAM_API_KEY`
- `AUDIT_LOG_IPS=true` if you explicitly want IPs stored in audit logs

> REDLINE uses username-first authentication. Email is optional for signup, and OAuth is optional.

---

## 8. Configure `livekit.yaml`

Edit:

```text
/mnt/user/appdata/redline/compose/livekit.yaml
```

The most important rule:

**The key and secret in `livekit.yaml` must match `LIVEKIT_API_KEY` and `LIVEKIT_API_SECRET` in `.env`.**

Use a minimal working config like this:

```yaml
port: 7880

rtc:
  tcp_port: 7881
  udp_port: 7882

keys:
  "YOUR_LIVEKIT_API_KEY_HERE": "YOUR_LIVEKIT_API_SECRET_HERE"

logging:
  level: info
```

Replace `YOUR_LIVEKIT_API_KEY_HERE` and `YOUR_LIVEKIT_API_SECRET_HERE` with the exact values from `.env`.

If you expect remote users behind strict NAT or firewalls, you need a TURN server. See [Section 9: TURN Server Setup](#9-turn-server-setup-ich777stun-turn-server) for the recommended `ich777/stun-turn-server` approach and how to complete the `turn:` block in this file. LiveKit can work on a LAN without TURN, but internet voice/video reliability requires it.

---

## 9. TURN Server Setup (ich777/stun-turn-server)

### Why you need a TURN server

WebRTC — the technology LiveKit uses for voice and video — tries to establish a direct connection between the client and the LiveKit SFU. On a local network this usually works without any additional infrastructure. On the public internet, most users are behind NAT routers or firewalls that block direct connections. When that happens, voice/video will fail silently or not connect at all.

A TURN (Traversal Using Relays around NAT) server acts as a relay. When a direct or STUN-assisted connection cannot be made, the client and LiveKit relay media through the TURN server instead. Without TURN, most of your users outside your LAN will not have reliable voice or video.

**If you intend to use REDLINE outside your own LAN, deploy a TURN server before expecting voice/video to work reliably.**

---

### Recommended: ich777/stun-turn-server

For Unraid, the easiest TURN server to deploy is [`ich777/stun-turn-server`](https://hub.docker.com/r/ich777/stun-turn-server). It is available directly from the **Unraid Community Applications** plugin and is based on [coturn](https://github.com/coturn/coturn), the most widely deployed open-source TURN server.

- **Unraid Community Apps:** search for `stun-turn-server` by `ich777`
- **Docker Hub:** <https://hub.docker.com/r/ich777/stun-turn-server>
- **GitHub:** <https://github.com/ich777/docker-stun-turn-server>

---

### Prerequisites for TURN to work publicly

Before you configure the container, confirm:

1. **You have a public IP address.** TURN only helps external users if the TURN server is reachable from the internet. If your ISP uses CGNAT, TURN over UDP may still fail — consider a TURN-over-TLS (port 5349) setup or a small VPS relay.
2. **Your router forwards the required ports** to your Unraid server:
   - `3478/udp` and `3478/tcp` — standard STUN/TURN
   - `5349/udp` and `5349/tcp` — TURNS (TURN over TLS, required by most browsers in production)
   - `49152–65535/udp` — the relay port range coturn allocates per session
3. **You have a domain name pointing to your public IP** (strongly recommended for TURNS/TLS). Dynamic DNS services work fine.

---

### Step 1: Install ich777/stun-turn-server on Unraid

**Via Community Applications (recommended):**

1. Open the **Apps** tab in the Unraid UI.
2. Search for `stun-turn-server`.
3. Click the `ich777` result and select **Install**.
4. Set the environment variables listed below before clicking **Apply**.

**Via Docker Compose** (if you prefer to keep everything in one stack):

Add this service to your `/mnt/user/appdata/redline/compose/docker-compose.yml`:

```yaml
  turn:
    image: ich777/stun-turn-server:latest
    container_name: redline-turn
    restart: unless-stopped
    environment:
      TURN_SECRET: replace-with-a-strong-random-secret
      TURN_REALM: turn.yourdomain.com        # your public domain or public IP
      MIN_PORT: 49152
      MAX_PORT: 65535
    ports:
      - "3478:3478/udp"
      - "3478:3478/tcp"
      - "5349:5349/udp"
      - "5349:5349/tcp"
      - "49152-65535:49152-65535/udp"
    volumes:
      - /mnt/user/appdata/redline/turn:/data
    networks:
      - redline
```

Replace `turn.yourdomain.com` with your public hostname or IP, and set `TURN_SECRET` to a long random value:

```bash
openssl rand -hex 32
```

---

### Step 2: Key environment variables

| Variable | Required | Description |
| --- | --- | --- |
| `TURN_SECRET` | Yes | Shared secret for time-limited credential generation. Must match `livekit.yaml`. |
| `TURN_REALM` | Yes | Your public domain name or public IP. This is what TURN uses as its realm. |
| `MIN_PORT` | Recommended | Start of the UDP relay port range. Default: `49152`. |
| `MAX_PORT` | Recommended | End of the UDP relay port range. Default: `65535`. |

> The `ich777/stun-turn-server` image uses coturn with a time-limited credential approach. `TURN_SECRET` is the shared secret — LiveKit uses this to generate short-lived credentials per session, so you never expose a plain username/password to clients.

---

### Step 3: Configure LiveKit to use TURN

Edit `/mnt/user/appdata/redline/compose/livekit.yaml` and uncomment the `turn:` block:

```yaml
port: 7880

rtc:
  tcp_port: 7881
  udp_port: 7882
  use_external_ip: true   # required when LiveKit is publicly exposed

keys:
  "YOUR_LIVEKIT_API_KEY": "YOUR_LIVEKIT_API_SECRET"

logging:
  level: info

turn:
  enabled: true
  domain: turn.yourdomain.com   # must match TURN_REALM in the TURN container
  tls_port: 5349
  udp_port: 3478
  credential: replace-with-a-strong-random-secret   # must match TURN_SECRET
```

The `credential` value in `livekit.yaml` **must exactly match** the `TURN_SECRET` you set in the TURN container. LiveKit uses this shared secret to generate short-lived TURN credentials for each client session.

Also set `use_external_ip: true` under `rtc:` — this tells LiveKit to advertise its public IP to clients rather than a Docker-internal address.

---

### Step 4: Verify TURN is working

After starting both containers, test TURN connectivity from a browser using a WebRTC tester such as [https://webrtc.github.io/samples/src/content/peerconnection/trickle-ice/](https://webrtc.github.io/samples/src/content/peerconnection/trickle-ice/).

Enter your TURN server details:
- **STUN or TURN URI:** `turn:turn.yourdomain.com:3478` or `turns:turn.yourdomain.com:5349`
- **Username:** leave blank (time-limited credentials are handled by LiveKit automatically)
- **Password:** leave blank

You should see `relay` candidates appear in the ICE candidate output. If only `host` and `srflx` candidates appear, your ports may not be forwarded correctly.

You can also check coturn logs from Unraid:

```bash
docker logs redline-turn
```

A successful TURN relay session will show lines like `session allocated`, `peer connected`, or `relay allocated`.

---

### Summary: TURN checklist

- [ ] `ich777/stun-turn-server` container deployed and running
- [ ] `TURN_SECRET` set to a strong random value
- [ ] `TURN_REALM` set to your public domain or public IP
- [ ] Router port forwarding: `3478/udp+tcp`, `5349/udp+tcp`, `49152–65535/udp`
- [ ] `livekit.yaml` `turn:` block enabled with matching `credential` and `domain`
- [ ] `rtc.use_external_ip: true` set in `livekit.yaml`
- [ ] LiveKit container restarted after config change
- [ ] TURN connectivity verified from a browser outside your LAN

---

## 10. Start REDLINE on Unraid

### Option A: Unraid CLI with Docker Compose

From the Unraid terminal:

```bash
cd /mnt/user/appdata/redline/compose
docker compose up -d --build
```

Then inspect status:

```bash
docker compose ps
docker compose logs -f
```

### Option B: Unraid Compose Manager UI

If your Unraid installation includes Docker Compose management in the UI:

1. Open the Compose/Stacks area in the Unraid web UI.
2. Create a new stack named `redline`.
3. Paste the Unraid-friendly Compose file from this guide.
4. Place `.env` and `livekit.yaml` in the stack's expected storage path, or adjust the bind mounts to point at your appdata folder.
5. Deploy the stack.

If the UI stack manager complains about relative paths, use the absolute bind-mounted paths shown in this guide.

---

## 11. Confirm the containers are healthy

In the CLI:

```bash
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
```

You want to see:

- `redline-web`
- `redline-db`
- `redline-redis`
- `redline-livekit`

Then test the web app locally from Unraid:

```bash
curl http://localhost:3000/health
```

Expected result:

- HTTP `200` when database and Redis are healthy
- JSON output listing database, redis, action_cable, and livekit

You can also test from another machine on your LAN:

```text
http://YOUR-UNRAID-IP:3000/health
```

---

## 12. First web login and initial setup

Open REDLINE in a browser:

```text
http://YOUR-UNRAID-IP:3000
```

Then:

1. Create your first user account from the signup page.
2. Sign in.
3. Confirm you can:
   - load the rooms page
   - create a room
   - join a room
   - send a message

If chat works but voice/video does not, revisit:

- `LIVEKIT_URL`
- `livekit.yaml`
- port forwarding / proxying
- LiveKit TCP/UDP exposure

---

## 13. Promote your first user to admin

REDLINE does not ship with a default admin account.

Use the Unraid terminal:

```bash
docker exec -it redline-web bundle exec rails console
```

Then in the Rails console:

```ruby
user = User.first
user.update!(role: "admin")
```

Exit the console:

```ruby
exit
```

Now refresh the REDLINE UI and verify the admin area is available.

---

## 14. Reverse proxy guidance for a real production deployment

REDLINE production mode forces SSL behavior, so a reverse proxy is strongly recommended for anything beyond local testing.

`LIVEKIT_URL` must always be reachable by the user's browser, not just by the Docker network.

Your reverse proxy should:

1. Terminate TLS
2. Forward `X-Forwarded-Proto=https`
3. Support WebSockets
4. Pass REDLINE traffic to `http://YOUR-UNRAID-IP:3000`
5. Preserve `/cable` upgrades

For voice/video, choose one of these patterns:

### Pattern A: expose LiveKit separately

- `chat.yourdomain.com` → REDLINE web app
- `livekit.yourdomain.com` → LiveKit on port `7880`
- expose `7881/tcp` and `7882/udp` as required

Then update `.env`:

```env
LIVEKIT_URL=wss://livekit.yourdomain.com
```

### Pattern B: LAN-only or VPN-only use

If all users stay inside your LAN or VPN, set:

```env
LIVEKIT_URL=ws://YOUR-UNRAID-IP:7880
```

That is the simplest starting point, but it is not the best option for public internet users.

---

## 15. Unraid UI workflow summary

If you want the shortest all-UI-friendly path, use this order:

1. **Settings → Docker**: confirm Docker is enabled
2. **Shares**: verify `appdata` exists
3. **Terminal**: create the REDLINE folders in `/mnt/user/appdata/redline`
4. **Terminal**: clone the REDLINE repo into `/mnt/user/appdata/redline/source`
5. **Terminal or file editor**: create the Compose file, `.env`, and `livekit.yaml`
6. **Compose Manager UI or CLI**: deploy the stack
7. **Docker page**: confirm the containers are running
8. **Browser**: open `http://YOUR-UNRAID-IP:3000`
9. **Terminal**: promote your first user to admin
10. **Reverse proxy UI**: add HTTPS and WebSocket support for public access
11. **Community Apps**: install `ich777/stun-turn-server` and configure LiveKit to use it ([Section 9](#9-turn-server-setup-ich777stun-turn-server))
12. **Router**: forward TURN ports (`3478`, `5349`, `49152–65535/udp`) to your Unraid server

---

## 16. Unraid CLI command reference

Use these as your main operating commands:

```bash
cd /mnt/user/appdata/redline/compose
docker compose up -d --build
docker compose ps
docker compose logs -f
docker compose pull
docker compose up -d
docker compose down
```

Useful one-liners:

```bash
docker exec -it redline-web bundle exec rails console
docker exec -it redline-web bundle exec rails routes
docker exec -it redline-web env | sort
curl http://localhost:3000/health
```

To update REDLINE later:

```bash
cd /mnt/user/appdata/redline/source
git pull
cd /mnt/user/appdata/redline/compose
docker compose up -d --build
```

---

## 17. What “fully working” should mean before you call the install complete

Before you consider the install complete, verify all of these:

- [ ] REDLINE loads in the browser
- [ ] You can create a user
- [ ] You can sign in and sign out
- [ ] You can create and join rooms
- [ ] You can send messages
- [ ] `/health` returns healthy database and Redis checks
- [ ] Your first user is promoted to admin
- [ ] Admin pages load
- [ ] LiveKit connectivity works for your intended network model
- [ ] TURN server is running and verified if you need external voice/video access
- [ ] Data survives a container restart

Persistence test:

```bash
cd /mnt/user/appdata/redline/compose
docker compose restart
```

Then confirm:

- users still exist
- rooms still exist
- messages still exist

---

## 18. Troubleshooting

### REDLINE web container will not start

Check:

```bash
cd /mnt/user/appdata/redline/compose
docker compose logs web
```

Common causes:

- invalid `SECRET_KEY_BASE`
- bad `DATABASE_URL`
- bad `REDIS_URL`
- app build failure

### LiveKit features fail

Check:

```bash
docker compose logs livekit
```

Common causes:

- `LIVEKIT_API_KEY` and `LIVEKIT_API_SECRET` do not match `livekit.yaml`
- `LIVEKIT_URL` points to the wrong hostname or protocol
- `7882/udp` is blocked
- external clients need TURN/public networking adjustments — see [Section 9](#9-turn-server-setup-ich777stun-turn-server)

### Voice or video fails only for users outside the LAN

This is the most common sign of a missing or misconfigured TURN server.

Steps to diagnose:

1. Confirm TURN container is running:
   ```bash
   docker logs redline-turn
   ```
2. Check that `3478/udp`, `3478/tcp`, `5349/tcp`, and `49152–65535/udp` are forwarded on your router.
3. Verify `livekit.yaml` has `turn.enabled: true` and the `credential` matches `TURN_SECRET` in the TURN container.
4. Verify `rtc.use_external_ip: true` is set in `livekit.yaml`.
5. Restart LiveKit after any config change:
   ```bash
   docker compose restart livekit
   ```
6. Test with a WebRTC ICE tester from a device outside your LAN (for example, a phone on mobile data) and look for `relay` candidates.

If relay candidates do not appear, your ports are not forwarded or coturn is not starting correctly.

### `/health` is degraded

The REDLINE health endpoint reports:

- database
- redis
- action_cable
- livekit

If database or Redis fail, fix those first. Those are the core startup dependencies.

### Web UI loads but WebSockets do not

Your reverse proxy likely is not forwarding WebSocket upgrades correctly.

Make sure:

- `/cable` supports upgrade headers
- proxy timeout values are not too low
- HTTPS termination forwards `X-Forwarded-Proto=https`

---

## 19. Guidance for porting REDLINE to Unraid Community Apps

This is the important limitation:

**The current REDLINE `web` service is built from the local repository `Dockerfile`. Unraid Community Apps templates normally expect a prebuilt image, not a local `build:` context.**

That means:

- **best deployment path today:** Docker Compose
- **best Community Apps path later:** publish a REDLINE image first, then template it

### Recommended Community Apps migration path

1. Build and publish the REDLINE web image to a registry such as Docker Hub or GHCR.
2. Replace the `web` service in Compose with something like:

   ```yaml
   image: ghcr.io/YOUR_GHCR_NAMESPACE/redline:latest
   ```

   Replace `YOUR_GHCR_NAMESPACE` with the GitHub or registry namespace where you publish your REDLINE image.

3. Create separate CA templates for:
   - REDLINE web
   - PostgreSQL
   - Redis
   - LiveKit
   - TURN server (`ich777/stun-turn-server` — already available in Community Apps)
4. Map the same environment variables already documented in this guide.
5. Map the same persistent paths under `/mnt/user/appdata/redline/...`.
6. Keep all four containers on the same custom Docker network.

### Community Apps field mapping reference

| Compose item | CA template equivalent |
| --- | --- |
| `ports:` | Port mappings |
| `volumes:` | Path mappings |
| `environment:` | Container variables |
| `restart: unless-stopped` | Restart policy |
| `command:` | Post arguments / extra parameters |
| custom network | Advanced network configuration |

### Minimum CA template values per service

### REDLINE web

- Image: published REDLINE image
- Port: `3000`
- Paths:
  - `/rails/storage` → `/mnt/user/appdata/redline/storage`
- Variables:
  - `RAILS_ENV=production`
  - `RAILS_LOG_TO_STDOUT=true`
  - `SECRET_KEY_BASE`
  - `DATABASE_URL`
  - `REDIS_URL`
  - `LIVEKIT_URL`
  - `LIVEKIT_API_KEY`
  - `LIVEKIT_API_SECRET`
  - `DEVISE_MAILER_FROM`

### PostgreSQL

- Image: `postgres:16-alpine`
- Path:
  - `/var/lib/postgresql/data` → `/mnt/user/appdata/redline/postgres`
- Variables:
  - `POSTGRES_DB`
  - `POSTGRES_USER`
  - `POSTGRES_PASSWORD`

### Redis

- Image: `redis:7-alpine`
- Path:
  - `/data` → `/mnt/user/appdata/redline/redis`
- Extra parameters or command:
  - `redis-server --requirepass YOUR_PASSWORD`

### LiveKit

- Image: `livekit/livekit-server:latest`
- Ports:
  - `7880/tcp`
  - `7881/tcp`
  - `7882/udp`
- Path:
  - `/etc/livekit.yaml` → `/mnt/user/appdata/redline/compose/livekit.yaml`
- Extra parameters:
  - `--config /etc/livekit.yaml`

### TURN Server (ich777/stun-turn-server)

`ich777/stun-turn-server` is already in Community Apps — search for it by name in the Apps tab.

- Image: `ich777/stun-turn-server:latest`
- Ports:
  - `3478/udp`
  - `3478/tcp`
  - `5349/udp`
  - `5349/tcp`
  - `49152-65535/udp` (relay range)
- Path:
  - `/data` → `/mnt/user/appdata/redline/turn`
- Variables:
  - `TURN_SECRET` — must match `credential` in `livekit.yaml`
  - `TURN_REALM` — your public domain or IP
  - `MIN_PORT=49152`
  - `MAX_PORT=65535`

If you want a polished Community Apps experience, the right long-term path is:

1. publish a stable REDLINE image
2. create an XML template for each service or a supported bundled workflow
3. document reverse proxy expectations beside the CA template

Until then, Compose remains the cleanest and most supportable Unraid deployment method.

---

## 20. Final recommended deployment path

For most Unraid users, the best order is:

1. Deploy REDLINE with Docker Compose
2. Validate chat, admin access, and persistence
3. Add reverse proxy and HTTPS
4. Deploy `ich777/stun-turn-server` and configure LiveKit to use it ([Section 9](#9-turn-server-setup-ich777stun-turn-server))
5. Validate voice/video from real client devices **outside your LAN** (e.g., on mobile data)
6. Only then consider porting the deployment into Community Apps templates

That gives you the highest chance of getting to a fully working REDLINE server — including reliable voice/video for all users — quickly and repeatably.
