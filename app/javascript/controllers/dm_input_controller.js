import { Controller } from "@hotwired/stimulus"
import { openComposeEmojiPicker, insertAtCursor } from "controllers/compose_helpers"

/**
 * DM input controller — same as message-input but for direct messages.
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

  get partnerId() {
    const url = window.location.pathname
    const match = url.match(/\/users\/(\d+)\//)
    return match ? match[1] : null
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
                data-action="click->dm-input#removeFile" data-index="${i}"
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

    const partnerId = this.partnerId
    if (!partnerId) return

    const csrf = document.querySelector('meta[name="csrf-token"]')?.content

    try {
      let response
      if (hasFiles) {
        const formData = new FormData()
        formData.append("direct_message[body]", body)
        if (this._replyParentId) formData.append("direct_message[parent_id]", this._replyParentId)
        this._selectedFiles.forEach(f => formData.append("direct_message[files][]", f))
        response = await fetch(`/users/${partnerId}/direct_messages`, {
          method: "POST",
          headers: {
            "Accept": "application/json",
            "X-CSRF-Token": csrf ?? ""
          },
          body: formData
        })
      } else {
        const payload = { body }
        if (this._replyParentId) payload.parent_id = this._replyParentId
        response = await fetch(`/users/${partnerId}/direct_messages`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Accept": "application/json",
            "X-CSRF-Token": csrf ?? ""
          },
          body: JSON.stringify({ direct_message: payload })
        })
      }

      if (response.ok) {
        this.fieldTarget.value = ""
        this.fieldTarget.style.height = "auto"
        this._selectedFiles = []
        if (this.hasFileInputTarget) this.fileInputTarget.value = ""
        this.#renderFilePreview()
        this.clearReply()
      }
    } catch (err) {
      console.error("DM send error:", err)
    }
  }

  escapeHtml(str) {
    const div = document.createElement("div")
    div.appendChild(document.createTextNode(String(str ?? "")))
    return div.innerHTML
  }

  // ── Private ────────────────────────────────────────────────────────────────
  #handleReply(event) {
    if (event.detail.type && event.detail.type !== "dm") return
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
