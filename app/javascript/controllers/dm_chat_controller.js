import { Controller } from "@hotwired/stimulus"
import consumer from "channels/consumer"

/**
 * DM Chat controller — mirrors ChatController but for direct messages.
 */
export default class extends Controller {
  static values = { partnerId: Number }

  connect() {
    this.subscription = consumer.subscriptions.create(
      { channel: "DirectMessageChannel", partner_id: this.partnerIdValue },
      {
        received: (data) => this.appendMessage(data),
        rejected: () => console.warn("DirectMessageChannel rejected")
      }
    )
    this.scrollToBottom(false)
  }

  disconnect() {
    this.subscription?.unsubscribe()
  }

  appendMessage(data) {
    const wasAtBottom = this.isAtBottom()
    const el = this.buildMessageElement(data)
    const anchor = document.getElementById("dm-messages-end")
    if (anchor) anchor.before(el)
    if (wasAtBottom) this.scrollToBottom(true)
  }

  buildMessageElement(data) {
    const article = document.createElement("article")
    article.id = `dm-${data.id}`
    article.className = "message-item"
    article.setAttribute("aria-label",
      `Direct message from ${data.display_name}`)

    const time = new Date(data.created_at)
    const displayTime = time.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })

    article.innerHTML = `
      <div class="avatar avatar-md" style="background-color:${this.escapeHtml(data.avatar_color)}" aria-hidden="true">
        ${this.escapeHtml(data.initials)}
      </div>
      <div style="flex:1;min-width:0">
        <div class="flex items-baseline gap-2">
          <span class="font-semibold text-sm text-primary">${this.escapeHtml(data.display_name)}</span>
          <time datetime="${time.toISOString()}" class="text-xs text-muted">${displayTime}</time>
        </div>
        <div class="message-body" data-controller="link-preview">${this.escapeHtml(data.body)}</div>
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

  escapeHtml(str) {
    const div = document.createElement("div")
    div.appendChild(document.createTextNode(String(str ?? "")))
    return div.innerHTML
  }
}
