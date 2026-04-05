# frozen_string_literal: true

class AppSetting < ApplicationRecord
  validates :request_access_url, length: { maximum: 2048 }, allow_blank: true

  # Returns the single settings record, creating it with defaults if absent.
  def self.instance
    first_or_create!(
      self_signup_enabled: true,
      request_access_url:  "https://steamcommunity.com/groups/G13UK/"
    )
  end
end
