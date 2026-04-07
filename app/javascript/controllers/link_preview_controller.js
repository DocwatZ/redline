import { Controller } from "@hotwired/stimulus"

/**
 * Link Preview controller — auto-links URLs in message text and fetches
 * rich previews (Open Graph metadata) for each URL.
 *
 * Usage: Add data-controller="link-preview" to any element containing
 * message text. The controller will:
 *   1. Detect URLs in the text content
 *   2. Make them clickable links
 *   3. Fetch and render preview cards with title, description, image, favicon
 *
 * Discord-style features:
 *   - Wrapping a URL in angle brackets <https://example.com> prevents the
 *     preview from appearing (URL is still clickable).
 *   - Users can disable link previews in Settings > Text & Images.
 */
export default class extends Controller {
  static values = { processed: Boolean }

  connect() {
    if (this.processedValue) return
    this.processedValue = true
    this.linkifyAndPreview()
  }

  linkifyAndPreview() {
    const text = this.element.textContent || ""
    const urlData = this.extractUrls(text)

    if (urlData.length === 0) return

    // Auto-link URLs in the text
    this.linkifyText(text, urlData)

    // Check if user has link previews enabled
    const previewsEnabled = document.body.getAttribute("data-link-previews") !== "false"
    if (!previewsEnabled) return

    // Fetch previews only for non-suppressed URLs
    const previewableUrls = [...new Set(
      urlData.filter(u => !u.suppressed).map(u => u.url)
    )]
    previewableUrls.forEach(url => this.fetchPreview(url))
  }

  /**
   * Extract URLs from text, detecting angle-bracket-wrapped URLs as suppressed.
   * Returns array of { url, suppressed } objects.
   */
  extractUrls(text) {
    const urlPattern = /https?:\/\/[a-zA-Z0-9\-]+(?:\.[a-zA-Z0-9\-]+)*(?:\.[a-zA-Z]{2,})(?::\d{1,5})?(?:\/[^\s<>")\]\}]*)?/g
    const results = []
    const seen = new Set()

    // Find angle-bracket-wrapped URLs (suppressed)
    const suppressedPattern = /<(https?:\/\/[a-zA-Z0-9\-]+(?:\.[a-zA-Z0-9\-]+)*(?:\.[a-zA-Z]{2,})(?::\d{1,5})?(?:\/[^\s<>")\]\}]*)?)>/g
    let match
    while ((match = suppressedPattern.exec(text)) !== null) {
      if (!seen.has(match[1])) {
        results.push({ url: match[1], suppressed: true })
        seen.add(match[1])
      }
    }

    // Find all other URLs
    while ((match = urlPattern.exec(text)) !== null) {
      if (!seen.has(match[0])) {
        results.push({ url: match[0], suppressed: false })
        seen.add(match[0])
      }
    }

    return results
  }

  linkifyText(text, urlData) {
    const fragment = document.createDocumentFragment()
    const allUrls = urlData.map(u => u.url)

    // Build regex that matches both bare URLs and <URL> wrapped URLs
    const escapedUrls = allUrls.map(u => u.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    // Match angle-bracket-wrapped URLs or bare URLs
    const splitPattern = new RegExp(`(<(?:${escapedUrls.join("|")})>|${escapedUrls.join("|")})`)
    const parts = text.split(splitPattern)

    parts.forEach(part => {
      // Check if this is an angle-bracket-wrapped URL
      const bracketMatch = part.match(/^<(https?:\/\/.+)>$/)
      if (bracketMatch && allUrls.includes(bracketMatch[1])) {
        const a = document.createElement("a")
        a.href = bracketMatch[1]
        a.textContent = bracketMatch[1]
        a.target = "_blank"
        a.rel = "noopener noreferrer"
        a.className = "link-preview-url"
        fragment.appendChild(a)
      } else if (allUrls.includes(part)) {
        const a = document.createElement("a")
        a.href = part
        a.textContent = part
        a.target = "_blank"
        a.rel = "noopener noreferrer"
        a.className = "link-preview-url"
        fragment.appendChild(a)
      } else {
        fragment.appendChild(document.createTextNode(part))
      }
    })

    this.element.textContent = ""
    this.element.appendChild(fragment)
  }

  async fetchPreview(url) {
    try {
      const csrf = document.querySelector('meta[name="csrf-token"]')?.content
      const response = await fetch(`/link_previews?url=${encodeURIComponent(url)}`, {
        headers: {
          "Accept": "application/json",
          "X-CSRF-Token": csrf ?? ""
        }
      })

      if (!response.ok) return

      const data = await response.json()
      if (data.title || data.description) {
        this.renderPreviewCard(data)
      }
    } catch (err) {
      // Silently fail — previews are non-critical
    }
  }

  renderPreviewCard(data) {
    const card = document.createElement("a")
    card.href = data.url
    card.target = "_blank"
    card.rel = "noopener noreferrer"
    card.className = "link-preview-card"
    card.setAttribute("aria-label", `Link preview: ${data.title || data.url}`)

    let html = ""

    // Image
    if (data.image_url) {
      const imgAlt = data.title ? `Preview image for ${data.title}` : ""
      html += `<div class="link-preview-image">
        <img src="${this.escapeAttr(data.image_url)}" alt="${this.escapeAttr(imgAlt)}" loading="lazy"
             onerror="this.parentElement.remove()">
      </div>`
    }

    // Content
    html += `<div class="link-preview-content">`

    // Site info (favicon + site name)
    const siteName = data.site_name || this.extractDomain(data.url)
    html += `<div class="link-preview-site">`
    if (data.favicon_url) {
      html += `<img src="${this.escapeAttr(data.favicon_url)}" alt="" class="link-preview-favicon"
                    onerror="this.remove()" loading="lazy">`
    }
    html += `<span class="link-preview-site-name">${this.escapeHtml(siteName)}</span>`
    html += `</div>`

    // Title
    if (data.title) {
      html += `<div class="link-preview-title">${this.escapeHtml(data.title)}</div>`
    }

    // Description
    if (data.description) {
      html += `<div class="link-preview-description">${this.escapeHtml(data.description)}</div>`
    }

    html += `</div>`

    card.innerHTML = html

    this.element.appendChild(card)
  }

  extractDomain(url) {
    try {
      return new URL(url).hostname
    } catch {
      return url
    }
  }

  escapeHtml(str) {
    const div = document.createElement("div")
    div.appendChild(document.createTextNode(String(str ?? "")))
    return div.innerHTML
  }

  escapeAttr(str) {
    return String(str ?? "")
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\n/g, "&#10;")
      .replace(/\r/g, "&#13;")
  }
}
