import { Controller } from "@hotwired/stimulus"

/**
 * Bottom sheet controller — mobile-friendly slide-up panel.
 *
 * Used for in-call chat on mobile devices. Provides:
 *  - Slide-up animation from bottom
 *  - Drag handle to dismiss
 *  - Backdrop overlay
 *  - Escape key to close
 *  - Focus trap when open
 *
 * Accessibility:
 *  - aria-modal="true" when open
 *  - Focus returns to trigger element on close
 *  - Escape closes the sheet
 */
export default class extends Controller {
  static values = {
    panel: String
  }

  static ANIMATION_MS = 200

  connect() {
    this.isOpen = false
    this.startY = 0
    this.currentY = 0
    this._triggerElement = null
    this._onKeydown = this.handleKeydown.bind(this)
  }

  disconnect() {
    this.removeBackdrop()
    document.removeEventListener("keydown", this._onKeydown)
  }

  toggle(event) {
    if (this.isOpen) {
      this.close()
    } else {
      this._triggerElement = event?.currentTarget || null
      this.open()
    }
  }

  open() {
    this.isOpen = true
    const panel = this.getPanel()
    if (!panel) return

    panel.classList.remove("hidden")
    panel.classList.add("bottom-sheet-open")
    panel.setAttribute("aria-modal", "true")
    panel.setAttribute("role", "dialog")

    this.addBackdrop()
    document.addEventListener("keydown", this._onKeydown)

    // Focus the first input or the panel itself
    requestAnimationFrame(() => {
      const focusable = panel.querySelector("input, textarea, button")
      if (focusable) focusable.focus()
    })

    // Update toggle button state
    const toggleBtn = document.getElementById("toggle-chat-btn")
    if (toggleBtn) toggleBtn.setAttribute("aria-pressed", "true")
  }

  close() {
    this.isOpen = false
    const panel = this.getPanel()
    if (!panel) return

    panel.classList.remove("bottom-sheet-open")
    panel.removeAttribute("aria-modal")
    panel.removeAttribute("role")

    // On mobile, hide after animation
    setTimeout(() => {
      if (!this.isOpen) {
        panel.classList.add("hidden")
      }
    }, this.constructor.ANIMATION_MS)

    this.removeBackdrop()
    document.removeEventListener("keydown", this._onKeydown)

    // Restore focus
    if (this._triggerElement) {
      this._triggerElement.focus()
      this._triggerElement = null
    }

    // Update toggle button state
    const toggleBtn = document.getElementById("toggle-chat-btn")
    if (toggleBtn) toggleBtn.setAttribute("aria-pressed", "false")
  }

  // ─── Drag to dismiss ─────────────────────────────────────────

  startDrag(event) {
    this.startY = event.clientY || event.touches?.[0]?.clientY || 0
    this.currentY = this.startY

    const onMove = (e) => {
      this.currentY = e.clientY || e.touches?.[0]?.clientY || 0
      const delta = this.currentY - this.startY
      if (delta > 0) {
        const panel = this.getPanel()
        if (panel) {
          panel.style.transform = `translateY(${delta}px)`
        }
      }
    }

    const onEnd = () => {
      const delta = this.currentY - this.startY
      const panel = this.getPanel()
      if (panel) panel.style.transform = ""

      if (delta > 100) {
        this.close()
      }

      document.removeEventListener("pointermove", onMove)
      document.removeEventListener("pointerup", onEnd)
    }

    document.addEventListener("pointermove", onMove)
    document.addEventListener("pointerup", onEnd)
  }

  // ─── Helpers ─────────────────────────────────────────────────

  getPanel() {
    if (this.panelValue) {
      return document.getElementById(this.panelValue)
    }
    return this.element
  }

  addBackdrop() {
    if (document.getElementById("bottom-sheet-backdrop")) return

    const backdrop = document.createElement("div")
    backdrop.id = "bottom-sheet-backdrop"
    backdrop.className = "bottom-sheet-backdrop"
    backdrop.addEventListener("click", () => this.close())
    document.body.appendChild(backdrop)

    // Trigger animation
    requestAnimationFrame(() => {
      backdrop.classList.add("bottom-sheet-backdrop-visible")
    })
  }

  removeBackdrop() {
    const backdrop = document.getElementById("bottom-sheet-backdrop")
    if (!backdrop) return

    backdrop.classList.remove("bottom-sheet-backdrop-visible")
    setTimeout(() => backdrop.remove(), this.constructor.ANIMATION_MS)
  }

  handleKeydown(event) {
    if (event.key === "Escape") {
      event.preventDefault()
      this.close()
    }
  }
}
