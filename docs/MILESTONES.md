# REDLINE — Development Milestones

**Document generated:** April 2026
**Based on:** Full UI/UX feature audit (see previous session output)
**Scope:** All ⚠️ partially-working and ❌ not-implemented features, organised into actionable milestones.

Each issue from the audit is tagged with its source category and tracked here. Items are grouped into milestones by theme and dependency order, not arbitrary sprints. Complete each milestone before beginning the next — later milestones often depend on earlier infrastructure work.

---

## Legend

| Status | Meaning |
|--------|---------|
| `[ ]` | Not started |
| `[~]` | In progress |
| `[x]` | Complete |

Priority tags: **P0** = blocking / regression, **P1** = high value, **P2** = medium, **P3** = nice-to-have.

---

## Milestone 1 — Dead Code & Orphaned Controllers

> Clean up the codebase before layering new features. These are low-risk, zero-dependency tasks.

- [x] **P1** Remove `livekit_controller.js` or convert it to a clearly-documented legacy fallback — it is registered but never connected to any view element; all voice functionality lives in `channel_controller.js`. If kept, add a comment explaining why. *(Audit: ⚠️ item 11)*
- [x] **P2** Wire `media_controls_controller.js` to the `#channel-control-bar` via `data-controller="media-controls"` in `_control_bar.html.erb`, or remove it if the press animation is undesired. *(Audit: ⚠️ item 12)*
- [x] **P2** Verify `icon-192.png` and `icon-512.png` exist in `public/`; generate them from the SVG favicon if missing so PWA installation shows a proper icon rather than a broken image. *(Audit: ⚠️ item 14)*

---

## Milestone 2 — Bug Fixes & Regressions

> Correct behaviours that are coded but silently wrong.

- [x] **P0** Fix presence "away on tab hide" never reverting to "online": add a `visibilitychange` listener in `presence_channel.js` that calls `this.perform("online")` (needs a corresponding `online` action in `PresenceChannel`) when `document.hidden` becomes `false`. *(Audit: ⚠️ item 19)*
- [x] **P1** Protect announcement channels in `ChatChannel#receive`: add a check for `@room.announcement?` and only allow the message if `membership.admin?` (mirrors the HTTP controller guard). *(Audit: ⚠️ item 13)*
- [x] **P1** Fix in-call DataChannel chat not persisting for late joiners: when `channel_controller.js` sends an in-call message, also POST it to `MessagesController` with `message_context: "in_call"` so it is stored in the DB and visible to participants who join later. *(Audit: ⚠️ item 10)*
- [x] **P2** Thread panel real-time updates: after sending a thread reply, subscribe to `chat_#{room_id}` messages and re-render the thread panel when a message with a matching `parent_id` arrives — without requiring the panel to be closed and reopened. *(Audit: ⚠️ item 9)*

---

## Milestone 3 — E2EE Wiring

> The infrastructure (model, keys API, controller JS) exists but is never connected to the message flow.

- [x] **P1** Audit the current `e2ee_controller.js` implementation fully: confirm `encrypt()` and `decrypt()` are correct and that IndexedDB key storage/retrieval works end-to-end.
- [x] **P1** Wire `e2ee_controller.js` to the chat panel: add `data-controller="e2ee"` to the messages container in `_chat_panel.html.erb` when `room.e2ee?`, with the room slug as a value so the controller can fetch the correct room key.
- [x] **P1** Encrypt outgoing messages in `message_input_controller.js`: before sending, check if the room is E2EE (`data-e2ee` attribute on the form), call `e2ee.encrypt(body)`, and send `ciphertext` instead of `body`.
- [x] **P1** Decrypt incoming messages in `chat_controller.js`'s `appendMessage`: if `data.ciphertext` is present, call `e2ee.decrypt(ciphertext)` before rendering the message body.
- [x] **P2** Show a clear "[encrypted message — key not available]" fallback when decryption fails (e.g., key not yet exchanged).
- [x] **P2** Add key-exchange UX: when a user joins an E2EE room for the first time, prompt them to confirm key setup rather than silently failing. *(Audit: ⚠️ item 1)*

---

## Milestone 4 — DM Enhancements

> Direct messages are functional but lag behind channel features in several areas.

- [x] **P1** DM file attachments UI: add a file picker button to `direct_messages/show.html.erb` (mirror the channel compose area); update `dm_input_controller.js` to send `FormData` when files are selected; render attached images/files in `direct_messages/_message.html.erb`. The `DirectMessage` model already has `has_many_attached :files`. *(Audit: ⚠️ item 2 / ❌ item 12)*
- [x] **P1** DM reply-to: add a reply button to `direct_messages/_message.html.erb` (mirror channel message actions); update `dm_input_controller.js` to listen for `message:reply` events, show a reply banner, and include `parent_id` in the POST; render the parent quote in `_message.html.erb`. *(Audit: ⚠️ item 7)*
- [x] **P2** DM sounds: when `UserNotificationsChannel` receives a `new_dm` event and `document.body.dataset.dmSounds === "true"`, play a short notification sound. Expose the user preference as a `data-dm-sounds` attribute on `<body>` (set from the session in `application.html.erb`). *(Audit: ⚠️ item 3)*
- [x] **P2** DM emoji reactions: add a `DirectMessageReaction` model (or reuse `MessageReaction` polymorphically), a `DirectMessageReactionsController`, and wire the emoji picker in `dm_chat_controller.js`/`message_actions_controller.js` to the new endpoint. *(Audit: ❌ item 2)*

