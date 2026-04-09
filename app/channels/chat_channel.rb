# frozen_string_literal: true

class ChatChannel < ApplicationCable::Channel
  def subscribed
    @room = Room.find_by(id: params[:room_id])
    return reject unless @room && current_user.rooms.include?(@room)

    stream_from "chat_#{@room.id}"

    # Also subscribe to voice chat stream if this is a voice channel
    if @room.voice_channel?
      stream_from "voice_chat_#{@room.id}"
    end
  end

  def receive(data)
    return unless @room

    message_context = data["message_context"] || "standard"

    message = @room.messages.create!(
      user: current_user,
      body: data["body"].to_s.strip.first(4000),
      parent_id: data["parent_id"].presence,
      message_context: message_context
    )

    broadcast_channel = message.in_call? ? "voice_chat_#{@room.id}" : "chat_#{@room.id}"
    ActionCable.server.broadcast(broadcast_channel, render_message(message))
  end

  def unsubscribed
    stop_all_streams
  end

  private

  def render_message(message)
    parent_data = nil
    if message.parent_id && !message.parent&.deleted?
      parent_data = {
        id: message.parent.id,
        display_name: message.parent.user.display_name,
        body: message.parent.display_body.truncate(100)
      }
    end

    {
      id: message.id,
      body: message.display_body,
      room_id: message.room_id,
      user_id: message.user_id,
      display_name: message.user.display_name,
      initials: message.user.initials,
      avatar_color: message.user.avatar_color,
      created_at: message.created_at.iso8601,
      edited: message.edited,
      deleted: message.deleted,
      message_context: message.message_context,
      parent: parent_data
    }
  end
end
