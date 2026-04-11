import { Controller } from "@hotwired/stimulus"

/**
 * Channel controller — unified state manager for the channel layout.
 *
 * Manages:
 *  - Voice/video call lifecycle (delegates to LiveKit)
 *  - Members panel toggle
 *  - Mobile/desktop layout state
 *  - Control bar visibility
 *
 * This controller replaces direct livekit_controller references in the
 * ERB template, providing a single coordination point.
 */
export default class extends Controller {
  static values = {
    roomSlug: String,
    voice: Boolean,
    tokenUrl: String
  }

  static MOBILE_BREAKPOINT = 769

  connect() {
    this.livekitRoom = null
    this._LK = null
    this.localMicMuted = false
    this.localDeafened = false
    this.screenSharing = false
    this.canScreenShare = false
    this.cameraEnabled = false
    this.inCall = false
    this._escapeEl = null

    this.membersVisible = !this.isMobile()
    this.updateMembersPanel()
    this.updateStatusDot("connected")

    // Listen for resize to handle responsive transitions
    this._onResize = this.handleResize.bind(this)
    window.addEventListener("resize", this._onResize)
  }

  disconnect() {
    this.livekitRoom?.disconnect()
    window.removeEventListener("resize", this._onResize)
  }

  // ─── Layout ──────────────────────────────────────────────────

  isMobile() {
    return window.innerWidth < this.constructor.MOBILE_BREAKPOINT
  }

  handleResize() {
    // On mobile, hide members panel; on desktop, show it
    if (this.isMobile() && this.membersVisible) {
      this.membersVisible = false
      this.updateMembersPanel()
      this.removeMembersBackdrop()
    }
  }

  toggleMembers() {
    this.membersVisible = !this.membersVisible
    this.updateMembersPanel()

    const btn = this.element.querySelector(".channel-members-toggle")
    if (btn) btn.setAttribute("aria-expanded", String(this.membersVisible))

    // On mobile, manage backdrop for members overlay
    if (this.isMobile()) {
      if (this.membersVisible) {
        this.addMembersBackdrop()
      } else {
        this.removeMembersBackdrop()
      }
    }
  }

  updateMembersPanel() {
    const panel = document.getElementById("members-panel")
    if (!panel) return

    if (this.membersVisible) {
      panel.classList.remove("hidden")
      panel.classList.add("channel-members-panel-visible")
    } else {
      panel.classList.add("hidden")
      panel.classList.remove("channel-members-panel-visible")
    }
  }

  updateStatusDot(state) {
    const dot = document.getElementById("channel-status-dot")
    if (!dot) return

    dot.classList.remove("channel-status-connected", "channel-status-connecting", "channel-status-disconnected")

    switch (state) {
      case "connected":
        dot.classList.add("channel-status-connected")
        dot.setAttribute("aria-label", "Connected")
        break
      case "connecting":
        dot.classList.add("channel-status-connecting")
        dot.setAttribute("aria-label", "Connecting")
        break
      case "disconnected":
        dot.classList.add("channel-status-disconnected")
        dot.setAttribute("aria-label", "Disconnected")
        break
    }
  }

  addMembersBackdrop() {
    if (document.getElementById("members-backdrop")) return

    const backdrop = document.createElement("div")
    backdrop.id = "members-backdrop"
    backdrop.className = "bottom-sheet-backdrop"
    backdrop.addEventListener("click", () => {
      this.toggleMembers()
    })
    document.body.appendChild(backdrop)

    requestAnimationFrame(() => {
      backdrop.classList.add("bottom-sheet-backdrop-visible")
    })
  }

  removeMembersBackdrop() {
    const backdrop = document.getElementById("members-backdrop")
    if (!backdrop) return

    backdrop.classList.remove("bottom-sheet-backdrop-visible")
    setTimeout(() => backdrop.remove(), 200)
  }

  // ─── Voice/Video Lifecycle ───────────────────────────────────

