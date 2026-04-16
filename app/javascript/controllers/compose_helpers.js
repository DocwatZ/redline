/**
 * Shared helpers for compose input controllers (message-input, dm-input).
 * Extracted to avoid duplicating emoji picker logic in both controllers.
 */

export const INSERT_EMOJI = [
  "😀","😂","😍","🥰","😎","🤔","😢","😡","🤩","🥳",
  "👍","👎","❤️","🔥","✅","❌","⚡","🎉","🚀","💯",
  "👋","🙏","💪","👀","💀","😴","🤝","🎊","😅","🤗",
  "🌟","💡","📌","🔔","🎯","💬","📎","🖊️","📷","🎵"
]

/**
 * Open a floating emoji picker near `triggerEl` and call `onPick(emoji)`
 * when the user selects one.
 *
 * @param {HTMLElement} triggerEl - The button that was clicked
 * @param {Function}    onPick    - Callback receiving the selected emoji string
 */
export function openComposeEmojiPicker(triggerEl, onPick) {
  // Close any already-open pickers
  document.querySelectorAll(".compose-emoji-picker").forEach(p => p.remove())

  const picker = document.createElement("div")
  picker.className = "compose-emoji-picker"
  picker.setAttribute("role", "dialog")
  picker.setAttribute("aria-label", "Insert emoji")

  INSERT_EMOJI.forEach(emoji => {
    const btn = document.createElement("button")
    btn.type = "button"
    btn.textContent = emoji
    btn.setAttribute("aria-label", `Insert ${emoji}`)
    btn.className = "compose-emoji-btn"
    btn.addEventListener("click", () => {
      onPick(emoji)
      picker.remove()
    })
    picker.appendChild(btn)
  })

  // Append to the row container so the picker is positioned relative to it
  const row = triggerEl.closest(".channel-compose-row") ?? triggerEl.parentElement
  row.appendChild(picker)

  // Dismiss on outside click
  setTimeout(() => {
    const close = (e) => {
      if (!picker.contains(e.target) && e.target !== triggerEl) {
        picker.remove()
        document.removeEventListener("click", close)
      }
    }
    document.addEventListener("click", close)
  }, 0)
}

/**
 * Insert `text` at the current cursor position in `textarea`.
 *
 * @param {HTMLTextAreaElement} textarea
 * @param {string}              text
 */
export function insertAtCursor(textarea, text) {
  const start = textarea.selectionStart ?? textarea.value.length
  const end   = textarea.selectionEnd   ?? textarea.value.length
  textarea.value = textarea.value.slice(0, start) + text + textarea.value.slice(end)
  const newPos = start + text.length
  textarea.setSelectionRange(newPos, newPos)
  textarea.focus()
}
