import { Controller } from "@hotwired/stimulus"

// URL pattern used by formatMessage for linkification
const MSG_URL_PATTERN = /https?:\/\/(?:[a-zA-Z0-9\-]+\.)+[a-zA-Z]{2,}(?::\d{1,5})?(?:\/[^\s<>")\]\}]*)?/g

// Delimiter used to protect code blocks from URL linkification.
// Uses Unicode private-use characters so it never collides with real message text.
const PH_OPEN  = "\uE001"
const PH_CLOSE = "\uE002"

function formatMessage(rawText) {
  const div = document.createElement("div")
  div.appendChild(document.createTextNode(rawText))
  let escaped = div.innerHTML

  // Extract code blocks and inline code as numbered placeholders so that
  // their content is not affected by subsequent transformations (bold, italic,
  // URL linkification, etc.).
  const placeholders = []

  // Fenced code blocks
  escaped = escaped.replace(/```[\s\S]*?```/g, (match) => {
    const code = match.slice(3, -3).trim()  // already HTML-escaped, safe to insert directly
    placeholders.push(`<pre class="msg-code-block"><code>${code}</code></pre>`)
    return `${PH_OPEN}${placeholders.length - 1}${PH_CLOSE}`
  })

  // Inline code
  escaped = escaped.replace(/`([^`\n]+?)`/g, (_, code) => {
    placeholders.push(`<code class="msg-inline-code">${code}</code>`)
    return `${PH_OPEN}${placeholders.length - 1}${PH_CLOSE}`
  })

  // Bold
  escaped = escaped.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')

  // Italic
  escaped = escaped.replace(/\*(.+?)\*/g, '<em>$1</em>')

  // URL linkification — runs after code blocks are replaced with placeholders
  // so URLs inside code snippets are not turned into links.
  MSG_URL_PATTERN.lastIndex = 0
  escaped = escaped.replace(MSG_URL_PATTERN, (url) =>
    `<a href="${url}" target="_blank" rel="noopener noreferrer" class="link-preview-url">${url}</a>`
  )

  // Restore code block / inline-code placeholders
  const phPattern = new RegExp(`${PH_OPEN}(\\d+)${PH_CLOSE}`, "g")
  escaped = escaped.replace(phPattern, (_, i) => placeholders[parseInt(i, 10)])

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
