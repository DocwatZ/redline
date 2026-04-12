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

    # Prevent non-admins from posting to announcement channels via WebSocket
    if @room.announcement?
      membership = @room.membership_for(current_user)
      return unless membership&.admin?
    end

    message_context = data["message_context"] || "standard"

    message_attrs = {
      user: current_user,
      parent_id: data["parent_id"].presence,
      message_context: message_context
    }

    # E2EE rooms receive ciphertext instead of body
    if data["ciphertext"].present?
      message_attrs[:ciphertext] = data["ciphertext"].to_s.first(8000)
    else
      message_attrs[:body] = data["body"].to_s.strip.first(4000)
    end

    message = @room.messages.create!(message_attrs)

    broadcast_channel = message.in_call? ? "voice_chat_#{@room.id}" : "chat_#{@room.id}"
    ActionCable.server.broadcast(broadcast_channel, render_message(message))
    detect_mentions(message)

    # Broadcast unread count to other members
    @room.room_memberships.each do |m|
      next if m.user_id == current_user.id
      count = @room.messages.where("created_at > ?", m.last_read_at || Time.at(0)).count
      ActionCable.server.broadcast("user_#{m.user_id}", {
        type: "channel_unread",
        room_slug: @room.slug,
        room_id: @room.id,
        count: count
      })
    end
  end

  def typing
    return unless @room
    ActionCable.server.broadcast("chat_#{@room.id}", {
      type: "typing",
      user_id: current_user.id,
      display_name: current_user.display_name
    })
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
      ciphertext: message.ciphertext,
      room_id: message.room_id,
      user_id: message.user_id,
      display_name: message.user.display_name,
      initials: message.user.initials,
      avatar_color: message.user.avatar_color,
      created_at: message.created_at.iso8601,
      edited: message.edited,
      deleted: message.deleted,
      message_context: message.message_context,
      parent: parent_data,
      reply_count: message.replies.count,
      reactions: message.message_reactions.group(:emoji).count.map { |e, c|
        { emoji: e, count: c, reacted: message.message_reactions.exists?(user: current_user, emoji: e) }
      }
    }
  end

  def detect_mentions(message)
    message.body.to_s.scan(/@([a-zA-Z0-9_\-]+)/).flatten.uniq.each do |username|
      user = User.find_by(username: username)
      next unless user && user != current_user
      ActionCable.server.broadcast("user_#{user.id}", {
        type: "mention",
        message_id: message.id,
        room_slug: message.room.slug,
        room_name: message.room.name,
        sender_name: current_user.display_name,
        body_preview: message.body.first(100)
      })
    end
  end
end
