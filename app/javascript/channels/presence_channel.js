import consumer from "channels/consumer"

// Presence channel — keeps user status in sync
const presenceSubscription = consumer.subscriptions.create("PresenceChannel", {
  connected() {
    // Report visibility changes for away status
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        this.perform("away")
      }
    })
  },

  disconnected() {},

  received(data) {
    // Update status indicator for a user in the sidebar
    const indicator = document.querySelector(`[data-user-id="${data.user_id}"] .status-dot`)
    if (indicator) {
      indicator.className = `status-dot status-${data.status}`
      indicator.setAttribute("aria-label", data.status)
    }
  }
})

export default presenceSubscription
