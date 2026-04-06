# frozen_string_literal: true

class Admin::RoomsController < Admin::BaseController
  before_action :set_room, only: [:show, :destroy]

  def index
    @rooms = Room.order(created_at: :desc).includes(:owner, :parent)
  end

  def show
    @members = @room.members.order(:display_name)
    @message_count = @room.messages.count
  end

  def destroy
    AuditService.log(
      action: "admin.room_deleted",
      user: current_user,
      metadata: { room_id: @room.id, room_name: @room.name }
    )
    @room.destroy
    redirect_to admin_rooms_path, notice: "Channel deleted."
  end

  private

  def set_room
    @room = Room.find_by!(slug: params[:id])
  end
end
