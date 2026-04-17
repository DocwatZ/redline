module ApplicationHelper
  # ── Channel type SVG icons ─────────────────────────────────────────────────
  #
  # HASH_CHANNEL_SVG — red square with white # (replaces #️⃣)
  # VOICE_CHANNEL_SVG — dark square with red speaker + white waves (replaces 🔊)
  #
  # Both are 1em × 1em inline SVGs.

  HASH_CHANNEL_SVG = (
    '<svg width="1em" height="1em" viewBox="0 0 16 16" fill="none" ' \
    'xmlns="http://www.w3.org/2000/svg" ' \
    'style="display:inline-block;vertical-align:-.1em;flex-shrink:0" ' \
    'aria-hidden="true">' \
      '<rect width="16" height="16" rx="3" fill="#c0392b"/>' \
      '<path d="M6.5 3.5L5.5 12.5M10.5 3.5L9.5 12.5" ' \
            'stroke="white" stroke-width="1.5" stroke-linecap="round"/>' \
      '<path d="M3.5 7H12.5M3.5 10H12.5" ' \
            'stroke="white" stroke-width="1.5" stroke-linecap="round"/>' \
    '</svg>'
  ).html_safe.freeze

  VOICE_CHANNEL_SVG = (
    '<svg width="1em" height="1em" viewBox="0 0 16 16" fill="none" ' \
    'xmlns="http://www.w3.org/2000/svg" ' \
    'style="display:inline-block;vertical-align:-.1em;flex-shrink:0" ' \
    'aria-hidden="true">' \
      '<rect width="16" height="16" rx="3" fill="#1a1a1a"/>' \
      '<path d="M2 5.5H5L9 3.5V12.5L5 10.5H2V5.5Z" fill="#c0392b"/>' \
      '<path d="M10.5 6C12 7 12 9 10.5 10" ' \
            'stroke="white" stroke-width="1.3" stroke-linecap="round"/>' \
      '<path d="M12 5C14 6.5 14 9.5 12 11" ' \
            'stroke="white" stroke-width="1.3" stroke-linecap="round"/>' \
    '</svg>'
  ).html_safe.freeze

  # Returns the SVG icon for a channel type string ("chat", "both", "announcement").
  # Useful in forms where you don't have a room object.
  def channel_type_icon_svg(type_value)
    case type_value
    when "both" then VOICE_CHANNEL_SVG
    when "announcement" then "📢".html_safe
    else HASH_CHANNEL_SVG
    end
  end

  # Returns the SVG icon for a room's channel type.
  # Appends 🗝️ / 🔐 text for private / e2ee rooms, as these are out of scope
  # for the icon redesign and appear alongside the icon.
  #
  # Usage: <%= channel_icon_svg(@room) %>
  def channel_icon_svg(room)
    base = if room.voice_channel?
      VOICE_CHANNEL_SVG
    elsif room.announcement?
      "📢".html_safe
    else
      HASH_CHANNEL_SVG
    end

    modifiers = "".dup
    modifiers << "🗝️" if room.private?
    modifiers << "🔐" if room.e2ee?

    modifiers.present? ? (base + modifiers).html_safe : base
  end

  # Renders "REDLINE" with branded split-color styling:
  #   RED  → accent red
  #   LINE → primary white
  def redline_brand_text
    tag.span do
      tag.span(class: "rl-brand-red") { "RED" } +
        tag.span(class: "rl-brand-white") { "LINE" }
    end
  end

  # Returns the string to set on data-link-previews on the <body>.
  # Defaults to "true" (previews enabled) unless the signed-in user has
  # explicitly disabled them. Treats nil and column-missing as enabled so
  # that a pending migration never silently breaks all previews.
  def link_previews_body_attr
    return "true" unless user_signed_in?
    current_user.link_previews_enabled? ? "true" : "false"
  end
end
