import { Controller } from "@hotwired/stimulus"

/**
 * LiveKit controller — manages WebRTC voice/video calls.
 *
 * Flow:
 *  1. User clicks a voice channel to Instant Join (no ringing)
 *  2. Fetch JWT token from server (room-scoped, user-scoped)
 *  3. Connect to LiveKit server via livekit-client SDK
 *  4. Auto-activate microphone on connect
 *  5. Subscribe to remote participant tracks and render tiles
 *  6. In-call text chat via LiveKit DataChannels
 *
 * Accessibility:
 *  - Call panel uses aria-live="polite" for participant announcements
 *  - Mute/Deafen/Screen share buttons use aria-pressed
 *  - All participant tiles have accessible labels
 *
 * NOTE: livekit-client is loaded from importmap / CDN.
 *       Set LIVEKIT_URL in your .env for the WebSocket endpoint.
 */
export default class extends Controller {
  static values = { tokenUrl: String }

  connect() {
    this.room = null
    this.localMicMuted = false
    this.localDeafened = false
    this.screenSharing = false
    this.canScreenShare = false
  }

  /**
   * Instant Join: user clicks voice channel, joins immediately
   * without ringing/calling. Microphone auto-activates.
   */
  async joinCall() {
    try {
      const data = await this.fetchToken()
      this.canScreenShare = data.can_screen_share || false
      await this.connectToRoom(data.token, data.url)
      document.getElementById("call-panel")?.classList.remove("hidden")
      document.getElementById("join-call-btn")?.setAttribute("aria-disabled", "true")

      // Show/hide screen share button based on permission
      const shareBtn = document.getElementById("toggle-screen-share")
      if (shareBtn) {
        shareBtn.classList.toggle("hidden", !this.canScreenShare)
      }

      // Show in-call chat panel for voice channels
      const chatPanel = document.getElementById("in-call-chat-panel")
      if (chatPanel && data.has_in_call_chat) {
        chatPanel.classList.remove("hidden")
      }

      this.announce("Joined the voice channel")
    } catch (err) {
      console.error("LiveKit join error:", err)
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

    this.room = new LK.Room({
      adaptiveStream: true,
      dynacast: true
    })

    this.room.on(LK.RoomEvent.ParticipantConnected, (p) => {
      this.announce(`${p.identity} joined the channel`)
      this.renderParticipant(p)
    })

    this.room.on(LK.RoomEvent.ParticipantDisconnected, (p) => {
      this.announce(`${p.identity} left the channel`)
      document.getElementById(`participant-${p.identity}`)?.remove()
    })

    this.room.on(LK.RoomEvent.TrackSubscribed, (track, _pub, participant) => {
      this.attachTrack(track, participant)
    })

    // Handle incoming DataChannel messages (in-call text chat)
    this.room.on(LK.RoomEvent.DataReceived, (payload, participant) => {
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

    await this.room.connect(url, token)

    // Auto-activate microphone on connect (Instant Join behavior)
    await this.room.localParticipant.setMicrophoneEnabled(true)
    this.renderLocalParticipant()
  }

  renderLocalParticipant() {
    const me = this.room?.localParticipant
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

      // Apply deafen state to new audio tracks
      if (this.localDeafened) {
        audio.muted = true
      }
    }
  }

  createTile(identity, label) {
    const tile = document.createElement("div")
    tile.id = `participant-${identity}`
    tile.className = "participant-tile"
    tile.setAttribute("role", "listitem")
    tile.setAttribute("aria-label", label)
    tile.innerHTML = `<span class="text-xs text-secondary">${this.escapeHtml(label)}</span>`
    return tile
  }

  /**
   * Toggle microphone mute/unmute
   */
  toggleMic() {
    if (!this.room) return
    this.localMicMuted = !this.localMicMuted
    this.room.localParticipant.setMicrophoneEnabled(!this.localMicMuted)

    const btn = document.getElementById("toggle-mic")
    if (btn) {
      btn.setAttribute("aria-pressed", String(this.localMicMuted))
      btn.textContent = this.localMicMuted ? "Unmute" : "Mute"
    }
    this.announce(this.localMicMuted ? "Microphone muted" : "Microphone unmuted")
  }

  /**
   * Toggle deafen — mutes all incoming audio
   */
  toggleDeafen() {
    if (!this.room) return
    this.localDeafened = !this.localDeafened

    // Mute/unmute all remote audio elements
    const audioElements = document.querySelectorAll("#call-participants audio")
    audioElements.forEach(audio => {
      audio.muted = this.localDeafened
    })

    const btn = document.getElementById("toggle-deafen")
    if (btn) {
      btn.setAttribute("aria-pressed", String(this.localDeafened))
      btn.textContent = this.localDeafened ? "Undeafen" : "Deafen"
    }
    this.announce(this.localDeafened ? "Audio deafened" : "Audio undeafened")
  }

  /**
   * Toggle screen sharing
   */
  async toggleScreenShare() {
    if (!this.room || !this.canScreenShare) return

    try {
      this.screenSharing = !this.screenSharing
      await this.room.localParticipant.setScreenShareEnabled(this.screenSharing)

      const btn = document.getElementById("toggle-screen-share")
      if (btn) {
        btn.setAttribute("aria-pressed", String(this.screenSharing))
        btn.textContent = this.screenSharing ? "Stop Sharing" : "Share Screen"
      }
      this.announce(this.screenSharing ? "Screen sharing started" : "Screen sharing stopped")
    } catch (err) {
      this.screenSharing = false
      console.error("Screen share error:", err)
      this.announce("Screen sharing failed: " + err.message)
    }
  }

  /**
   * Send an in-call text chat message via LiveKit DataChannel
   */
  sendInCallMessage() {
    if (!this.room) return

    const input = document.getElementById("in-call-chat-input")
    if (!input) return

    const body = input.value.trim()
    if (!body) return

    const me = this.room.localParticipant
    const message = {
      type: "chat",
      body: body,
      sender_id: me.identity,
      sender_name: me.name || me.identity,
      timestamp: new Date().toISOString()
    }

    const encoder = new TextEncoder()
    const data = encoder.encode(JSON.stringify(message))
    this.room.localParticipant.publishData(data, { reliable: true })

    // Also display locally
    this.appendInCallMessage(message, null)

    input.value = ""
  }

  /**
   * Handle Enter key in in-call chat input
   */
  handleInCallChatKeydown(event) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault()
      this.sendInCallMessage()
    }
  }