---

## Milestone 5 — Message & Channel UX Improvements

> Quality-of-life features that raise the functional parity with comparable chat platforms.

- [x] **P1** Message formatting (Markdown-lite): render `**bold**`, `*italic*`, `` `code` ``, and fenced code blocks in message bodies. Use a small, zero-dependency parser (e.g., `marked` with only inline rules) or write a minimal custom renderer. Sanitise all output to prevent XSS. *(Audit: ❌ item 11)*
- [x] **P1** Unread channel badges: track the last-read message ID per user per room (new `RoomReadState` model or a column on `RoomMembership`); broadcast a badge count via `user_#{id}` channel; update the sidebar channel item badge in `user_notifications_channel.js`. *(Audit: ⚠️ item 17)*
- [x] **P2** Search jump-to-message: in `search_controller.js` and `search/index.html.erb`, link message results to `/rooms/:slug#message-:id`; in `chat_controller.js` on `connect()`, check for a hash fragment and scroll + briefly highlight the matching message. *(Audit: ⚠️ item 8 / ❌ item 4)*
- [x] **P2** Typing indicator: broadcast a `typing` event over ActionCable when the user is typing (debounced, cleared after 3 s); render a "X is typing…" line above the compose area. *(Audit: ❌ item 15)*
- [x] **P2** Message pinning: add a `pinned` boolean to `Message`; add a pin/unpin action to `MessagesController` (admin/moderator only); display pinned messages in a collapsible banner at the top of the chat panel. *(Audit: ❌ item 9)*
- [x] **P3** Message history pagination / infinite scroll: on scroll-to-top in `chat_controller.js` and `dm_chat_controller.js`, fetch older messages via `GET /rooms/:slug/messages?before=:id` (new controller action); prepend them without losing scroll position. *(Audit: ⚠️ item 16)*

---

## Milestone 6 — Voice / Video Improvements

> Build on the working LiveKit foundation to close the remaining gaps.

- [x] **P1** Device picker UI: before (or shortly after) joining a call, present a modal or dropdown allowing users to select from `navigator.mediaDevices.enumerateDevices()` results; pass the chosen `deviceId` to `room.localParticipant.switchActiveDevice()`. *(Audit: ⚠️ item 6)*
- [x] **P1** Pre-call device test: add a "Test audio/video" modal that briefly enables mic + camera preview before the user clicks "Join", so they can confirm devices are working. *(Audit: ❌ item 3)*
- [x] **P2** Persistent call across Turbo navigation: store the active `LiveKit.Room` instance in a module-level singleton; intercept `turbo:before-visit` to either warn the user they will be disconnected or keep the call alive by suppressing the navigation (show a confirmation). *(Audit: ⚠️ item 20)*
- [ ] **P3** DM voice/video calls: add a "Start call" button on the DM page that creates a temporary private LiveKit room (slug = sorted user IDs); fetch a token and connect both participants. Requires a new controller action, client-side call panel, and signalling (via `UserNotificationsChannel`) to ring the recipient. *(Audit: ❌ item 1)* — Deferred to M6 follow-up

---

## Milestone 7 — User & Channel Management

> Account and moderation features that are missing or incomplete.

- [ ] **P1** Username change in account settings: add `:username` to the `devise/registrations/edit.html.erb` form and to `users/registrations_controller.rb`'s permitted params. Validate uniqueness in real time with a debounced fetch. *(Audit: ❌ item 5)*
- [ ] **P1** Role promotion/demotion in channel member list: add "Make admin", "Make moderator", "Remove role" actions to the member list (visible to channel admins); wire to a new `RoomMembershipsController` PATCH endpoint. *(Audit: ❌ item 8)*
- [ ] **P2** User blocking: add a `UserBlock` model (`blocker_id`, `blocked_id`); filter blocked users' messages from DMs and channels; add block/unblock action to user profile page. *(Audit: ❌ item 6)*
- [ ] **P3** Channel categories: add a `Category` model with a `name` and `position`; `Room` belongs_to `:category, optional: true`; render grouped sections in the sidebar and rooms index. *(Audit: ❌ item 7)*

---

## Milestone 8 — Notifications & Push

> Complete the notification system.

