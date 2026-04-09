import { Controller } from "@hotwired/stimulus"

/**
 * Sidebar controller — handles mobile sidebar toggle with overlay.
 *
 * Accessibility:
 *  - aria-expanded on toggle button
 *  - Backdrop click closes sidebar
 *  - Escape closes the sidebar
 *  - Focus management
 */
export default class extends Controller {
  connect() {
    this.sidebar = document.getElementById("sidebar")
    this.backdrop = document.getElementById("sidebar-backdrop")
    this._onKeydown = this.onKeydown.bind(this)
    this._toggleButtons = document.querySelectorAll("[data-action*='sidebar#toggle']")
  }

  toggle() {
    if (this.sidebar?.classList.contains("open")) {
      this.close()
    } else {
      this.open()
    }
  }

  open() {
    if (!this.sidebar) return
    this.sidebar.classList.add("open")
    if (this.backdrop) this.backdrop.classList.add("sidebar-backdrop-visible")

    document.addEventListener("keydown", this._onKeydown)

    // Update all toggle buttons
    this._toggleButtons.forEach(btn => {
      btn.setAttribute("aria-expanded", "true")
    })
  }

  close() {
    if (!this.sidebar) return
    this.sidebar.classList.remove("open")
    if (this.backdrop) this.backdrop.classList.remove("sidebar-backdrop-visible")

    document.removeEventListener("keydown", this._onKeydown)

    // Update all toggle buttons
    this._toggleButtons.forEach(btn => {
      btn.setAttribute("aria-expanded", "false")
    })
  }

  onKeydown(event) {
    if (event.key === "Escape") this.close()
  }
}
