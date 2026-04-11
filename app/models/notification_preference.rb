# frozen_string_literal: true

class NotificationPreference < ApplicationRecord
  belongs_to :user

  validates :user_id, uniqueness: true

  def self.for_user(user)
    find_or_create_by(user: user) do |pref|
      pref.dm_sounds = true
      pref.mention_alerts = true
      pref.push_enabled = false
    end
  end
end
