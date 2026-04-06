# frozen_string_literal: true

class MessagesController < ApplicationController
  before_action :set_room
  before_action :require_membership!
  before_action :set_message, only: [ :update, :destroy ]

  def create
    @message = @room.messages.build(message_params)
    @message.user = current_user

    if @message.save
      ActionCable.server.broadcast("chat_#{@room.id}", render_message(@message))
      render json: render_message(@message), status: :created
    else
      render json: { errors: @message.errors.full_messages }, status: :unprocessable_entity
    end
  end

  def update
    if @message.user == current_user && @message.update(message_params.merge(edited: true))
      ActionCable.server.broadcast("chat_#{@room.id}", render_message(@message))
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
      ActionCable.server.broadcast("chat_#{@room.id}", render_message(@message))
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
      render json: { error: "Access denied" }, status: :forbidden
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
      deleted: message.deleted
    }
  end
end
