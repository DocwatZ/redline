import consumer from "channels/consumer"

function showToast(title, body) {
  let container = document.querySelector(".toast-container")
  if (!container) {
    container = document.createElement("div")
    container.className = "toast-container"
    document.body.appendChild(container)
  }
  const toast = document.createElement("div")
  toast.className = "toast"
  toast.setAttribute("role", "alert")
  toast.innerHTML = `<div class="toast-title">${title}</div><div class="toast-body">${body.substring(0, 100)}</div>`
  container.appendChild(toast)
  setTimeout(() => toast.remove(), 5000)
}

/**
 * Subscribes to the current user's personal notification stream.
 * Updates sidebar DM unread badges in real-time when a new DM arrives.
 * Also handles @mention toasts and DM read receipts.
 */
consumer.subscriptions.create("UserNotificationsChannel", {
  received(data) {
    if (data.type === "new_dm") {
      const senderId = data.sender_id
      const link = document.querySelector(`[data-dm-partner-id="${senderId}"]`)
      if (!link) return

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
    } else if (data.type === "mention") {
      showToast(`Mentioned in #${data.room_name}`, `${data.sender_name}: ${data.body_preview}`)
    } else if (data.type === "dm_read") {
      const dmEl = document.getElementById(`dm-${data.message_id}`)
      if (!dmEl) return
      let receipt = dmEl.querySelector(".dm-read-receipt")
      if (!receipt) {
        receipt = document.createElement("div")
        receipt.className = "dm-read-receipt"
        dmEl.querySelector(".flex-1")?.appendChild(receipt)
      }
      receipt.textContent = "✓✓ Read"
    }
  }
})
