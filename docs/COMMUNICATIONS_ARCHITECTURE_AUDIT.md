# REDLINE Communications Architecture Audit

**Date:** April 2026
**Scope:** Audio/video device handling, browser permissions, direct message voice/video, mobile ↔ desktop communication

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Architecture Overview](#architecture-overview)
3. [Audio & Video Device Handling](#audio--video-device-handling)
4. [Browser Permissions](#browser-permissions)
5. [Voice & Video Channels](#voice--video-channels)
6. [Direct Message Voice & Video](#direct-message-voice--video)
7. [Mobile ↔ Desktop Communication Scenario](#mobile--desktop-communication-scenario)
8. [Critical Findings & Action Fixes](#critical-findings--action-fixes)
9. [Architecture Diagrams](#architecture-diagrams)

---

## Executive Summary

Redline uses a three-layer communications stack:

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Voice/Video** | LiveKit SFU + WebRTC | Real-time audio/video in channels |
| **Persistent Chat** | ActionCable (WebSocket) + PostgreSQL | Room and DM text messaging |
| **In-Call Chat** | LiveKit DataChannels | Low-latency text while on a call |

### Critical Finding

**Voice and video calls are currently broken in production.** The `Permissions-Policy` HTTP header in `config/initializers/secure_headers.rb` blocks all camera and microphone access:

```
Permissions-Policy: camera=(), microphone=(), geolocation=()
```

This tells the browser to **deny** `getUserMedia()` for both camera and microphone, which means the LiveKit SDK cannot access any media devices. Calls will silently fail or throw a `NotAllowedError`.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                      REDLINE CLIENT (Browser/PWA)               │
├─────────────────────────────────────────────────────────────────┤
│  Stimulus Controllers:                                          │
│  • channel_controller.js  — Voice/video lifecycle + layout      │
│  • livekit_controller.js  — WebRTC connection (legacy fallback) │
│  • chat_controller.js     — Room text messages                  │
│  • dm_chat_controller.js  — DM text messages                    │
│  • dm_input_controller.js — DM input handling                   │
│  • message_input_controller.js — Room message input             │
│  • bottom_sheet_controller.js  — Mobile in-call chat sheet      │
│  • sidebar_controller.js       — Mobile navigation drawer       │
│                                                                 │
│  Libraries:                                                     │
│  • livekit-client v2.5.5 (CDN, dynamic import)                  │
│  • @rails/actioncable (importmap)                               │
│  • Turbo + Stimulus (importmap)                                 │
└──────────────┬──────────────────────────┬───────────────────────┘
               │ HTTPS                    │ WebSocket (wss://)
               ▼                          ▼
┌──────────────────────────────┐  ┌────────────────────────────────┐
│  Rails Server (:3000)        │  │  ActionCable (via Rails)       │
│                              │  │  Channels:                     │
│  • LivekitController#token   │  │  • PresenceChannel (status)    │
│    (JWT generation)          │  │  • ChatChannel (room msgs)     │
│  • RoomsController           │  │  • DirectMessageChannel (DMs)  │
│  • MessagesController        │  │  Backed by Redis Pub/Sub       │
│  • DirectMessagesController  │  └────────────────────────────────┘
│  Database: PostgreSQL        │
└──────────────┬───────────────┘
               │ WebRTC (ICE/DTLS/SRTP)
               │ UDP :7882 / TCP :7881
               ▼
┌──────────────────────────────┐
│  LiveKit SFU (:7880)         │
│  • Room orchestration        │
│  • Media relay (SFU)         │
│  • DataChannel messaging     │
│  • No TURN configured        │
└──────────────────────────────┘
```

---

## Audio & Video Device Handling

### How Devices Are Accessed

Redline does **not** call `navigator.mediaDevices.getUserMedia()` directly. All device access is delegated to the **LiveKit JavaScript SDK** (`livekit-client`).

| Step | What Happens | Where |
|------|-------------|-------|
| 1 | User clicks "Join" button in a voice channel | `_header.html.erb` → `channel#joinCall` |
| 2 | Controller fetches JWT token from server | `channel_controller.js:fetchToken()` → `POST /rooms/:id/livekit_token` |
| 3 | Server generates JWT with room/user grants | `livekit_controller.rb:generate_livekit_token()` |
| 4 | Controller connects to LiveKit via SDK | `channel_controller.js:connectToRoom()` → `room.connect(url, token)` |
| 5 | SDK internally calls `getUserMedia({audio: true})` | `livekit-client` SDK internals |
| 6 | Browser prompts user for microphone permission | Native browser permission dialog |
| 7 | SDK auto-enables microphone | `room.localParticipant.setMicrophoneEnabled(true)` |

### Device Enumeration

There is **no explicit device enumeration or selection UI**. The LiveKit SDK:
- Uses the browser's default microphone/camera
- Provides `adaptiveStream: true` for automatic quality adjustment
- Provides `dynacast: true` for bandwidth optimization

### What's Missing

| Gap | Impact | Priority |
|-----|--------|----------|
| No device picker UI | Users cannot choose between multiple microphones/cameras | Medium |
| No pre-call device test | Users cannot test audio/video before joining | Medium |
| No `TrackUnsubscribed` handler | Remote participant video/audio elements may leak in DOM | Low |
| No reconnection handling | `RoomEvent.Reconnecting` / `Reconnected` not handled | High |

---

## Browser Permissions

### Current State: BROKEN ⚠️

**File:** `config/initializers/secure_headers.rb` (line 10)

```ruby
"Permissions-Policy" => "camera=(), microphone=(), geolocation=()"
```

This header tells the browser: **block camera, microphone, and geolocation for all origins including self**. The `()` syntax means "no allowed origins."

**Impact:** The LiveKit SDK's internal `getUserMedia()` call is blocked by the browser before the user ever sees a permission prompt. Calls fail silently or with a `NotAllowedError`.

### How Browser Permissions Should Work

For voice/video to function, the browser needs:

1. **`Permissions-Policy` header** must allow `camera` and `microphone` for `self`
2. **HTTPS** is required (browsers block `getUserMedia` on insecure origins, except `localhost`)
3. **User gesture** requirement: Most browsers require a user interaction (click) before `getUserMedia` — Redline satisfies this because the user clicks "Join"
4. **Content Security Policy** must allow WebSocket connections to the LiveKit server

### Mobile-Specific Permission Behavior

| Platform | Behavior |
|----------|----------|
| **iOS Safari** | Prompts once per page load; must re-prompt after page navigation (Turbo Drive caches may cause issues) |
| **Android Chrome** | Persistent permission per origin; once granted, remembered across sessions |
| **Android Firefox** | Similar to Chrome but may show inline permission bar |
| **PWA (standalone)** | Inherits permissions from the browser; install-to-homescreen does not bypass prompts |

### CSP (Content Security Policy)

**Current state:** CSP is **not configured** (`config/initializers/content_security_policy.rb` is fully commented out).

This means:
- No `connect-src` restriction → LiveKit WebSocket connections work
- No `media-src` restriction → Audio/video elements work
- But also no XSS protection from CSP

---

## Voice & Video Channels

### Channel Types

| Type | Text Chat | Voice/Video | Use Case |
|------|-----------|-------------|----------|
| `chat` | ✅ | ❌ | Text-only discussion |
| `both` | ✅ | ✅ | Voice channel with text (Discord-style) |
| `announcement` | ✅ (admin only) | ❌ | Read-only announcements |

> Note: The legacy `voice` type has been migrated to `both` (see `20260407000003_migrate_voice_channel_type_to_both.rb`).

### Join Flow

```
User clicks "Join" button
  └→ channel_controller.js#joinCall()
       ├→ Show loading spinner + "Connecting" status dot
       ├→ fetchToken() → POST /rooms/:slug/livekit_token
       │    └→ LivekitController#token
       │         ├→ Validate: voice_channel?, membership, can_connect?
       │         └→ Return: { token, url, room, identity, can_screen_share, has_in_call_chat }
       ├→ connectToRoom(token, url)
       │    ├→ Dynamic import livekit-client SDK
       │    ├→ Create Room({ adaptiveStream: true, dynacast: true })
       │    ├→ Register event handlers (connect/disconnect/track/data)
       │    ├→ room.connect(url, token)
       │    └→ localParticipant.setMicrophoneEnabled(true)  ← Auto-unmute
       ├→ Show control bar (Mute/Deafen/Share/Chat/Leave)
       ├→ Show in-call chat panel
       └→ Announce "Joined the voice channel" (screen reader)
```

### LiveKit Token (JWT)

Generated server-side with the `jwt` gem. Claims:

```json
{
  "iss": "<LIVEKIT_API_KEY>",
  "sub": "<user_id>",
  "exp": "<now + 1 hour>",
  "name": "<display_name>",
  "video": {
    "roomJoin": true,
    "room": "<room_slug>",
    "canPublish": true,
    "canSubscribe": true,
    "canPublishData": true
  },
  "metadata": "{ user_display_name, user_avatar_color, user_initials, can_screen_share }"
}
```

### Permissions Model

| Permission | Admin | Moderator | Member | Scope |
|-----------|-------|-----------|--------|-------|
| `connect` | ✅ | ✅ | ✅ | Join voice channel |
| `speak` | ✅ | ✅ | ✅ | Transmit audio |
| `video` | ✅ | ✅ | ✅ | Transmit video |
| `screen_share` | ✅ | ✅ | ❌ | Share screen |
| `mute_members` | ✅ | ✅ | ❌ | Mute others |
| `deafen_members` | ✅ | ✅ | ❌ | Deafen others |
| `move_members` | ✅ | ❌ | ❌ | Move to subchannel |

> Note: `speak` and `video` permissions exist in the model but are not currently enforced in the JWT token — all users get `canPublish: true` regardless. See Action Fixes below.

### Control Bar

Available controls during a voice call:

| Button | Action | Mobile | Desktop |
|--------|--------|--------|---------|
| **Mute** | Toggle microphone on/off | ✅ | ✅ |
| **Deafen** | Mute all incoming audio | ✅ | ✅ |
| **Share Screen** | Toggle screen sharing (permission-gated) | ✅* | ✅ |
| **Chat** | Toggle in-call chat bottom sheet | ✅ | ✅ |
| **Leave** | Disconnect from call | ✅ | ✅ |

\* Screen sharing on mobile may be limited by OS/browser capabilities.

### In-Call Text Chat

Uses LiveKit **DataChannels** (not ActionCable) for low-latency messaging during calls:

- **Send:** `localParticipant.publishData(jsonPayload, { reliable: true })`
- **Receive:** `RoomEvent.DataReceived` handler
- **Payload:** `{ type: "chat", body, sender_id, sender_name, timestamp }`
- **Not persisted** — messages are lost when the call ends
- **Mobile:** Renders as a bottom sheet with drag-to-dismiss

---

## Direct Message Voice & Video

### Current State: NOT IMPLEMENTED

Direct messages are **text-only**. There is no voice or video calling capability in DMs.

**What exists:**
- `DirectMessagesController` (text create/show)
- `DirectMessageChannel` (ActionCable subscription for real-time text)
- `dm_chat_controller.js` (append messages)
- `dm_input_controller.js` (send messages)

**What does NOT exist:**
- No LiveKit integration in DM views
- No "Call" or "Video Call" button in DM header
- No DM-scoped LiveKit room creation
- No ringing/calling/answering flow
- No push notifications for incoming calls

### How DMs Currently Work

```
User A opens DM with User B
  └→ GET /users/:user_b_id/direct_messages
       └→ DirectMessagesController#show
            ├→ Load last 50 messages
            ├→ Mark unread messages as read
            └→ Render conversation view

User A sends text:
  └→ POST /users/:user_b_id/direct_messages (JSON)
       └→ DirectMessagesController#create
            ├→ DirectMessage.create!(sender: A, recipient: B, body: ...)
            └→ ActionCable broadcast to "dm_#{sorted_ids}"
                 └→ Both A and B receive message via DirectMessageChannel
```

---

## Mobile ↔ Desktop Communication Scenario

**Scenario from the screenshot:** Admin (desktop) and Doc (mobile) are both in the "Voice test" channel.

### What Works Today (after Permissions-Policy fix)

| Communication | Works? | How |
|--------------|--------|-----|
| **Text chat in channel** | ✅ | ActionCable → both see messages in real time |
| **Voice call in channel** | ⚠️ Blocked | Permissions-Policy header denies microphone access |
| **Video call in channel** | ⚠️ Blocked | Permissions-Policy header denies camera access |
| **In-call text chat** | ⚠️ Blocked | Requires active LiveKit call (DataChannels) |
| **Direct message text** | ✅ | ActionCable → DM conversation view |
| **Direct message voice** | ❌ Not built | No DM calling feature exists |
| **Direct message video** | ❌ Not built | No DM calling feature exists |
| **Screen sharing** | ⚠️ Blocked | Requires active LiveKit call + permission |

### After Fixing Permissions-Policy (Action Fix #1)

| Communication | Works? | Caveats |
|--------------|--------|---------|
| **Voice in channel** | ✅ (LAN) / ⚠️ (Internet) | Needs TURN server for NAT traversal |
| **Video in channel** | ✅ (LAN) / ⚠️ (Internet) | Same TURN requirement |
| **Screen sharing** | ✅ Desktop / ⚠️ Mobile | Mobile browser support varies |
| **In-call text chat** | ✅ | Via LiveKit DataChannels |

### How Admin (Desktop) and Doc (Mobile) Would Communicate

**Voice Channel (after fix):**
1. Both navigate to "Voice test" channel
2. Admin clicks "Join" on desktop → microphone activates, tile appears
3. Doc clicks "Join" on mobile → mobile browser prompts for microphone → tile appears
4. LiveKit SFU routes audio between both clients
5. Both can mute/deafen independently
6. Both can use in-call text chat (DataChannels)

**Direct Message (current):**
1. Admin clicks Doc's name → opens DM conversation
2. Both can exchange text messages in real time
3. **No voice or video option available**

---

## Critical Findings & Action Fixes

### 🔴 CRITICAL — Fix #1: Permissions-Policy Header Blocks All Media

**File:** `config/initializers/secure_headers.rb`
**Line:** 10
**Problem:** `camera=()` and `microphone=()` deny all media access
**Impact:** Voice and video calls completely broken

**Fix:** Change to allow `self` origin:

```ruby
# Before (BROKEN):
"Permissions-Policy" => "camera=(), microphone=(), geolocation=()"

# After (FIXED):
"Permissions-Policy" => "camera=(self), microphone=(self), geolocation=()"
```

**Estimated effort:** 1 line change, immediate fix

---

### 🔴 CRITICAL — Fix #2: `speak` and `video` Permissions Not Enforced in JWT

**File:** `app/controllers/livekit_controller.rb`
**Lines:** 52-55
**Problem:** Token always grants `canPublish: true` regardless of `speak` or `video` permission
**Impact:** Members who should be listen-only can still transmit audio/video

**Fix:** Check `speak` and `video` permissions before setting `canPublish`:

```ruby
can_publish = membership&.can_speak?(room) != false
```

**Estimated effort:** Small logic change in token generation

---

### 🟡 HIGH — Fix #3: No TURN/STUN Server for NAT Traversal

**File:** `livekit.yaml`
**Problem:** TURN configuration is commented out; `use_external_ip` is disabled
**Impact:** Voice/video only works on LAN — fails for any internet user behind NAT/firewall

**Fix:** Deploy a TURN server (recommended: `coturn` or `ich777/stun-turn-server`) and uncomment the TURN block in `livekit.yaml`:

```yaml
rtc:
  use_external_ip: true

turn:
  enabled: true
  domain: turn.yourdomain.com
  tls_port: 5349
  udp_port: 3478
  credential: <shared-secret>
```

**Estimated effort:** Infrastructure deployment + config change

---

### 🟡 HIGH — Fix #4: No LiveKit Reconnection Handling

**File:** `app/javascript/controllers/channel_controller.js`
**Problem:** No handlers for `RoomEvent.Reconnecting` or `RoomEvent.Reconnected`
**Impact:** Users on unstable connections (especially mobile) get silently disconnected with no recovery

**Fix:** Add reconnection event handlers:

```javascript
this.livekitRoom.on(LK.RoomEvent.Reconnecting, () => {
  this.updateStatusDot("connecting")
  this.announce("Reconnecting...")
})

this.livekitRoom.on(LK.RoomEvent.Reconnected, () => {
  this.updateStatusDot("connected")
  this.announce("Reconnected")
})

this.livekitRoom.on(LK.RoomEvent.Disconnected, (reason) => {
  this.updateStatusDot("disconnected")
  this.announce("Disconnected: " + reason)
  this.leaveCall()
})
```

**Estimated effort:** ~20 lines of JavaScript

---

### 🟡 HIGH — Fix #5: LIVEKIT_URL Uses Internal Docker Network Address

**File:** `docker-compose.yml` (line 52), `.env.example` (line 28)
**Problem:** `LIVEKIT_URL=ws://livekit:7880` is the Docker internal hostname — clients on mobile/external networks cannot resolve `livekit`
**Impact:** Mobile users and any external users cannot connect to LiveKit

**Fix:** The `LIVEKIT_URL` returned to the client must be a publicly reachable address:

```env
# .env — for external/production use:
LIVEKIT_URL=wss://livekit.yourdomain.com
```

The server-side token endpoint returns this URL directly to the client browser, so it must be reachable from the client's network.

**Estimated effort:** Environment variable + reverse proxy configuration

---

### 🟡 MEDIUM — Fix #6: No Content Security Policy

**File:** `config/initializers/content_security_policy.rb`
**Problem:** Entirely commented out — no CSP headers sent
**Impact:** No XSS protection; also no explicit allowlist for LiveKit WebSocket connections

**Fix:** Enable CSP with appropriate directives:

```ruby
Rails.application.configure do
  config.content_security_policy do |policy|
    policy.default_src :self
    policy.font_src    :self, :data
    policy.img_src     :self, :data, :https
    policy.object_src  :none
    policy.script_src  :self, "https://cdn.jsdelivr.net"  # LiveKit SDK
    policy.style_src   :self, :unsafe_inline
    policy.connect_src :self, ENV.fetch("LIVEKIT_URL", "ws://localhost:7880").sub(/^ws/, "http")
    policy.media_src   :self, :blob  # WebRTC media streams
  end
end
```

**Estimated effort:** Configuration, requires testing

---

### 🟡 MEDIUM — Fix #7: No DM Voice/Video Calling

**Problem:** Direct messages are text-only; no mechanism for 1-to-1 voice/video calls
**Impact:** Users must create a channel for any voice/video communication

**Fix (feature build):**
1. Create a DM LiveKit room concept (ephemeral room per conversation pair)
2. Add "Voice Call" and "Video Call" buttons to DM header
3. Implement a signaling flow (ring → answer/decline) via ActionCable
4. Generate LiveKit tokens scoped to the DM room
5. Reuse the same LiveKit controls (mute/deafen/leave)

**Estimated effort:** Feature-sized work (multiple files, new views, new controller actions)

---

### 🟢 LOW — Fix #8: No Device Picker / Pre-Call Test

**Problem:** Users cannot select which microphone/camera to use, or test them before joining
**Impact:** Users with multiple audio devices may transmit from the wrong device

**Fix:**
1. Add a settings page or pre-call modal with device enumeration (`navigator.mediaDevices.enumerateDevices()`)
2. Allow user to select preferred devices
3. Store selection in `localStorage`
4. Pass device IDs to LiveKit SDK when creating tracks

**Estimated effort:** New UI component + localStorage integration

---

### 🟢 LOW — Fix #9: Track Unsubscribed / Track Muted Events Not Handled

**File:** `app/javascript/controllers/channel_controller.js`
**Problem:** No handler for `TrackUnsubscribed` or `TrackMuted` — DOM elements may accumulate
**Impact:** Memory leaks during long calls; stale video/audio elements

**Fix:** Add cleanup handlers:

```javascript
this.livekitRoom.on(LK.RoomEvent.TrackUnsubscribed, (track, _pub, participant) => {
  track.detach().forEach(el => el.remove())
})

this.livekitRoom.on(LK.RoomEvent.TrackMuted, (pub, participant) => {
  // Update participant tile to show muted indicator
})
```

**Estimated effort:** ~15 lines of JavaScript

---

### 🟢 LOW — Fix #10: In-Call Chat Messages Not Persisted

**Problem:** DataChannel messages are ephemeral — lost when the call ends
**Impact:** No history of in-call chat conversations

**Fix (optional):** Forward in-call messages to the ActionCable `ChatChannel` with a `message_context: "in_call"` flag to persist them in the database. The model/channel already supports `message_context`.

**Estimated effort:** Small — bridge DataChannel → ActionCable on send

---

## Architecture Diagrams

### Voice/Video Call Flow

```
┌──────────┐          ┌──────────┐          ┌──────────┐
│  Mobile   │          │  Rails   │          │ LiveKit  │
│  (Doc)    │          │  Server  │          │   SFU    │
└────┬─────┘          └────┬─────┘          └────┬─────┘
     │                     │                     │
     │  Click "Join"       │                     │
     │────────────────────>│                     │
     │  POST /livekit_token│                     │
     │                     │                     │
     │  { token, url }     │                     │
     │<────────────────────│                     │
     │                     │                     │
     │  WebSocket connect (wss://livekit:7880)   │
     │──────────────────────────────────────────>│
     │                     │                     │
     │  ICE negotiation    │                     │
     │<─────────────────────────────────────────>│
     │                     │                     │
     │  Audio/Video RTP    │                     │
     │<═════════════════════════════════════════>│
     │                     │                     │
```

### Desktop ↔ Mobile via LiveKit SFU

```
┌──────────┐                              ┌──────────┐
│ Desktop  │          ┌──────────┐        │  Mobile  │
│ (Admin)  │          │ LiveKit  │        │  (Doc)   │
└────┬─────┘          │   SFU    │        └────┬─────┘
     │                └────┬─────┘             │
     │  Audio/Video RTP    │                   │
     │═══════════════════=>│                   │
     │                     │  Audio/Video RTP  │
     │                     │══════════════════>│
     │                     │                   │
     │  DataChannel (chat) │                   │
     │────────────────────>│                   │
     │                     │  DataChannel      │
     │                     │──────────────────>│
     │                     │                   │
```

### Text Chat / DM Flow

```
┌──────────┐          ┌──────────┐          ┌──────────┐
│  Client  │          │  Rails + │          │  Client  │
│   (A)    │          │  Redis   │          │   (B)    │
└────┬─────┘          └────┬─────┘          └────┬─────┘
     │                     │                     │
     │  POST /messages     │                     │
     │────────────────────>│                     │
     │                     │  Save to PostgreSQL │
     │                     │  Broadcast via Redis│
     │                     │                     │
     │  ActionCable push   │  ActionCable push   │
     │<────────────────────│────────────────────>│
     │                     │                     │
```

---

## Summary Priority Matrix

| # | Fix | Severity | Effort | Blocking? |
|---|-----|----------|--------|-----------|
| 1 | Permissions-Policy header | 🔴 Critical | Trivial | **Yes** — all calls broken |
| 2 | speak/video permission enforcement | 🔴 Critical | Small | Partial — security gap |
| 3 | TURN server deployment | 🟡 High | Medium | **Yes** — for internet users |
| 4 | Reconnection handling | 🟡 High | Small | No — degrades gracefully |
| 5 | LIVEKIT_URL public address | 🟡 High | Small | **Yes** — for external users |
| 6 | Content Security Policy | 🟡 Medium | Medium | No — security hardening |
| 7 | DM voice/video calling | 🟡 Medium | Large | No — feature request |
| 8 | Device picker / pre-call test | 🟢 Low | Medium | No — UX improvement |
| 9 | Track cleanup handlers | 🟢 Low | Small | No — memory optimization |
| 10 | In-call chat persistence | 🟢 Low | Small | No — optional feature |
