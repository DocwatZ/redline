import { Controller } from "@hotwired/stimulus"
import consumer from "channels/consumer"

/**
 * Chat controller — manages the room's ActionCable subscription,
 * renders incoming messages, and auto-scrolls to the bottom.
 *
 * Accessibility:
 *  - Messages container uses role="log" aria-live="polite" so screen readers
 *    announce new messages without interrupting the user.
 *  - Auto-scroll only fires when the user is already at the bottom.
 */
export default class extends Controller {
  static values = { roomId: Number }

  connect() {
    this.subscription = consumer.subscriptions.create(
      { channel: "ChatChannel", room_id: this.roomIdValue },
      {
        received: (data) => this.appendMessage(data),
        rejected: () => console.warn("ChatChannel subscription rejected")
      }
    )
    this.scrollToBottom(false)
  }

  disconnect() {
    this.subscription?.unsubscribe()
  }

  appendMessage(data) {
    const wasAtBottom = this.isAtBottom()
    const existing = document.getElementById(`message-${data.id}`)

    if (existing) {
      // Update existing message (edit / delete)
      // Replace the message-body element to re-trigger link-preview controller
      const oldBody = existing.querySelector(".message-body")
      if (oldBody) {
        const newBody = document.createElement("div")
        newBody.className = data.deleted
          ? "message-body deleted"
          : "message-body"
        if (!data.deleted) {
          newBody.setAttribute("data-controller", "link-preview")
        }
        newBody.textContent = data.body
        oldBody.replaceWith(newBody)
      }
      return
    }

    const el = this.buildMessageElement(data)
    const anchor = document.getElementById("messages-end")
    if (anchor) anchor.before(el)

    if (wasAtBottom) this.scrollToBottom(true)

    // Announce to screen readers if tab is visible
    if (!document.hidden) {
      el.setAttribute("aria-label", `New message from ${data.display_name}`)
    }
  }

  buildMessageElement(data) {
    const article = document.createElement("article")
    article.id = `message-${data.id}`
    article.className = "message-item"
    article.setAttribute("aria-label",
      `Message from ${data.display_name} at ${this.formatTime(data.created_at)}`)

    const time = new Date(data.created_at)
    const displayTime = time.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    const isoTime = time.toISOString()

    article.innerHTML = `
      <div class="avatar avatar-md" style="background-color:${this.escapeHtml(data.avatar_color)}" aria-hidden="true">
        ${this.escapeHtml(data.initials)}
      </div>
      <div style="flex:1;min-width:0">
        <div class="flex items-baseline gap-2">
          <span class="font-semibold text-sm text-primary">${this.escapeHtml(data.display_name)}</span>
          <time datetime="${isoTime}" class="text-xs text-muted">${displayTime}</time>
          ${data.edited ? '<span class="text-xs text-muted" aria-label="edited">(edited)</span>' : ""}
        </div>
        <div class="message-body${data.deleted ? " deleted" : ""}"${data.deleted ? "" : ' data-controller="link-preview"'}>
          ${this.escapeHtml(data.body)}
        </div>
      </div>
    `
    return article
  }

  scrollToBottom(smooth = true) {
    const el = this.element
    el.scrollTo({ top: el.scrollHeight, behavior: smooth ? "smooth" : "instant" })
  }

  isAtBottom() {
    const el = this.element
    return el.scrollHeight - el.scrollTop - el.clientHeight < 100
  }

  formatTime(iso) {
    return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
  }

  escapeHtml(str) {
    const div = document.createElement("div")
    div.appendChild(document.createTextNode(String(str ?? "")))
    return div.innerHTML
  }
}
