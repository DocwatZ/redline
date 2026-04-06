# frozen_string_literal: true

class DirectMessagesController < ApplicationController
  before_action :set_partner

  def show
    @messages = DirectMessage.conversation(current_user.id, @partner.id).last(50)
    @unread = DirectMessage.where(sender: @partner, recipient: current_user, read: false)
    @unread.update_all(read: true)
  end

  def create
    @dm = DirectMessage.create!(
      sender: current_user,
      recipient: @partner,
      body: dm_params[:body].to_s.strip.first(4000)
    )

    conversation_key = [ current_user.id, @partner.id ].sort.join("_")
    ActionCable.server.broadcast("dm_#{conversation_key}", render_dm(@dm))

    respond_to do |format|
      format.html { redirect_to user_direct_messages_path(@partner) }
      format.json { head :ok }
    end
  rescue ActiveRecord::RecordInvalid => e
    respond_to do |format|
      format.html { redirect_to user_direct_messages_path(@partner), alert: e.record.errors.full_messages.join(", ") }
      format.json { render json: { errors: e.record.errors.full_messages }, status: :unprocessable_entity }
    end
  end

  private

  def set_partner
    @partner = User.find(params[:user_id])
    if @partner == current_user
      redirect_to rooms_path, alert: "Cannot message yourself." and return
    end
  end

  def dm_params
    params.require(:direct_message).permit(:body)
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
      created_at: dm.created_at.iso8601
    }
  end
end
