import { Controller } from "@hotwired/stimulus"

/**
 * Message input controller — handles:
 *  - Enter to send, Shift+Enter for newline
 *  - Auto-resize textarea
 *  - Minimum 44px touch target preserved
 *
 * Accessibility:
 *  - aria-describedby points to hint about keyboard shortcuts
 *  - Sends message via fetch, CSRF token included
 */
export default class extends Controller {
  static targets = ["field"]

  get roomId() {
    const url = window.location.pathname
    const parts = url.split("/").filter(Boolean)
    const idx = parts.indexOf("rooms")
    return idx >= 0 ? parts[idx + 1] : null
  }

  handleKeydown(event) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault()
      this.sendMessage()
    }
  }

  autoResize() {
    const field = this.fieldTarget
    field.style.height = "auto"
    field.style.height = Math.min(field.scrollHeight, 192) + "px"
  }

  send(event) {
    event.preventDefault()
    this.sendMessage()
  }

  async sendMessage() {
    const body = this.fieldTarget.value.trim()
    if (!body) return

    const roomSlug = this.roomId
    if (!roomSlug) return

    const csrf = document.querySelector('meta[name="csrf-token"]')?.content
    try {
      const response = await fetch(`/rooms/${roomSlug}/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": csrf ?? ""
        },
        body: JSON.stringify({ message: { body } })
      })

      if (response.ok) {
        const data = await response.json()
        this.fieldTarget.value = ""
        this.fieldTarget.style.height = "auto"
        this.displaySentMessage(data)
      } else {
        const data = await response.json().catch(() => ({}))
        this.announceError(data.errors?.join(", ") ?? "Failed to send message")
      }
    } catch (err) {
      this.announceError("Network error. Message not sent.")
    }
  }

  announceError(msg) {
    // Use an aria-live region for accessible error feedback
    let region = document.getElementById("message-error-announce")
    if (!region) {
      region = document.createElement("div")
      region.id = "message-error-announce"
      region.setAttribute("role", "alert")
      region.setAttribute("aria-live", "assertive")
      region.className = "sr-only"
      document.body.appendChild(region)
    }
    region.textContent = msg
    setTimeout(() => { region.textContent = "" }, 5000)
  }

  displaySentMessage(data) {
    // Skip if the message was already appended by ActionCable
    if (document.getElementById(`message-${data.id}`)) return

    const time = new Date(data.created_at)
    const displayTime = time.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    const isoTime = time.toISOString()

    const article = document.createElement("article")
    article.id = `message-${data.id}`
    article.className = "message-item"
    article.setAttribute("aria-label",
      `Message from ${data.display_name} at ${displayTime}`)

    article.innerHTML = `
      <div class="avatar avatar-md" style="background-color:${this.escapeHtml(data.avatar_color)}" aria-hidden="true">
        ${this.escapeHtml(data.initials)}
      </div>
      <div style="flex:1;min-width:0">
        <div class="flex items-baseline gap-2">
          <span class="font-semibold text-sm text-primary">${this.escapeHtml(data.display_name)}</span>
          <time datetime="${isoTime}" class="text-xs text-muted">${displayTime}</time>
        </div>
        <div class="message-body text-sm text-secondary mt-0.5 leading-relaxed whitespace-pre-wrap break-words" data-controller="link-preview">
          ${this.escapeHtml(data.body)}
        </div>
      </div>
    `

    const anchor = document.getElementById("messages-end")
    if (anchor) {
      anchor.before(article)
      // Auto-scroll to bottom
      const container = document.getElementById("messages")
      if (container) {
        container.scrollTo({ top: container.scrollHeight, behavior: "smooth" })
      }
    }
  }

  escapeHtml(str) {
    const div = document.createElement("div")
    div.appendChild(document.createTextNode(String(str ?? "")))
    return div.innerHTML
  }
}
