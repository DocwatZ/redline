# frozen_string_literal: true

class NotificationPreferencesController < ApplicationController
  before_action :authenticate_user!

  def update
    pref = NotificationPreference.for_user(current_user)
    pref.dm_sounds      = params.dig(:notification_preference, :dm_sounds) == "1"
    pref.mention_alerts = params.dig(:notification_preference, :mention_alerts) == "1"
    pref.push_enabled   = params.dig(:notification_preference, :push_enabled) == "1"

    if pref.save
      redirect_to edit_user_registration_path, notice: "Notification settings saved."
    else
      redirect_to edit_user_registration_path, alert: "Failed to save notification settings."
    end
  end
end
