# frozen_string_literal: true

class Admin::MessagesController < Admin::BaseController
  before_action :set_room

  def index
    @messages = @room.messages
                     .where(deleted: false)
                     .order(created_at: :desc)
                     .includes(:user)
                     .limit(100)
  end

  def destroy
    @message = @room.messages.find(params[:id])
    @message.update!(deleted: true, body: "[deleted by moderator]", edited: true)
    AuditService.log(
      action: "admin.message_deleted",
      user: current_user,
      metadata: {
        message_id: @message.id,
        room_id: @room.id,
        room_name: @room.name,
        original_author_id: @message.user_id
      }
    )
    redirect_to admin_room_messages_path(@room), notice: "Message deleted."
  end

  private

  def set_room
    @room = Room.find_by!(slug: params[:room_id])
  end
end
