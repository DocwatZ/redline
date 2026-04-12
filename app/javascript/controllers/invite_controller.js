import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  static values = { roomSlug: String }
  static targets = ["link", "copyBtn"]

  connect() {
    this.fetchOrCreateInvite()
  }

  async fetchOrCreateInvite() {
    const csrf = document.querySelector('meta[name="csrf-token"]')?.content
    try {
      const resp = await fetch(`/rooms/${this.roomSlugValue}/invites`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Accept": "application/json", "X-CSRF-Token": csrf ?? "" },
        body: JSON.stringify({ max_uses: 0 })
      })
      if (!resp.ok) return
      const data = await resp.json()
      if (this.hasLinkTarget) this.linkTarget.value = data.url
    } catch (err) { console.error("Invite error:", err) }
  }

  async copyLink() {
    if (!this.hasLinkTarget || !this.linkTarget.value) return
    try {
      await navigator.clipboard.writeText(this.linkTarget.value)
      if (this.hasCopyBtnTarget) {
        const orig = this.copyBtnTarget.textContent
        this.copyBtnTarget.textContent = "Copied!"
        setTimeout(() => { this.copyBtnTarget.textContent = orig }, 2000)
      }
    } catch { this.linkTarget.select() }
  }
}
