import consumer from "channels/consumer"

/**
 * Subscribes to the current user's personal notification stream.
 * Updates sidebar DM unread badges in real-time when a new DM arrives.
 */
consumer.subscriptions.create("UserNotificationsChannel", {
  received(data) {
    if (data.type !== "new_dm") return

    const senderId = data.sender_id
    // Find the DM link in the sidebar for this sender
    const link = document.querySelector(`[data-dm-partner-id="${senderId}"]`)
    if (!link) return

    // Do not badge if the user is currently viewing this conversation
    // Use exact segment matching to avoid false matches (e.g. /users/1/ vs /users/10/)
    const pathParts = window.location.pathname.split("/")
    const userIdx = pathParts.indexOf("users")
    const currentPartnerId = userIdx >= 0 ? pathParts[userIdx + 1] : null
    const onDmPage = currentPartnerId === String(senderId) &&
                     pathParts.includes("direct_messages")
    if (onDmPage) return

    let badge = link.querySelector(".dm-unread-badge")
    if (badge) {
      const count = parseInt(badge.textContent || "0", 10) + 1
      badge.textContent = count > 99 ? "99+" : count
    } else {
      badge = document.createElement("span")
      badge.className = "dm-unread-badge"
      badge.setAttribute("aria-label", "unread messages")
      badge.textContent = "1"
      link.appendChild(badge)
    }
  }
})
