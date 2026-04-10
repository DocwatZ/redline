# frozen_string_literal: true
class ReactionsController < ApplicationController
  before_action :set_room
  before_action :require_membership!

  def create
    @message = @room.messages.find(params[:message_id])
    emoji = params[:emoji].to_s.strip.first(8)
    return head :unprocessable_entity if emoji.blank?

    existing = @message.message_reactions.find_by(user: current_user, emoji: emoji)
    if existing
      existing.destroy
      action = "removed"
    else
      @message.message_reactions.create!(user: current_user, emoji: emoji)
      action = "added"
    end

    reactions = reaction_summary(@message)
    ActionCable.server.broadcast("chat_#{@room.id}", {
      type: "reaction_update",
      message_id: @message.id,
      reactions: reactions
    })

    render json: { reactions: reactions, action: action }
  end

  private

  def set_room
    @room = Room.find_by!(slug: params[:room_id])
  end

  def require_membership!
    return if @room.member?(current_user) || !@room.private?
    render json: { error: "Access denied" }, status: :forbidden
  end

  def reaction_summary(message)
    message.message_reactions.group(:emoji).count.map do |e, c|
      { emoji: e, count: c, reacted: message.message_reactions.exists?(user: current_user, emoji: e) }
    end
  end
end
