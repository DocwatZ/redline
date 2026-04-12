# frozen_string_literal: true

class MessagesController < ApplicationController
  before_action :set_room
  before_action :require_membership!
  before_action :set_message, only: [ :thread, :update, :destroy, :pin, :unpin ]

  def index
    before_id = params[:before].to_i
    @messages = if before_id > 0
      @room.messages.visible.standard_messages.where("id < ?", before_id).order(id: :desc).limit(30).reverse
    else
      @room.messages.visible.standard_messages.order(id: :desc).limit(30).reverse
    end
    render json: @messages.map { |m| render_message(m) }
  end

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
      detect_mentions(@message)
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

  def thread
    @replies = @message.replies.includes(:user, :message_reactions).order(:created_at)
    render json: {
      parent: render_message(@message),
      replies: @replies.map { |r| render_message(r) }
    }
  end

  def destroy
    membership = @room.membership_for(current_user)
    can_delete = @message.user == current_user || membership&.moderator?

    if can_delete
      @message.update_columns(deleted: true, body: "", updated_at: Time.current)
      broadcast_channel = @message.in_call? ? "voice_chat_#{@room.id}" : "chat_#{@room.id}"
      ActionCable.server.broadcast(broadcast_channel, render_message(@message))
      head :ok
    else
      head :forbidden
    end
  end

  def pin
    membership = @room.membership_for(current_user)
    unless membership&.moderator?
      render json: { error: "Forbidden" }, status: :forbidden and return
    end
    @message.update!(pinned: true)
    ActionCable.server.broadcast("chat_#{@room.id}", {
      type: "pin_update",
      message_id: @message.id,
      pinned: true,
      body: @message.display_body,
      display_name: @message.user.display_name
    })
    head :ok
  end

  def unpin
    membership = @room.membership_for(current_user)
    unless membership&.moderator?
      render json: { error: "Forbidden" }, status: :forbidden and return
    end
    @message.update!(pinned: false)
    ActionCable.server.broadcast("chat_#{@room.id}", {
      type: "pin_update",
      message_id: @message.id,
      pinned: false
    })
    head :ok
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
    params.require(:message).permit(:body, :ciphertext, :parent_id, files: [])
  end

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
      },
      files: message.files.attached? ? message.files.map { |f|
        {
          id: f.id,
          filename: f.filename.to_s,
          content_type: f.content_type,
          url: Rails.application.routes.url_helpers.rails_blob_path(f, only_path: true),
          image: f.content_type&.start_with?("image/")
        }
      } : []
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
      PushNotificationService.send_to_user(
        user,
        title: "#{current_user.display_name} mentioned you in ##{message.room.name}",
        body: message.body.first(100),
        url: "/rooms/#{message.room.slug}"
      )
    end
  end
end
