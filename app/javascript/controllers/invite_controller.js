import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  static values = { roomSlug: String }
  static targets = ["modal", "link", "copyBtn"]

  connect() {
    this._onKeydown = (e) => { if (e.key === "Escape") this.close() }
    document.addEventListener("keydown", this._onKeydown)
  }

  disconnect() {
    document.removeEventListener("keydown", this._onKeydown)
  }

  async open() {
    if (!this.hasModalTarget) return
    this.modalTarget.classList.remove("hidden")
    await this.fetchOrCreateInvite()
  }

  close() {
    if (!this.hasModalTarget) return
    this.modalTarget.classList.add("hidden")
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
    if (!this.hasLinkTarget) return
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
