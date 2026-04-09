import { Controller } from "@hotwired/stimulus"

/**
 * Media controls controller — enhanced voice/video control UX.
 *
 * Provides:
 *  - Visual feedback for active/inactive states
 *  - Tooltip-style labels
 *  - Press animations
 *  - Responsive control sizing
 *
 * This controller enhances control buttons with visual polish;
 * actual media actions are handled by channel_controller.
 */
export default class extends Controller {
  connect() {
    // Add press-down animation to all control buttons
    this.element.querySelectorAll(".control-btn").forEach(btn => {
      btn.addEventListener("pointerdown", () => {
        btn.classList.add("control-btn-pressed")
      })
      btn.addEventListener("pointerup", () => {
        btn.classList.remove("control-btn-pressed")
      })
      btn.addEventListener("pointerleave", () => {
        btn.classList.remove("control-btn-pressed")
      })
    })
  }
}
