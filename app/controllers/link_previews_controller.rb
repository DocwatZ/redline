# frozen_string_literal: true

class LinkPreviewsController < ApplicationController
  # GET /link_previews?url=https://example.com
  def show
    url = params[:url].to_s.strip
    unless url.present? && valid_url?(url)
      render json: { error: "Invalid URL" }, status: :bad_request
      return
    end

    preview = LinkPreview.find_or_fetch(url)
    if preview
      render json: preview.as_preview_json
    else
      render json: { error: "Could not fetch preview" }, status: :not_found
    end
  end

  private

  def valid_url?(url)
    uri = URI.parse(url)
    uri.is_a?(URI::HTTP) && uri.host.present?
  rescue URI::InvalidURIError
    false
  end
end
