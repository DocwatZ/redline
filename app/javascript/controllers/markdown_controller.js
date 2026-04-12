import { Controller } from "@hotwired/stimulus"

function formatMessage(rawText) {
  const div = document.createElement("div")
  div.appendChild(document.createTextNode(rawText))
  let escaped = div.innerHTML

  // Fenced code blocks (protect content first)
  escaped = escaped.replace(/```[\s\S]*?```/g, (match) => {
    const code = match.slice(3, -3).trim()
    return `<pre class="msg-code-block"><code>${code}</code></pre>`
  })

  // Inline code
  escaped = escaped.replace(/`([^`\n]+?)`/g, '<code class="msg-inline-code">$1</code>')

  // Bold
  escaped = escaped.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')

  // Italic
  escaped = escaped.replace(/\*(.+?)\*/g, '<em>$1</em>')

  return escaped
}

export { formatMessage }

export default class extends Controller {
  connect() {
    const raw = this.element.textContent
    if (raw) {
      this.element.innerHTML = formatMessage(raw)
    }
  }
}