  /**
   * Append a message to the in-call chat area
   */
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

    // Auto-scroll chat
    container.scrollTo({ top: container.scrollHeight, behavior: "smooth" })
  }

  leaveCall() {
    this.room?.disconnect()
    this.room = null
    this.localMicMuted = false
    this.localDeafened = false
    this.screenSharing = false
    document.getElementById("call-panel")?.classList.add("hidden")
    document.getElementById("call-participants").innerHTML = ""
    document.getElementById("join-call-btn")?.removeAttribute("aria-disabled")

    // Hide in-call chat
    const chatPanel = document.getElementById("in-call-chat-panel")
    if (chatPanel) chatPanel.classList.add("hidden")
    const chatMessages = document.getElementById("in-call-chat-messages")
    if (chatMessages) chatMessages.innerHTML = ""

    // Reset button states
    const deafenBtn = document.getElementById("toggle-deafen")
    if (deafenBtn) {
      deafenBtn.setAttribute("aria-pressed", "false")
      deafenBtn.textContent = "Deafen"
    }
    const shareBtn = document.getElementById("toggle-screen-share")
    if (shareBtn) {
      shareBtn.setAttribute("aria-pressed", "false")
      shareBtn.textContent = "Share Screen"
    }

    this.announce("Left the voice channel")
  }

  announce(msg) {
    let region = document.getElementById("livekit-announce")
    if (!region) {
      region = document.createElement("div")
      region.id = "livekit-announce"
      region.setAttribute("role", "status")
      region.setAttribute("aria-live", "polite")
      region.className = "sr-only"
      document.body.appendChild(region)
    }
    region.textContent = msg
  }

  escapeHtml(str) {
    const div = document.createElement("div")
    div.appendChild(document.createTextNode(String(str ?? "")))
    return div.innerHTML
  }

  disconnect() {
    this.room?.disconnect()
  }
}