  async joinCall() {
    if (this.inCall || !this.voiceValue) return

    const loading = document.getElementById("call-loading")
    const callPanel = document.getElementById("call-panel")
    const controlBar = document.getElementById("channel-control-bar")

    // Show loading state
    if (callPanel) callPanel.classList.remove("hidden")
    if (loading) loading.classList.remove("hidden")
    this.updateStatusDot("connecting")

    try {
      const data = await this.fetchToken()
      this.canScreenShare = data.can_screen_share || false
      await this.connectToRoom(data.token, data.url)

      this.inCall = true
      this.updateStatusDot("connected")

      // Hide loading
      if (loading) loading.classList.add("hidden")

      // Show control bar
      if (controlBar) controlBar.classList.remove("hidden")

      // Show/hide screen share button
      const shareBtn = document.getElementById("toggle-screen-share")
      if (shareBtn) shareBtn.classList.toggle("hidden", !this.canScreenShare)

      // Show/hide camera button
      const cameraBtn = document.getElementById("toggle-camera")
      if (cameraBtn) cameraBtn.classList.toggle("hidden", !data.can_video)

      // Show in-call chat panel for voice channels
      const chatPanel = document.getElementById("in-call-chat-panel")
      if (chatPanel && data.has_in_call_chat) {
        chatPanel.classList.remove("hidden")
      }

      // Update join button
      const joinBtn = document.getElementById("join-call-btn")
      if (joinBtn) joinBtn.setAttribute("aria-disabled", "true")

      this.announce("Joined the voice channel")
    } catch (err) {
      console.error("Channel join error:", err)
      if (loading) loading.classList.add("hidden")
      this.updateStatusDot("disconnected")
      this.announce("Failed to join channel: " + err.message)
    }
  }

  async fetchToken() {
    const csrf = document.querySelector('meta[name="csrf-token"]')?.content
    const resp = await fetch(this.tokenUrlValue, {
      headers: { "X-CSRF-Token": csrf ?? "" }
    })
    if (!resp.ok) throw new Error("Token fetch failed")
    return resp.json()
  }

  async connectToRoom(token, url) {
    let LK
    try {
      LK = await import("livekit-client")
    } catch {
      throw new Error("LiveKit client library not loaded. Check importmap configuration.")
    }

    this._LK = LK

    this.livekitRoom = new LK.Room({
      adaptiveStream: true,
      dynacast: true
    })

    this.livekitRoom.on(LK.RoomEvent.ParticipantConnected, (p) => {
      this.announce(`${p.identity} joined the channel`)
      this.renderParticipant(p)
    })

    this.livekitRoom.on(LK.RoomEvent.ParticipantDisconnected, (p) => {
      this.announce(`${p.identity} left the channel`)
      document.getElementById(`participant-${p.identity}`)?.remove()
    })

    this.livekitRoom.on(LK.RoomEvent.TrackSubscribed, (track, _pub, participant) => {
      this.attachTrack(track, participant)
    })

    // Handle incoming DataChannel messages (in-call text chat)
    this.livekitRoom.on(LK.RoomEvent.DataReceived, (payload, participant) => {
      try {
        const decoder = new TextDecoder()
        const data = JSON.parse(decoder.decode(payload))
        if (data.type === "chat") {
          this.appendInCallMessage(data, participant)
        }
      } catch (e) {
        console.warn("Failed to parse DataChannel message:", e)
      }
    })

    // Handle reconnection events for unstable connections (especially mobile)
    this.livekitRoom.on(LK.RoomEvent.Reconnecting, () => {
      this.updateStatusDot("connecting")
      this.announce("Reconnecting to voice channel...")
    })

    this.livekitRoom.on(LK.RoomEvent.Reconnected, () => {
      this.updateStatusDot("connected")
      this.announce("Reconnected to voice channel")
    })

    this.livekitRoom.on(LK.RoomEvent.Disconnected, (reason) => {
      console.warn("LiveKit disconnected:", reason)
      this.updateStatusDot("disconnected")
      this.announce("Disconnected from voice channel")
      this.leaveCall()
    })

    // Handle track cleanup when remote participants stop publishing
    this.livekitRoom.on(LK.RoomEvent.TrackUnsubscribed, (track) => {
      track.detach().forEach(el => el.remove())
    })

    await this.livekitRoom.connect(url, token)
    await this.livekitRoom.localParticipant.setMicrophoneEnabled(true)
    this.renderLocalParticipant()
  }

  // ─── Participants ────────────────────────────────────────────

