import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  static targets = ["modal", "input", "results"]

  connect() {
    this._onKeydown = this.handleGlobalKeydown.bind(this)
    document.addEventListener("keydown", this._onKeydown)
    this._debounceTimer = null
  }

  disconnect() {
    document.removeEventListener("keydown", this._onKeydown)
    clearTimeout(this._debounceTimer)
  }

  handleGlobalKeydown(e) {
    if ((e.metaKey || e.ctrlKey) && e.key === "k") { e.preventDefault(); this.open() }
    if (e.key === "Escape") this.close()
  }

  open() {
    if (!this.hasModalTarget) return
    this.modalTarget.classList.remove("hidden")
    this.modalTarget.setAttribute("aria-hidden", "false")
    this.inputTarget?.focus()
  }

  close() {
    if (!this.hasModalTarget) return
    this.modalTarget.classList.add("hidden")
    this.modalTarget.setAttribute("aria-hidden", "true")
  }

  handleInput() {
    clearTimeout(this._debounceTimer)
    this._debounceTimer = setTimeout(() => this.search(), 300)
  }

  handleInputKeydown(e) {
    if (e.key === "Escape") this.close()
  }

  async search() {
    const q = this.inputTarget?.value?.trim()
    if (!q || q.length < 2) { if (this.hasResultsTarget) this.resultsTarget.innerHTML = ""; return }
    try {
      const resp = await fetch(`/search?q=${encodeURIComponent(q)}`, { headers: { "Accept": "application/json" } })
      if (!resp.ok) return
      const data = await resp.json()
      this.renderResults(data)
    } catch (err) { console.error("Search error:", err) }
  }

  renderResults(data) {
    if (!this.hasResultsTarget) return
    let html = ""
    if (data.users?.length) {
      html += `<div class="search-result-section"><div class="search-result-section-title">People</div>`
      data.users.forEach(u => {
        html += `<a href="/users/${u.id}" class="search-result-item">
          <div style="width:1.5rem;height:1.5rem;border-radius:50%;background:${u.avatar_color};display:flex;align-items:center;justify-content:center;font-size:.6rem;color:#fff;flex-shrink:0">${u.initials}</div>
          <div><div style="font-size:.875rem;color:var(--rl-text-primary)">${u.display_name}</div><div style="font-size:.75rem;color:var(--rl-text-muted)">@${u.username}</div></div>
        </a>`
      })
      html += "</div>"
    }
    if (data.messages?.length) {
      html += `<div class="search-result-section"><div class="search-result-section-title">Messages</div>`
      data.messages.forEach(m => {
        html += `<a href="/rooms/${m.room_slug}" class="search-result-item">
          <div style="flex:1;min-width:0">
            <div style="font-size:.75rem;color:var(--rl-text-muted)">#${m.room_name} · ${m.display_name}</div>
            <div style="font-size:.875rem;color:var(--rl-text-secondary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${m.body}</div>
          </div>
        </a>`
      })
      html += "</div>"
    }
    if (!html) html = `<div style="padding:1rem;text-align:center;color:var(--rl-text-muted);font-size:.875rem">No results for "${this.inputTarget.value}"</div>`
    this.resultsTarget.innerHTML = html
  }
}
