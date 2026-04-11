import { Controller } from "@hotwired/stimulus"
import consumer from "channels/consumer"

/**
 * DM Chat controller — mirrors ChatController but for direct messages.
 */
export default class extends Controller {
  static values = { partnerId: Number, currentUserId: Number }

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
    if (data.type === "read_receipt") { this.markMessagesRead(data); return }
    const wasAtBottom = this.isAtBottom()
    const existing = document.getElementById(`dm-${data.id}`)

    if (existing) {
      // Edit / delete update
      const oldBody = existing.querySelector(".message-body")
      if (oldBody) {
        const newBody = document.createElement("div")
        newBody.className = data.deleted ? "message-body deleted" : "message-body"
        if (!data.deleted) newBody.setAttribute("data-controller", "link-preview")
        newBody.textContent = data.body
        oldBody.replaceWith(newBody)
        existing.setAttribute("data-message-actions-body-value", data.deleted ? "" : data.body)
      }
      if (data.edited && !data.deleted) {
        const timeRow = existing.querySelector(".msg-time-row")
        if (timeRow && !timeRow.querySelector(".msg-edited")) {
          const badge = document.createElement("span")
          badge.className = "text-xs text-muted msg-edited"
          badge.setAttribute("aria-label", "edited")
          badge.textContent = "(edited)"
          timeRow.appendChild(badge)
        }
      }
      if (data.deleted) {
        existing.querySelector(".message-actions-row")?.remove()
        existing.querySelector("[data-message-actions-target='editForm']")?.remove()
      }
      return
    }

    const el = this.buildMessageElement(data)
    const anchor = document.getElementById("dm-messages-end")
    if (anchor) anchor.before(el)
    if (wasAtBottom) this.scrollToBottom(true)
  }

  buildMessageElement(data) {
    const isOwn = data.sender_id === this.currentUserIdValue
    const time  = new Date(data.created_at)
    const displayTime = time.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    const isoTime     = time.toISOString()

    const article = document.createElement("article")
    article.id = `dm-${data.id}`
    article.className = "flex gap-3 py-1 px-2 rounded hover:bg-surface-elevated/50 group relative"
    article.setAttribute("aria-label", `Direct message from ${data.display_name}`)
    article.setAttribute("data-controller", "message-actions")
    article.setAttribute("data-message-actions-message-id-value", data.id)
    article.setAttribute("data-message-actions-is-own-value", String(isOwn))
    article.setAttribute("data-message-actions-body-value", data.deleted ? "" : data.body)
    article.setAttribute("data-message-actions-type-value", "dm")

    const editedBadge = (data.edited && !data.deleted)
      ? '<span class="text-xs text-muted msg-edited" aria-label="edited">(edited)</span>'
      : ""

    const bodyClass = data.deleted
      ? "message-body text-sm text-secondary mt-0.5 leading-relaxed whitespace-pre-wrap break-words italic text-muted"
      : "message-body text-sm text-secondary mt-0.5 leading-relaxed whitespace-pre-wrap break-words"
    const bodyLp = data.deleted ? "" : ' data-controller="link-preview"'

    const actionBtns = (!data.deleted && isOwn) ? `
      <div class="message-actions-row" role="group" aria-label="Message actions">
        <button type="button" class="btn-icon btn-icon-xs" title="Edit"
                aria-label="Edit this message"
                data-action="click->message-actions#startEdit">
          <svg aria-hidden="true" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
          </svg>
        </button>
        <button type="button" class="btn-icon btn-icon-xs" title="Delete"
                aria-label="Delete this message"
                data-action="click->message-actions#confirmDelete">
          <svg aria-hidden="true" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
          </svg>
        </button>
      </div>` : ""

    const editForm = (!data.deleted && isOwn) ? `
      <div class="hidden" data-message-actions-target="editForm">
        <textarea class="input-field w-full resize-none mt-1" rows="2" maxlength="4000"
                  aria-label="Edit message"
                  data-message-actions-target="editField"
                  data-action="keydown->message-actions#handleEditKeydown"></textarea>
        <div class="flex gap-2 mt-1">
          <button type="button" class="btn btn-primary" style="min-height:1.75rem;padding:.25rem .75rem;font-size:.75rem"
                  data-action="click->message-actions#saveEdit">Save</button>
          <button type="button" class="btn btn-ghost" style="min-height:1.75rem;padding:.25rem .75rem;font-size:.75rem"
                  data-action="click->message-actions#cancelEdit">Cancel</button>
        </div>
      </div>` : ""

    article.innerHTML = `
      <div class="flex-shrink-0 mt-0.5" aria-hidden="true">
        <div class="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold"
             style="background-color:${this.escapeHtml(data.avatar_color)}">
          ${this.escapeHtml(data.initials)}
        </div>
      </div>
      <div style="flex:1;min-width:0">
        <div class="flex items-baseline gap-2 flex-wrap msg-time-row">
          <span class="font-semibold text-sm text-primary msg-author">${this.escapeHtml(data.display_name)}</span>
          <time datetime="${isoTime}" class="text-xs text-muted">${displayTime}</time>
          ${editedBadge}
        </div>
        <div class="${bodyClass}"${bodyLp}
             data-message-actions-target="bodyDiv">
          ${this.escapeHtml(data.body)}
        </div>
        ${editForm}
      </div>
      ${actionBtns}
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

  markMessagesRead(data) {
    // When the partner reads, upgrade single ✓ to ✓✓ on all own sent messages
    const container = this.element
    const ownMessages = container.querySelectorAll("article[id^='dm-']")
    let lastOwn = null
    ownMessages.forEach(article => {
      const isOwn = article.dataset.messageActionsIsOwnValue === "true"
      if (isOwn) lastOwn = article
    })
    if (!lastOwn) return

    // Remove any existing single check from prior last message
    container.querySelectorAll(".dm-single-check").forEach(el => el.remove())

    // Set ✓✓ on the last own message
    const timeRow = lastOwn.querySelector(".msg-time-row")
    if (timeRow) {
      let check = timeRow.querySelector(".dm-read-check")
      if (!check) {
        check = document.createElement("span")
        check.className = "text-xs text-muted dm-read-check"
        check.setAttribute("aria-label", "Read")
        check.textContent = "✓✓"
        timeRow.appendChild(check)
      }
    }
  }
}