  renderLocalParticipant() {
    const me = this.livekitRoom?.localParticipant
    if (!me) return
    const tile = this.createTile(me.identity, me.identity + " (you)")
    document.getElementById("call-participants")?.appendChild(tile)
  }

  renderParticipant(participant) {
    const tile = this.createTile(participant.identity, participant.identity)
    document.getElementById("call-participants")?.appendChild(tile)
  }

  attachTrack(track, participant) {
    const LK = this._LK
    if (!LK) return

    const tile = document.getElementById(`participant-${participant.identity}`)
    if (!tile) return

    if (track.kind === LK.Track.Kind.Video) {
      const video = document.createElement("video")
      video.autoplay = true
      video.playsInline = true
      video.muted = true
      video.setAttribute("aria-label", `${participant.identity}'s video`)
      track.attach(video)
      tile.prepend(video)
    } else if (track.kind === LK.Track.Kind.Audio) {
      const audio = document.createElement("audio")
      audio.autoplay = true
      audio.setAttribute("aria-label", `${participant.identity}'s audio`)
      track.attach(audio)
      tile.appendChild(audio)
      if (this.localDeafened) audio.muted = true
    }
  }

  createTile(identity, label) {
    const tile = document.createElement("div")
    tile.id = `participant-${identity}`
    tile.className = "participant-tile"
    tile.setAttribute("role", "listitem")
    tile.setAttribute("aria-label", label)
    tile.innerHTML = `
      <div class="participant-tile-avatar">
        <span class="text-sm font-bold text-primary">${this.escapeHtml(identity.charAt(0).toUpperCase())}</span>
      </div>
      <span class="participant-tile-name">${this.escapeHtml(label)}</span>
    `
    return tile
  }

  // ─── Media Controls ──────────────────────────────────────────

  toggleMic() {
    if (!this.livekitRoom) return
    this.localMicMuted = !this.localMicMuted
    this.livekitRoom.localParticipant.setMicrophoneEnabled(!this.localMicMuted)

    const btn = document.getElementById("toggle-mic")
    if (btn) {
      btn.setAttribute("aria-pressed", String(this.localMicMuted))
      btn.classList.toggle("control-btn-active", this.localMicMuted)
      const label = btn.querySelector(".control-btn-label")
      if (label) label.textContent = this.localMicMuted ? "Unmute" : "Mute"
    }
    this.announce(this.localMicMuted ? "Microphone muted" : "Microphone unmuted")
  }

  toggleDeafen() {
    if (!this.livekitRoom) return
    this.localDeafened = !this.localDeafened

    const audioElements = document.querySelectorAll("#call-participants audio")
    audioElements.forEach(audio => { audio.muted = this.localDeafened })

    const btn = document.getElementById("toggle-deafen")
    if (btn) {
      btn.setAttribute("aria-pressed", String(this.localDeafened))
      btn.classList.toggle("control-btn-active", this.localDeafened)
      const label = btn.querySelector(".control-btn-label")
      if (label) label.textContent = this.localDeafened ? "Undeafen" : "Deafen"
    }
    this.announce(this.localDeafened ? "Audio deafened" : "Audio undeafened")
  }

  async toggleScreenShare() {
    if (!this.livekitRoom || !this.canScreenShare) return

    try {
      this.screenSharing = !this.screenSharing
      await this.livekitRoom.localParticipant.setScreenShareEnabled(this.screenSharing)

      const btn = document.getElementById("toggle-screen-share")
      if (btn) {
        btn.setAttribute("aria-pressed", String(this.screenSharing))
        btn.classList.toggle("control-btn-active", this.screenSharing)
        const label = btn.querySelector(".control-btn-label")
        if (label) label.textContent = this.screenSharing ? "Stop" : "Share"
      }
      this.announce(this.screenSharing ? "Screen sharing started" : "Screen sharing stopped")
    } catch (err) {
      this.screenSharing = false
      console.error("Screen share error:", err)
      this.announce("Screen sharing failed: " + err.message)
    }
  }

  toggleCamera() {
    if (!this.livekitRoom) return
    this.cameraEnabled = !this.cameraEnabled
    this.livekitRoom.localParticipant.setCameraEnabled(this.cameraEnabled)
    const btn = document.getElementById("toggle-camera")
    if (btn) {
      btn.setAttribute("aria-pressed", String(this.cameraEnabled))
      btn.classList.toggle("control-btn-active", this.cameraEnabled)
      const label = btn.querySelector(".control-btn-label")
      if (label) label.textContent = this.cameraEnabled ? "Stop Cam" : "Camera"
    }
    this.announce(this.cameraEnabled ? "Camera on" : "Camera off")
  }

