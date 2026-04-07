module ApplicationHelper
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
