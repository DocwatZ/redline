# frozen_string_literal: true

class LinkPreview < ApplicationRecord
  validates :url, presence: true, uniqueness: true

  # Find or fetch a preview for a given URL.
  # Returns nil if the URL is invalid or the fetch fails.
  def self.find_or_fetch(url)
    return nil unless url.present?

    find_by(url: url) || fetch_and_create(url)
  end

  def as_preview_json
    {
      url: url,
      title: title,
      description: description,
      image_url: image_url,
      favicon_url: favicon_url,
      site_name: site_name
    }
  end

  private_class_method def self.fetch_and_create(url)
    data = LinkPreviewService.fetch(url)
    return nil if data.nil?

    create(data)
  rescue ActiveRecord::RecordNotUnique
    # Another process already created this preview
    find_by(url: url)
  end
end
