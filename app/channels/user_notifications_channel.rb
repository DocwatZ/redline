# frozen_string_literal: true

# Broadcasts per-user notifications to the connected client.
# Currently used for real-time DM unread badge updates.
class UserNotificationsChannel < ApplicationCable::Channel
  def subscribed
    stream_from "user_#{current_user.id}"
  end
end