  leaveCall() {
    this.livekitRoom?.disconnect()
    this.livekitRoom = null
    this.inCall = false
    this.localMicMuted = false
    this.localDeafened = false
    this.screenSharing = false
    this.cameraEnabled = false
    this.updateStatusDot("connected")

    document.getElementById("call-panel")?.classList.add("hidden")
    document.getElementById("channel-control-bar")?.classList.add("hidden")

    const participants = document.getElementById("call-participants")
    if (participants) participants.innerHTML = ""

    document.getElementById("join-call-btn")?.removeAttribute("aria-disabled")

    // Hide in-call chat
    const chatPanel = document.getElementById("in-call-chat-panel")
    if (chatPanel) chatPanel.classList.add("hidden")
    const chatMessages = document.getElementById("in-call-chat-messages")
    if (chatMessages) chatMessages.innerHTML = ""

    // Reset button states
    this.resetControlButton("toggle-mic", "Mute")
    this.resetControlButton("toggle-deafen", "Deafen")
    this.resetControlButton("toggle-screen-share", "Share")
    this.resetControlButton("toggle-camera", "Camera")
    const cameraBtn = document.getElementById("toggle-camera")
    if (cameraBtn) cameraBtn.classList.add("hidden")

    this.announce("Left the voice channel")
  }

  resetControlButton(id, label) {
    const btn = document.getElementById(id)
    if (!btn) return
    btn.setAttribute("aria-pressed", "false")
    btn.classList.remove("control-btn-active")
    const labelEl = btn.querySelector(".control-btn-label")
    if (labelEl) labelEl.textContent = label
  }

  // ─── In-Call Chat ────────────────────────────────────────────

  sendInCallMessage() {
    if (!this.livekitRoom) return

    const input = document.getElementById("in-call-chat-input")
    if (!input) return

    const body = input.value.trim()
    if (!body) return

    const me = this.livekitRoom.localParticipant
    const message = {
      type: "chat",
      body: body,
      sender_id: me.identity,
      sender_name: me.name || me.identity,
      timestamp: new Date().toISOString()
    }

    const encoder = new TextEncoder()
    const data = encoder.encode(JSON.stringify(message))
    this.livekitRoom.localParticipant.publishData(data, { reliable: true })

    this.appendInCallMessage(message, null)
    input.value = ""
  }

  handleInCallChatKeydown(event) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault()
      this.sendInCallMessage()
    }
  }

  appendInCallMessage(data, participant) {
    const container = document.getElementById("in-call-chat-messages")
    if (!container) return

    const senderName = data.sender_name || participant?.identity || "Unknown"
    const time = new Date(data.timestamp || Date.now())
    const displayTime = time.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })

    const msgEl = document.createElement("div")
    msgEl.className = "in-call-message py-1 px-2 text-sm"
    msgEl.setAttribute("role", "listitem")
    msgEl.innerHTML = `
      <span class="font-semibold text-xs text-primary">${this.escapeHtml(senderName)}</span>
      <time class="text-xs text-muted ml-1">${displayTime}</time>
      <div class="text-secondary text-sm break-words whitespace-pre-wrap">${this.escapeHtml(data.body)}</div>
    `

    container.appendChild(msgEl)
    container.scrollTo({ top: container.scrollHeight, behavior: "smooth" })
  }

  // ─── Utilities ───────────────────────────────────────────────

  announce(msg) {
    let region = document.getElementById("channel-announce")
    if (!region) {
      region = document.createElement("div")
      region.id = "channel-announce"
      region.setAttribute("role", "status")
      region.setAttribute("aria-live", "polite")
      region.className = "sr-only"
      document.body.appendChild(region)
    }
    region.textContent = msg
  }

  escapeHtml(str) {
    if (!this._escapeEl) {
      this._escapeEl = document.createElement("div")
    }
    this._escapeEl.textContent = String(str ?? "")
    return this._escapeEl.innerHTML
  }
}
