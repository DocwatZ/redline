import { Controller } from "@hotwired/stimulus"

/**
 * StatusPickerController — dropdown in the sidebar footer for setting
 * the current user's online status.
 *
 * Targets:
 *   dot   — the .status-dot span showing current status colour
 *   label — the text showing current status name
 *   dropdown — the popup menu
 */
export default class extends Controller {
  static targets = ["dot", "label", "dropdown"]

  connect() {
    this._onOutsideClick = this.#onOutsideClick.bind(this)
  }

  toggle() {
    if (this.dropdownTarget.classList.contains("hidden")) {
      this.#open()
    } else {
      this.#close()
    }
  }

  async select(event) {
    const status = event.currentTarget.dataset.status
    const csrf   = document.querySelector('meta[name="csrf-token"]')?.content
    try {
      const res = await fetch("/users/status", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": csrf ?? ""
        },
        body: JSON.stringify({ status })
      })
      if (res.ok) {
        this.#updateDisplay(status)
        this.#close()
      }
    } catch (err) {
      console.error("Status update failed:", err)
    }
  }

  // ── Private ────────────────────────────────────────────────────────────────
  #open() {
    this.dropdownTarget.classList.remove("hidden")
    document.addEventListener("click", this._onOutsideClick)
  }

  #close() {
    this.dropdownTarget.classList.add("hidden")
    document.removeEventListener("click", this._onOutsideClick)
  }

  #updateDisplay(status) {
    if (this.hasDotTarget) {
      this.dotTarget.className = `status-dot status-${status}`
    }
    if (this.hasLabelTarget) {
      this.labelTarget.textContent = status.charAt(0).toUpperCase() + status.slice(1)
    }
  }

  #onOutsideClick(event) {
    if (!this.element.contains(event.target)) this.#close()
  }
}
