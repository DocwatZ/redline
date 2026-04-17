import { Controller } from "@hotwired/stimulus"

/**
 * Link Preview controller — fetches rich Open Graph previews for URLs found
 * in a message element and appends preview cards below the message text.
 *
 * URL linkification (turning plain URLs into clickable anchors) is handled
 * upstream by formatMessage() in markdown_controller.js so that this
 * controller never needs to mutate the message text itself.
 *
 * Usage: Add data-controller="link-preview" to any element containing
 * message text. The controller will:
 *   1. Detect URLs in the element's text content
 *   2. Fetch Open Graph metadata for each URL
 *   3. Render and append preview cards (title, description, image, favicon)
 *
 * Discord-style feature:
 *   - Wrapping a URL in angle brackets <https://example.com> prevents the
 *     preview card from appearing (the URL is still a clickable link).
 *   - Users can disable link previews in Settings > Text & Images.
 */
export default class extends Controller {
  static values = { processed: Boolean }

  connect() {
    if (this.processedValue) return
    this.processedValue = true
    // Reset processedValue before Turbo caches this page so that when the
    // cached snapshot is restored, controllers re-run link linkification.
    this._beforeCacheHandler = () => { this.processedValue = false }
    document.addEventListener("turbo:before-cache", this._beforeCacheHandler)
    this.linkifyAndPreview()
  }

  disconnect() {
    if (this._beforeCacheHandler) {
      document.removeEventListener("turbo:before-cache", this._beforeCacheHandler)
      this._beforeCacheHandler = null
    }
  }

  linkifyAndPreview() {
    const text = this.element.textContent || ""
    const urlData = this.extractUrls(text)

    if (urlData.length === 0) return

    // Check if user has link previews enabled
    const previewsEnabled = document.body.getAttribute("data-link-previews") !== "false"
    if (!previewsEnabled) return

    // Fetch preview cards only for non-suppressed URLs
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
    const urlPattern = /https?:\/\/(?:[a-zA-Z0-9\-]+\.)+[a-zA-Z]{2,}(?::\d{1,5})?(?:\/[^\s<>")\]\}]*)?/g
    const results = []
    const seen = new Set()

    // Find angle-bracket-wrapped URLs (suppressed — no preview card)
    const suppressedPattern = /<(https?:\/\/(?:[a-zA-Z0-9\-]+\.)+[a-zA-Z]{2,}(?::\d{1,5})?(?:\/[^\s<>")\]\}]*)?)>/g
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
    // Guard: don't append to a detached element (can happen if the message
    // body was replaced by the optimistic-render update path before the
    // async fetch resolved).
    if (!this.element.isConnected) return

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
