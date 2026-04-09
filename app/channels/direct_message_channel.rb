# frozen_string_literal: true

class DirectMessageChannel < ApplicationCable::Channel
  def subscribed
    @partner = User.find_by(id: params[:partner_id])
    return reject unless @partner

    stream_from "dm_#{conversation_key}"
  end

  def receive(data)
    return unless @partner

    dm = DirectMessage.create!(
      sender: current_user,
      recipient: @partner,
      body: data["body"].to_s.strip.first(4000)
    )

    ActionCable.server.broadcast("dm_#{conversation_key}", render_dm(dm))
  end

  def unsubscribed
    stop_all_streams
  end

  private

  def conversation_key
    [ current_user.id, @partner.id ].sort.join("_")
  end

  def render_dm(dm)
    {
      id: dm.id,
      body: dm.display_body,
      sender_id: dm.sender_id,
      recipient_id: dm.recipient_id,
      display_name: dm.sender.display_name,
      initials: dm.sender.initials,
      avatar_color: dm.sender.avatar_color,
      created_at: dm.created_at.iso8601,
      edited: dm.edited,
      deleted: dm.deleted
    }
  end
end
