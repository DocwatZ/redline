import { Controller } from "@hotwired/stimulus"
import { formatMessage } from "controllers/markdown_controller"
import { openComposeEmojiPicker, insertAtCursor } from "controllers/compose_helpers"

/**
 * Message input controller — handles:
 *  - Enter to send, Shift+Enter for newline
 *  - Auto-resize textarea
 *  - Reply-to state (banner + parent_id in request)
 *  - File attachment (button + drag-and-drop)
 *  - Emoji insert picker
 *
 * Accessibility:
 *  - aria-describedby points to hint about keyboard shortcuts
 *  - Sends message via fetch, CSRF token included
 */
export default class extends Controller {
  static targets = ["field", "replyBanner", "replyAuthor", "replyPreview", "fileInput", "filePreview"]

  connect() {
    this._replyParentId = null
    this._selectedFiles = []
    this._onReply = this.#handleReply.bind(this)
    document.addEventListener("message:reply", this._onReply)
  }

  disconnect() {
    document.removeEventListener("message:reply", this._onReply)
    document.querySelectorAll(".compose-emoji-picker").forEach(p => p.remove())
  }
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
    this.onTyping()
  }

  onTyping() {
    clearTimeout(this._typingDebounce)
    this._typingDebounce = setTimeout(() => {
      document.dispatchEvent(new CustomEvent("message:typing"))
    }, 500)
  }

  send(event) {
    event.preventDefault()
    this.sendMessage()
  }

  clearReply() {
    this._replyParentId = null
    if (this.hasReplyBannerTarget) {
      this.replyBannerTarget.classList.add("hidden")
    }
  }

  openFilePicker() {
    if (this.hasFileInputTarget) this.fileInputTarget.click()
  }

  filesSelected() {
    if (!this.hasFileInputTarget) return
    this._selectedFiles = Array.from(this.fileInputTarget.files)
    this.#renderFilePreview()
  }

  removeFile(event) {
    const idx = parseInt(event.currentTarget.dataset.index, 10)
    this._selectedFiles.splice(idx, 1)
    this.#renderFilePreview()
  }

  // ── Drag-and-drop ─────────────────────────────────────────────────────────
  dragOver(event) {
    event.preventDefault()
    this.element.classList.add("compose-drag-over")
  }

  dragLeave(event) {
    // Only remove the class when leaving the compose element entirely
    if (!this.element.contains(event.relatedTarget)) {
      this.element.classList.remove("compose-drag-over")
    }
  }

  drop(event) {
    event.preventDefault()
    this.element.classList.remove("compose-drag-over")
    const files = Array.from(event.dataTransfer?.files ?? [])
    if (files.length === 0) return
    this._selectedFiles = [...this._selectedFiles, ...files]
    this.#renderFilePreview()
  }

  // ── Emoji insert picker ───────────────────────────────────────────────────
  openEmojiPicker(event) {
    openComposeEmojiPicker(event.currentTarget, (emoji) => {
      insertAtCursor(this.fieldTarget, emoji)
      this.autoResize()
    })
  }

  #renderFilePreview() {
    if (!this.hasFilePreviewTarget) return
    if (this._selectedFiles.length === 0) {
      this.filePreviewTarget.classList.add("hidden")
      this.filePreviewTarget.innerHTML = ""
      return
    }
    this.filePreviewTarget.classList.remove("hidden")
    this.filePreviewTarget.innerHTML = this._selectedFiles.map((f, i) => `
      <div class="file-chip" style="gap:.375rem">
        <span title="${this.escapeHtml(f.name)}" style="max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${this.escapeHtml(f.name)}</span>
        <button type="button" class="btn-icon btn-icon-xs" title="Remove"
                data-action="click->message-input#removeFile" data-index="${i}"
                aria-label="Remove ${this.escapeHtml(f.name)}" style="padding:0;min-height:auto;min-width:auto">
          &times;
        </button>
      </div>
    `).join("")
  }

  async sendMessage() {
    const body = this.fieldTarget.value.trim()
    const hasFiles = this._selectedFiles && this._selectedFiles.length > 0
    if (!body && !hasFiles) return

    const roomSlug = this.roomId
    if (!roomSlug) return

    const csrf = document.querySelector('meta[name="csrf-token"]')?.content

    // Check if this room uses E2EE
    const messagesDiv = document.getElementById("messages")
    const isE2ee = messagesDiv?.dataset?.e2eeE2eeEnabledValue === "true"
    let e2eeController = null
    if (isE2ee) {
      const app = this.application
      e2eeController = app.getControllerForElementAndIdentifier(messagesDiv, "e2ee")
      if (!e2eeController || !e2eeController.isReady()) {
        this.announceError("E2EE key not ready — cannot send encrypted message")
        return
      }
    }

    try {
      let response
      if (hasFiles) {
        // Use FormData for file uploads
        const formData = new FormData()

        if (isE2ee && e2eeController) {
          const ciphertext = await e2eeController.encrypt(body)
          formData.append("message[ciphertext]", ciphertext)
        } else {
          formData.append("message[body]", body)
        }

        if (this._replyParentId) formData.append("message[parent_id]", this._replyParentId)
        this._selectedFiles.forEach(f => formData.append("message[files][]", f))

        response = await fetch(`/rooms/${roomSlug}/messages`, {
          method: "POST",
          headers: {
            "Accept": "application/json",
            "X-CSRF-Token": csrf ?? ""
          },
          body: formData
        })
      } else {
        const payload = {}

        if (isE2ee && e2eeController) {
          payload.ciphertext = await e2eeController.encrypt(body)
        } else {
          payload.body = body
        }

        if (this._replyParentId) payload.parent_id = this._replyParentId

        response = await fetch(`/rooms/${roomSlug}/messages`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Accept": "application/json",
            "X-CSRF-Token": csrf ?? ""
          },
          body: JSON.stringify({ message: payload })
        })
      }

      if (response.ok) {
        const data = await response.json()
        this.fieldTarget.value = ""
        this.fieldTarget.style.height = "auto"
        this._selectedFiles = []
        if (this.hasFileInputTarget) this.fileInputTarget.value = ""
        this.#renderFilePreview()
        this.clearReply()
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
    article.className = "flex gap-3 py-1 px-2 rounded hover:bg-surface-elevated/50 group relative"
    article.setAttribute("aria-label", `Message from ${data.display_name} at ${displayTime}`)
    article.setAttribute("data-controller", "message-actions")
    article.setAttribute("data-message-actions-message-id-value", data.id)
    article.setAttribute("data-message-actions-is-own-value", "true")
    article.setAttribute("data-message-actions-body-value", data.body)
    article.setAttribute("data-message-actions-type-value", "channel")

    const parentQuote = data.parent
      ? `<div class="message-reply-quote">
           <span class="message-reply-quote-author">${this.escapeHtml(data.parent.display_name)}</span>
           <span class="message-reply-quote-body">${this.escapeHtml(data.parent.body)}</span>
         </div>`
      : ""

    article.innerHTML = `
      <div class="flex-shrink-0 mt-0.5" aria-hidden="true">
        <div class="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold"
             style="background-color:${this.escapeHtml(data.avatar_color)}">
          ${this.escapeHtml(data.initials)}
        </div>
      </div>
      <div style="flex:1;min-width:0">
        ${parentQuote}
        <div class="flex items-baseline gap-2 msg-time-row">
          <span class="font-semibold text-sm text-primary msg-author">${this.escapeHtml(data.display_name)}</span>
          <time datetime="${isoTime}" class="text-xs text-muted">${displayTime}</time>
        </div>
        <div class="message-body text-sm text-secondary mt-0.5 leading-relaxed whitespace-pre-wrap break-words"
             data-controller="link-preview"
             data-message-actions-target="bodyDiv">
          ${formatMessage(data.body)}
        </div>
        ${this.#renderFilesHtml(data.files || [])}
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
        </div>
      </div>
      <div class="message-actions-row" role="group" aria-label="Message actions">
        <button type="button" class="btn-icon btn-icon-xs" title="Reply"
                aria-label="Reply to this message"
                data-action="click->message-actions#reply">
          <svg aria-hidden="true" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M3 10h10a8 8 0 018 8v2M3 10l6 6M3 10l6-6"/>
          </svg>
        </button>
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
      </div>
    `

    const anchor = document.getElementById("messages-end")
    if (anchor) {
      anchor.before(article)
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

  #renderFilesHtml(files) {
    if (!files || files.length === 0) return ""
    const items = files.map(f => {
      if (f.image) {
        return `<a href="${this.escapeHtml(f.url)}" target="_blank" rel="noopener noreferrer">
          <img src="${this.escapeHtml(f.url)}" alt="${this.escapeHtml(f.filename)}" loading="lazy"
               style="max-width:320px;max-height:240px;border-radius:var(--rl-radius-sm);margin-top:.25rem;cursor:pointer">
        </a>`
      }
      return `<a href="${this.escapeHtml(f.url)}" class="file-download-link" target="_blank" rel="noopener noreferrer" download="${this.escapeHtml(f.filename)}" aria-label="Download ${this.escapeHtml(f.filename)}">
        <svg aria-hidden="true" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
        </svg>
        <span>${this.escapeHtml(f.filename)}</span>
      </a>`
    }).join("")
    return `<div class="message-attachments">${items}</div>`
  }

  // ── Private ────────────────────────────────────────────────────────────────
  #handleReply(event) {
    if (event.detail.type === "dm") return  // DM replies handled by dm-input
    this._replyParentId = event.detail.messageId
    if (this.hasReplyBannerTarget) {
      this.replyBannerTarget.classList.remove("hidden")
    }
    if (this.hasReplyAuthorTarget) {
      this.replyAuthorTarget.textContent = event.detail.displayName
    }
    if (this.hasReplyPreviewTarget) {
      const preview = String(event.detail.body ?? "").slice(0, 80)
      this.replyPreviewTarget.textContent = preview
    }
    this.fieldTarget.focus()
  }
}
