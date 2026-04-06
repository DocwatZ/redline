# frozen_string_literal: true

class MessagesController < ApplicationController
  before_action :set_room
  before_action :require_membership!
  before_action :set_message, only: [ :update, :destroy ]

  def create
    @message = @room.messages.build(message_params)
    @message.user = current_user
    @message.message_context = params.dig(:message, :message_context) || "standard"

    # Check permissions based on message context
    membership = @room.membership_for(current_user)
    unless membership&.can_send_messages?(@room)
      respond_to do |format|
        format.html { redirect_to room_path(@room), alert: "You do not have permission to send messages" }
        format.json { render json: { error: "You do not have permission to send messages" }, status: :forbidden }
      end
      return
    end

    if @message.save
      broadcast_channel = @message.in_call? ? "voice_chat_#{@room.id}" : "chat_#{@room.id}"
      ActionCable.server.broadcast(broadcast_channel, render_message(@message))
      respond_to do |format|
        format.html { redirect_to room_path(@room) }
        format.json { render json: render_message(@message), status: :created }
      end
    else
      respond_to do |format|
        format.html { redirect_to room_path(@room), alert: @message.errors.full_messages.join(", ") }
        format.json { render json: { errors: @message.errors.full_messages }, status: :unprocessable_entity }
      end
    end
  end

  def update
    if @message.user == current_user && @message.update(message_params.merge(edited: true))
      broadcast_channel = @message.in_call? ? "voice_chat_#{@room.id}" : "chat_#{@room.id}"
      ActionCable.server.broadcast(broadcast_channel, render_message(@message))
      head :ok
    else
      head :forbidden
    end
  end

  def destroy
    membership = @room.membership_for(current_user)
    can_delete = @message.user == current_user || membership&.moderator?

    if can_delete
      @message.update!(deleted: true, body: "")
      broadcast_channel = @message.in_call? ? "voice_chat_#{@room.id}" : "chat_#{@room.id}"
      ActionCable.server.broadcast(broadcast_channel, render_message(@message))
      head :ok
    else
      head :forbidden
    end
  end

  private

  def set_room
    @room = Room.find_by!(slug: params[:room_id])
  end

  def set_message
    @message = @room.messages.find(params[:id])
  end

  def require_membership!
    unless @room.member?(current_user) || !@room.private?
      respond_to do |format|
        format.html { redirect_to rooms_path, alert: "Access denied" }
        format.json { render json: { error: "Access denied" }, status: :forbidden }
      end
    end
  end

  def message_params
    params.require(:message).permit(:body)
  end

  def render_message(message)
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
      message_context: message.message_context
    }
  end
end
