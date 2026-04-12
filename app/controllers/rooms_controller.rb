# frozen_string_literal: true

class RoomsController < ApplicationController
  before_action :set_room, only: [ :show, :edit, :update, :destroy, :join, :leave ]
  before_action :require_membership!, only: [ :show ]
  before_action :require_admin!, only: [ :edit, :update, :destroy ]

  def index
    @rooms = Room.public_rooms.top_level.by_position.includes(:owner, :room_memberships, :subchannels)
    @my_rooms = current_user.rooms.top_level.by_position.includes(:owner, :subchannels)
  end

  def show
    blocked_ids = current_user.blocked_users.pluck(:id)
    @messages = @room.messages.visible.standard_messages.where.not(user_id: blocked_ids).recent.includes(:user).last(50)
    @in_call_messages = @room.voice_channel? ? @room.messages.visible.in_call_messages.recent.includes(:user).last(20) : []
    @members = @room.members.order(:display_name)
    @subchannels = @room.subchannels.by_position if @room.voice_channel?
    @pinned_messages = @room.messages.where(pinned: true).includes(:user).limit(5)
    membership = @room.membership_for(current_user)
    membership&.update_column(:last_read_at, Time.current)
  end

  def new
    @room = Room.new
    @voice_channels = current_user.rooms.voice_channels.top_level.by_position
  end

  def edit
    @voice_channels = current_user.rooms.voice_channels.top_level.by_position
  end

  def create
    @room = current_user.owned_rooms.build(room_params)

    if @room.save
      redirect_to @room, notice: "#{@room.subchannel? ? 'Subchannel' : 'Channel'} created successfully."
    else
      @voice_channels = current_user.rooms.voice_channels.top_level.by_position
      render :new, status: :unprocessable_entity
    end
  end

  def update
    if @room.update(room_params)
      redirect_to @room, notice: "Channel updated."
    else
      @voice_channels = current_user.rooms.voice_channels.top_level.by_position
      render :edit, status: :unprocessable_entity
    end
  end

  def destroy
    @room.destroy
    redirect_to rooms_path, notice: "Channel deleted."
  end

  def join
    if @room.private?
      redirect_to rooms_path, alert: "This channel is private."
      return
    end

    unless @room.member?(current_user)
      @room.room_memberships.create!(user: current_user, role: "member")
    end

    redirect_to @room
  end

  def leave
    membership = @room.membership_for(current_user)
    if membership&.admin? && @room.room_memberships.where(role: "admin").count == 1
      redirect_to @room, alert: "Transfer admin rights before leaving."
      return
    end

    membership&.destroy
    redirect_to rooms_path, notice: "You left #{@room.name}."
  end

  private

  def set_room
    @room = Room.find_by!(slug: params[:id])
  end

  def room_params
    params.require(:room).permit(:name, :description, :room_type, :channel_type, :private, :e2ee_enabled, :parent_id, :position)
  end

  def require_membership!
    unless @room.member?(current_user) || !@room.private?
      redirect_to rooms_path, alert: "Access denied."
    end
  end

  def require_admin!
    membership = @room.membership_for(current_user)
    redirect_to @room, alert: "Admin access required." unless membership&.admin?
  end
end
