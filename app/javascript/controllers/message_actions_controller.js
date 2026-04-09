import { Controller } from "@hotwired/stimulus"

/**
 * MessageActionsController — inline edit, delete, and reply for both
 * channel messages and direct messages.
 *
 * Values:
 *  messageId   — database ID of the message
 *  isOwn       — true when the message belongs to the current user
 *  body        — current raw body text (kept in sync after edits)
 *  type        — "channel" or "dm"
 *
 * Targets:
 *  bodyDiv   — the rendered message text element
 *  editForm  — the hidden inline-edit wrapper
 *  editField — the <textarea> inside editForm
 */
export default class extends Controller {
  static values = {
    messageId: Number,
    isOwn:     Boolean,
    body:      String,
    type:      String
  }

  static targets = ["bodyDiv", "editForm", "editField"]

  // ── Reply ──────────────────────────────────────────────────────────────────
  reply() {
    const authorEl = this.element.querySelector(".msg-author")
    const displayName = authorEl ? authorEl.textContent.trim() : "someone"
    document.dispatchEvent(new CustomEvent("message:reply", {
      detail: {
        messageId:   this.messageIdValue,
        displayName: displayName,
        body:        this.bodyValue
      }
    }))
  }

  // ── Edit ───────────────────────────────────────────────────────────────────
  startEdit() {
    if (!this.hasEditFormTarget) return
    this.bodyDivTarget.classList.add("hidden")
    this.editFormTarget.classList.remove("hidden")
    this.editFieldTarget.value = this.bodyValue
    this.editFieldTarget.focus()
    // Move cursor to end
    const len = this.editFieldTarget.value.length
    this.editFieldTarget.setSelectionRange(len, len)
  }

  cancelEdit() {
    if (!this.hasEditFormTarget) return
    this.editFormTarget.classList.add("hidden")
    this.bodyDivTarget.classList.remove("hidden")
  }

  handleEditKeydown(event) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault()
      this.saveEdit()
    }
    if (event.key === "Escape") {
      this.cancelEdit()
    }
  }

  async saveEdit() {
    if (!this.hasEditFieldTarget) return
    const body = this.editFieldTarget.value.trim()
    if (!body || body === this.bodyValue) {
      this.cancelEdit()
      return
    }

    const url  = this.#messageUrl()
    if (!url) return
    const csrf = document.querySelector('meta[name="csrf-token"]')?.content

    try {
      const response = await fetch(url, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "Accept":        "application/json",
          "X-CSRF-Token":  csrf ?? ""
        },
        body: JSON.stringify(
          this.typeValue === "dm"
            ? { direct_message: { body } }
            : { message:        { body } }
        )
      })
      if (response.ok) {
        // The ActionCable broadcast will update the visible body;
        // keep our local copy in sync so cancel still works.
        this.bodyValue = body
        this.cancelEdit()
      }
    } catch (err) {
      console.error("Message edit failed:", err)
    }
  }

  // ── Delete ─────────────────────────────────────────────────────────────────
  async confirmDelete() {
    if (!confirm("Delete this message?")) return

    const url  = this.#messageUrl()
    if (!url) return
    const csrf = document.querySelector('meta[name="csrf-token"]')?.content

    try {
      const response = await fetch(url, {
        method: "DELETE",
        headers: {
          "Accept":       "application/json",
          "X-CSRF-Token": csrf ?? ""
        }
      })
      if (!response.ok) {
        console.error("Message delete failed:", response.status)
      }
    } catch (err) {
      console.error("Message delete error:", err)
    }
  }

  // ── Private helpers ────────────────────────────────────────────────────────
  #messageUrl() {
    if (this.typeValue === "dm") {
      return `/direct_messages/${this.messageIdValue}`
    }
    // Derive room slug from current URL: /rooms/:slug/…
    const parts = window.location.pathname.split("/").filter(Boolean)
    const idx   = parts.indexOf("rooms")
    const slug  = idx >= 0 ? parts[idx + 1] : null
    return slug ? `/rooms/${slug}/messages/${this.messageIdValue}` : null
  }
}