- [ ] **P1** `mention_alerts` preference respected in JS: read a `data-mention-alerts` attribute from `<body>` in `user_notifications_channel.js` and suppress the toast if the preference is off. Currently the preference is saved but never read client-side.
- [ ] **P2** Channel mention notifications (desktop push): extend the push notification path in `detect_mentions` (already exists for DMs) to also send a push notification for `@username` mentions in channels — this is already done in `MessagesController#detect_mentions`, verify it works end-to-end with VAPID keys configured.
- [ ] **P2** Push notification opt-in flow: show a "Enable notifications" prompt in the sidebar footer (once per session, only if `Notification.permission === "default"`) rather than silently requesting in the layout `<head>` script where user gesture is often not guaranteed. *(Related to Audit: ⚠️ push setup)*

---

## Milestone 9 — Admin & Audit Improvements

> Extend the admin panel to cover gaps identified in the audit.

- [ ] **P2** Audit log coverage: ensure `AuditService.log` is called for all significant admin actions — user lock/unlock, password reset, room deletion, permission changes. Review `admin_service.rb` and add missing calls.
- [ ] **P2** Admin: view and delete individual messages (for moderation) — link from audit log entries to the offending message in context.
- [ ] **P3** Admin: scheduled/pending invite cleanup — list expired invites and provide a "Purge expired" action.

---

## Milestone 10 — Polish & Accessibility

> Final pass on UX consistency and WCAG compliance.

- [ ] **P2** Consistent page title format: verify all views call `content_for :title` with a sensible value; pages that currently fall back to just "REDLINE" (e.g., user profile) should include the user's display name.
- [ ] **P2** Focus management after modal close: verify the search modal, new-DM modal, and bottom sheet all return focus to the trigger element on close. `bottom_sheet_controller.js` already tracks `_triggerElement`; confirm the others do too.
- [ ] **P2** Keyboard navigation within search results: add `ArrowDown`/`ArrowUp` to move between result items and `Enter` to follow the link, matching the Cmd+K palette UX pattern.
- [ ] **P2** `prefers-reduced-motion`: audit all CSS transitions and JS animations (bottom sheet slide, sidebar backdrop, toast fade) and wrap in `@media (prefers-reduced-motion: reduce)` or gate behind a JS check.
- [ ] **P3** Consistent empty-state illustrations: pages with empty states (no messages, no channels, no DMs) currently show plain text. Add a subtle SVG illustration for visual consistency.
- [ ] **P3** Loading skeleton for messages: on initial channel page load, show a skeleton loader while the 50 historical messages render, rather than a flash of blank space.

---

## Appendix — Issue Cross-Reference

| Audit item | Milestone | Priority |
|-----------|-----------|----------|
| ⚠️ 1 — E2EE not wired to chat | M3 | P1 |
| ⚠️ 2 — DM file attachments (no UI) | M4 | P1 |
| ⚠️ 3 — DM sounds preference stub | M4 | P2 |
| ⚠️ 4 — TURN / external LIVEKIT_URL | Documented in README (infra, not code) | — |
| ⚠️ 5 — No device picker UI | M6 | P1 |
| ⚠️ 6 — No DM reply/thread | M4 | P1 |
| ⚠️ 7 — DM reply feature absent | M4 | P1 |
| ⚠️ 8 — Search doesn't jump to message | M5 | P2 |
| ⚠️ 9 — Thread panel no real-time updates | M2 | P2 |
| ⚠️ 10 — In-call DataChannel chat ephemeral | M2 | P1 |
| ⚠️ 11 — `livekit_controller.js` orphaned | M1 | P1 |
| ⚠️ 12 — `media_controls_controller.js` not wired | M1 | P2 |
| ⚠️ 13 — Announcement channel unprotected via WS | M2 | P1 |
| ⚠️ 14 — PWA icons may be missing | M1 | P2 |
| ⚠️ 15 — No typing indicator | M5 | P2 |
| ⚠️ 16 — Message history no pagination | M5 | P3 |
| ⚠️ 17 — No unread channel badges | M5 | P1 |
| ⚠️ 18 — User bio not in DM view | M10 | P3 |
| ⚠️ 19 — Presence "away" never reverts | M2 | P0 |
| ⚠️ 20 — No persistent call across navigation | M6 | P2 |
| ❌ 1 — DM voice/video calls | M6 | P3 |
| ❌ 2 — DM emoji reactions | M4 | P2 |
| ❌ 3 — Pre-call device test | M6 | P1 |
| ❌ 4 — Search jump-to-message | M5 | P2 |
| ❌ 5 — Username change | M7 | P1 |
| ❌ 6 — User blocking | M7 | P2 |
| ❌ 7 — Channel categories | M7 | P3 |
| ❌ 8 — Role management UI in channel | M7 | P1 |
| ❌ 9 — Message pinning | M5 | P2 |
| ❌ 10 — Scheduled messages | Deferred — out of scope | — |
| ❌ 11 — Message formatting (Markdown) | M5 | P1 |
| ❌ 12 — DM file/image expansion | M4 | P1 |
| ❌ 13 — Persistent call panel across nav | M6 | P2 |
| ❌ 14 — Audit log coverage gaps | M9 | P2 |
