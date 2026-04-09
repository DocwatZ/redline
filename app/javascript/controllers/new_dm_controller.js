import { Controller } from "@hotwired/stimulus"

/**
 * NewDmController — manages the "Start a new DM" modal.
 *
 * Expects a backdrop element as the controller root with:
 *   data-controller="new-dm"
 *   data-new-dm-target="modal"      — the modal card
 *   data-new-dm-target="searchInput"
 *   data-new-dm-target="userList"
 */
export default class extends Controller {
  static targets = ["modal", "searchInput", "userList"]

  connect() {
    this._users = null
    this._onKeydown = this.#onKeydown.bind(this)
  }

  async open() {
    this.element.classList.remove("hidden")
    this.element.setAttribute("aria-hidden", "false")
    document.addEventListener("keydown", this._onKeydown)
    this.searchInputTarget.focus()

    if (!this._users) {
      this.userListTarget.innerHTML = '<p style="padding:.75rem;color:var(--rl-text-muted);font-size:.875rem">Loading…</p>'
      await this.#loadUsers()
    }
    this.#renderUsers(this._users || [])
  }

  close() {
    this.element.classList.add("hidden")
    this.element.setAttribute("aria-hidden", "true")
    document.removeEventListener("keydown", this._onKeydown)
    if (this.hasSearchInputTarget) this.searchInputTarget.value = ""
  }

  closeOnBackdrop(event) {
    if (event.target === this.element) this.close()
  }

  search() {
    const q = this.searchInputTarget.value.toLowerCase()
    const filtered = (this._users || []).filter(u =>
      u.display_name.toLowerCase().includes(q) ||
      (u.username || "").toLowerCase().includes(q)
    )
    this.#renderUsers(filtered)
  }

  // ── Private ────────────────────────────────────────────────────────────────
  async #loadUsers() {
    const csrf = document.querySelector('meta[name="csrf-token"]')?.content
    try {
      const res = await fetch("/users.json", {
        headers: { "Accept": "application/json", "X-CSRF-Token": csrf ?? "" }
      })
      if (res.ok) this._users = await res.json()
    } catch (err) {
      console.error("NewDm: failed to load users", err)
    }
  }

  #renderUsers(users) {
    if (!users.length) {
      this.userListTarget.innerHTML = '<p style="padding:.75rem;color:var(--rl-text-muted);font-size:.875rem">No users found.</p>'
      return
    }
    this.userListTarget.innerHTML = users.map(u => `
      <a href="/users/${u.id}/direct_messages"
         class="new-dm-user-item"
         aria-label="Start DM with ${this.#esc(u.display_name)}">
        <span class="avatar avatar-sm" style="background-color:${this.#esc(u.avatar_color)}" aria-hidden="true">
          ${this.#esc(u.initials)}
        </span>
        <span style="flex:1;min-width:0;overflow:hidden">
          <span class="new-dm-user-name">${this.#esc(u.display_name)}</span>
          <span class="new-dm-user-username"> @${this.#esc(u.username || "")}</span>
        </span>
        <span class="status-dot status-${this.#esc(u.status)}" aria-hidden="true"></span>
      </a>
    `).join("")
  }

  #esc(str) {
    const d = document.createElement("div")
    d.appendChild(document.createTextNode(String(str ?? "")))
    return d.innerHTML
  }

  #onKeydown(event) {
    if (event.key === "Escape") this.close()
  }
}
