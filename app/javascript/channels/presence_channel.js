import consumer from "channels/consumer"

// Presence channel — keeps user status and room presence in sync
const presenceSubscription = consumer.subscriptions.create("PresenceChannel", {
  connected() {
    // Report visibility changes for away/online status
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        this.perform("away")
      } else {
        this.perform("online")
      }
    })
  },

  disconnected() {},

  received(data) {
    if (data.type === "room_presence") {
      handleRoomPresence(data)
      return
    }

    // Update status indicator for a user in the sidebar
    const indicator = document.querySelector(`[data-user-id="${data.user_id}"] .status-dot`)
    if (indicator) {
      indicator.className = `status-dot status-${data.status}`
      indicator.setAttribute("aria-label", data.status)
    }
  }
})

function handleRoomPresence(data) {
  const container = document.querySelector(`.nav-room-viewers[data-room-slug="${data.room_slug}"]`)
  if (!container) return

  if (data.action === "enter") {
    // Avoid duplicates
    if (container.querySelector(`[data-presence-user-id="${data.user_id}"]`)) return

    const avatar = document.createElement("span")
    avatar.className = "nav-presence-avatar"
    avatar.dataset.presenceUserId = data.user_id
    avatar.setAttribute("aria-label", data.display_name)
    avatar.setAttribute("title", data.display_name)
    avatar.textContent = data.initials
    avatar.style.backgroundColor = data.avatar_color

    container.appendChild(avatar)
    container.classList.remove("hidden")
  } else if (data.action === "leave") {
    const avatar = container.querySelector(`[data-presence-user-id="${data.user_id}"]`)
    if (avatar) avatar.remove()
    if (container.children.length === 0) container.classList.add("hidden")
  }
}

export default presenceSubscription
