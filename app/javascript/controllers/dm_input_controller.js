import { Controller } from "@hotwired/stimulus"

/**
 * DM input controller — same as message-input but for direct messages.
 */
export default class extends Controller {
  static targets = ["field"]

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

  async sendMessage() {
    const body = this.fieldTarget.value.trim()
    if (!body) return

    const partnerId = this.partnerId
    if (!partnerId) return

    const csrf = document.querySelector('meta[name="csrf-token"]')?.content
    try {
      const response = await fetch(`/users/${partnerId}/direct_messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json",
          "X-CSRF-Token": csrf ?? ""
        },
        body: JSON.stringify({ direct_message: { body } })
      })

      if (response.ok) {
        this.fieldTarget.value = ""
        this.fieldTarget.style.height = "auto"
      }
    } catch (err) {
      console.error("DM send error:", err)
    }
  }
}
