import { Controller } from "@hotwired/stimulus"
import consumer from "channels/consumer"
import { formatMessage } from "controllers/markdown_controller"

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
  static values = { roomId: Number, roomSlug: String, currentUserId: Number }

  connect() {
    this.subscription = consumer.subscriptions.create(
      { channel: "ChatChannel", room_id: this.roomIdValue },
      {
        received: (data) => this.appendMessage(data),
        rejected: () => console.warn("ChatChannel subscription rejected")
      }
    )
    this.scrollToBottom(false)
    this._highlightAnchoredMessage()
    this._threadMessageId = null
    this._handleOpenThread = (e) => this.openThread(e.detail.messageId)
    document.addEventListener("message:open-thread", this._handleOpenThread)

    // Decrypt any server-rendered E2EE messages on initial page load
    this._decryptExistingMessages()
  }

  disconnect() {
    this.subscription?.unsubscribe()
    document.removeEventListener("message:open-thread", this._handleOpenThread)
  }

  appendMessage(data) {
    if (data.type === "reaction_update") { this.updateReactions(data); return }

    // If the thread panel is open and this message is a reply to the thread's parent, append it
    if (this._threadMessageId && data.parent_id === this._threadMessageId) {
      const threadContainer = document.getElementById("thread-messages")
      if (threadContainer && !threadContainer.querySelector(`[data-thread-msg-id="${data.id}"]`)) {
        const el = this.buildThreadMessage(data)
        el.setAttribute("data-thread-msg-id", data.id)
        threadContainer.appendChild(el)
        threadContainer.scrollTop = threadContainer.scrollHeight
      }
    }

    // Decrypt E2EE messages before rendering
    if (data.ciphertext) {
      this._decryptAndRender(data)
      return
    }

    this._renderMessage(data)
  }

  async _decryptAndRender(data) {
    const decryptedBody = await this._tryDecrypt(data.ciphertext)
    data.body = decryptedBody
    this._renderMessage(data)
  }

  _renderMessage(data) {
    const wasAtBottom = this.isAtBottom()
    const existing = document.getElementById(`message-${data.id}`)

    if (existing) {
      // Update body text
      const oldBody = existing.querySelector(".message-body")
      if (oldBody) {
        const newBody = document.createElement("div")
        newBody.className = data.deleted ? "message-body deleted" : "message-body"
        if (!data.deleted) newBody.setAttribute("data-controller", "link-preview")
        newBody.textContent = data.body
        oldBody.replaceWith(newBody)
        // Sync body value on the message-actions controller
        existing.setAttribute("data-message-actions-body-value", data.deleted ? "" : data.body)
      }
      // Show/hide edited badge
      const timeRow = existing.querySelector(".msg-time-row")
      if (timeRow) {
        let editedBadge = timeRow.querySelector(".msg-edited")
        if (data.edited && !data.deleted && !editedBadge) {
          editedBadge = document.createElement("span")
          editedBadge.className = "text-xs text-muted msg-edited"
          editedBadge.setAttribute("aria-label", "edited")
          editedBadge.textContent = "(edited)"
          timeRow.appendChild(editedBadge)
        }
      }
      // Hide action buttons on deleted messages
      if (data.deleted) {
        const actionsRow = existing.querySelector(".message-actions-row")
        if (actionsRow) actionsRow.remove()
        const editForm = existing.querySelector("[data-message-actions-target='editForm']")
        if (editForm) editForm.remove()
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
    const isOwn = data.user_id === this.currentUserIdValue
    const time  = new Date(data.created_at)
    const displayTime = time.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    const isoTime     = time.toISOString()

    const article = document.createElement("article")
    article.id = `message-${data.id}`
    article.className = "flex gap-3 py-1 px-2 rounded hover:bg-surface-elevated/50 group relative"
    article.setAttribute("aria-label", `Message from ${data.display_name} at ${displayTime}`)
    article.setAttribute("data-controller", "message-actions")
    article.setAttribute("data-message-actions-message-id-value", data.id)
    article.setAttribute("data-message-actions-is-own-value", String(isOwn))
    article.setAttribute("data-message-actions-body-value", data.deleted ? "" : data.body)
    article.setAttribute("data-message-actions-type-value", "channel")

    const parentQuote = data.parent
      ? `<div class="message-reply-quote">
           <span class="message-reply-quote-author">${this.escapeHtml(data.parent.display_name)}</span>
           <span class="message-reply-quote-body">${this.escapeHtml(data.parent.body)}</span>
         </div>`
      : ""

    const editedBadge = (data.edited && !data.deleted)
      ? '<span class="text-xs text-muted msg-edited" aria-label="edited">(edited)</span>'
      : ""

    const bodyClass = data.deleted
      ? "message-body text-sm text-secondary mt-0.5 leading-relaxed whitespace-pre-wrap break-words italic text-muted"
      : "message-body text-sm text-secondary mt-0.5 leading-relaxed whitespace-pre-wrap break-words"
    const bodyLp = data.deleted ? "" : ' data-controller="link-preview"'

    const actionBtns = (!data.deleted) ? `
      <div class="message-actions-row" role="group" aria-label="Message actions">
        <button type="button" class="btn-icon btn-icon-xs" title="Reply"
                aria-label="Reply to this message"
                data-action="click->message-actions#reply">
          <svg aria-hidden="true" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M3 10h10a8 8 0 018 8v2M3 10l6 6M3 10l6-6"/>
          </svg>
        </button>
        ${isOwn ? `
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
        </button>` : ""}
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
        ${parentQuote}
        <div class="flex items-baseline gap-2 flex-wrap msg-time-row">
          <span class="font-semibold text-sm text-primary msg-author">${this.escapeHtml(data.display_name)}</span>
          <time datetime="${isoTime}" class="text-xs text-muted">${displayTime}</time>
          ${editedBadge}
        </div>
        <div class="${bodyClass}"${bodyLp}
             data-message-actions-target="bodyDiv">
          ${data.deleted ? this.escapeHtml(data.body) : formatMessage(data.body)}
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

  _highlightAnchoredMessage() {
    const hash = window.location.hash
    if (!hash.startsWith("#message-")) return
    const id = hash.replace("#message-", "")
    const el = document.getElementById(`message-${id}`)
    if (!el) return
    el.scrollIntoView({ behavior: "smooth", block: "center" })
    el.classList.add("message-highlight")
    setTimeout(() => el.classList.remove("message-highlight"), 2000)
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

  updateReactions(data) {
    const msg = document.getElementById(`message-${data.message_id}`)
    if (!msg) return
    let reactionsEl = msg.querySelector(".message-reactions")
    if (!reactionsEl) {
      reactionsEl = document.createElement("div")
      reactionsEl.className = "message-reactions"
      reactionsEl.setAttribute("data-message-id", data.message_id)
      const bodyDiv = msg.querySelector(".message-body")
      if (bodyDiv) bodyDiv.after(reactionsEl)
      else return
    }
    const addBtn = reactionsEl.querySelector(".reaction-add-btn")
    reactionsEl.innerHTML = ""
    data.reactions.forEach(r => {
      const btn = document.createElement("button")
      btn.className = `reaction-pill${r.reacted ? " reaction-pill-active" : ""}`
      btn.setAttribute("data-action", "click->message-actions#toggleReaction")
      btn.setAttribute("data-emoji", r.emoji)
      btn.setAttribute("aria-label", `${r.emoji} ${r.count}`)
      btn.innerHTML = `${this.escapeHtml(r.emoji)} <span class="reaction-count">${r.count}</span>`
      reactionsEl.appendChild(btn)
    })
    if (addBtn) reactionsEl.appendChild(addBtn)
  }

  highlightMentions(text) {
    const escaped = this.escapeHtml(text)
    return escaped.replace(/@([a-zA-Z0-9_\-]+)/g, (_m, u) => `<span class="mention-pill">@${u}</span>`)
  }

  // ── Thread panel ──────────────────────────────────────────────────────────

  openThread(messageId) {
    this._threadMessageId = messageId
    const panel = document.getElementById("thread-panel")
    if (!panel) return

    fetch(`/rooms/${this.roomSlugValue}/messages/${messageId}/thread`, {
      headers: { "Accept": "application/json", "X-Requested-With": "XMLHttpRequest" }
    })
      .then(r => r.json())
      .then(data => {
        this.renderThread(data)
        panel.classList.add("open")
        panel.setAttribute("aria-hidden", "false")
      })
      .catch(err => console.error("Thread load error:", err))
  }

  closeThread() {
    const panel = document.getElementById("thread-panel")
    if (!panel) return
    panel.classList.remove("open")
    panel.setAttribute("aria-hidden", "true")
    this._threadMessageId = null
  }

  renderThread(data) {
    const container = document.getElementById("thread-messages")
    if (!container) return
    container.innerHTML = ""

    const all = [data.parent, ...data.replies]
    all.forEach(msg => {
      const el = this.buildThreadMessage(msg)
      el.setAttribute("data-thread-msg-id", msg.id)
      container.appendChild(el)
    })
    container.scrollTop = container.scrollHeight
  }

  buildThreadMessage(msg) {
    const article = document.createElement("article")
    article.className = "flex gap-2 py-1 px-1"
    article.innerHTML = `
      <div class="flex-shrink-0 mt-0.5" aria-hidden="true">
        <div class="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold"
             style="background-color:${this.escapeHtml(msg.avatar_color)}">
          ${this.escapeHtml(msg.initials)}
        </div>
      </div>
      <div class="flex-1 min-w-0">
        <div class="flex items-baseline gap-2">
          <span class="font-semibold text-xs text-primary">${this.escapeHtml(msg.display_name)}</span>
          <time class="text-xs text-muted">${this.formatTime(msg.created_at)}</time>
        </div>
        <div class="text-sm text-secondary mt-0.5 leading-relaxed whitespace-pre-wrap break-words">
          ${formatMessage(msg.body)}
        </div>
      </div>`
    return article
  }

  handleThreadKeydown(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      this.sendThreadReply()
    }
  }

  sendThreadReply() {
    if (!this._threadMessageId) return
    const input = document.getElementById("thread-reply-input")
    if (!input) return
    const body = input.value.trim()
    if (!body) return

    const token = document.querySelector('meta[name="csrf-token"]')?.content
    fetch(`/rooms/${this.roomSlugValue}/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "X-CSRF-Token": token || ""
      },
      body: JSON.stringify({ message: { body, parent_id: this._threadMessageId } })
    })
      .then(r => r.json())
      .then(() => {
        input.value = ""
        this.openThread(this._threadMessageId)
      })
      .catch(err => console.error("Thread reply error:", err))
  }

  // ── E2EE helpers ──────────────────────────────────────────────────────────

  static E2EE_INIT_DELAY_MS = 500
  static E2EE_KEY_POLL_INTERVAL_MS = 500
  static E2EE_MAX_KEY_POLL_ATTEMPTS = 10

  _getE2eeController() {
    const app = this.application
    return app.getControllerForElementAndIdentifier(this.element, "e2ee")
  }

  async _tryDecrypt(ciphertext) {
    try {
      const e2ee = this._getE2eeController()
      if (e2ee && e2ee.isReady()) {
        return await e2ee.decrypt(ciphertext)
      }
      return "\u{1F512} [encrypted message \u2014 key not available]"
    } catch (err) {
      console.warn("[E2EE] Decryption failed:", err)
      return "\u{1F512} [encrypted message \u2014 decryption failed]"
    }
  }

  async _decryptExistingMessages() {
    // Find all server-rendered messages that have ciphertext
    const encryptedMessages = this.element.querySelectorAll("[data-ciphertext]")
    if (encryptedMessages.length === 0) return

    // Wait briefly for the e2ee controller to initialize
    await new Promise(resolve => setTimeout(resolve, this.constructor.E2EE_INIT_DELAY_MS))

    const e2ee = this._getE2eeController()
    if (!e2ee) return

    // Wait for the room key to load (poll with timeout)
    let attempts = 0
    while (!e2ee.isReady() && attempts < this.constructor.E2EE_MAX_KEY_POLL_ATTEMPTS) {
      await new Promise(resolve => setTimeout(resolve, this.constructor.E2EE_KEY_POLL_INTERVAL_MS))
      attempts++
    }

    for (const msgEl of encryptedMessages) {
      const ciphertext = msgEl.getAttribute("data-ciphertext")
      if (!ciphertext) continue

      const bodyDiv = msgEl.querySelector(".message-body")
      if (!bodyDiv) continue

      const decrypted = await this._tryDecrypt(ciphertext)
      bodyDiv.textContent = decrypted

      // Update message-actions body value for edit/reply
      msgEl.setAttribute("data-message-actions-body-value", decrypted)
    }
  }
}
