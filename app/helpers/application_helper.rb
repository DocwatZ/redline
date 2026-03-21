module ApplicationHelper
  # Renders "REDLINE" with branded split-color styling:
  #   RED  → accent red
  #   LINE → primary white
  def redline_brand_text
    tag.span(class: "rl-brand-red") { "RED" } +
      tag.span(class: "rl-brand-white") { "LINE" }
  end
end
