# frozen_string_literal: true

class DirectMessagesController < ApplicationController
  before_action :set_partner, only: [ :show, :create ]
  before_action :set_dm,      only: [ :update, :destroy ]

  def show
    @messages = DirectMessage.conversation(current_user.id, @partner.id).last(50)
    blocked_ids = current_user.blocked_users.pluck(:id)
    @messages = @messages.reject { |dm| blocked_ids.include?(dm.sender_id) }
    @unread = DirectMessage.where(sender: @partner, recipient: current_user, read: false)
    @unread.update_all(read: true)
    # Broadcast read receipt so partner sees ✓✓ indicator update in real time
    if @unread.any?
      conversation_key = [ current_user.id, @partner.id ].sort.join("_")
      ActionCable.server.broadcast("dm_#{conversation_key}", {
        type: "read_receipt",
        reader_id: current_user.id
      })
    end
    # ID of the last sent message from current_user that has been read by partner
    @last_read_sent_id = DirectMessage
      .where(sender: current_user, recipient: @partner, read: true)
      .order(:id).last&.id
    # Exclude this partner's count from the sidebar badge for this page render
    @unread_dm_counts = @unread_dm_counts.except(@partner.id)
  end

  def create
    @dm = DirectMessage.new(
      sender: current_user,
      recipient: @partner,
      body: dm_params[:body].to_s.strip.first(4000),
      parent_id: dm_params[:parent_id]
    )
    @dm.files.attach(dm_params[:files]) if dm_params[:files].present?
    @dm.save!

    conversation_key = [ current_user.id, @partner.id ].sort.join("_")
    ActionCable.server.broadcast("dm_#{conversation_key}", render_dm(@dm))

    # Notify the recipient so their sidebar badge updates in real time
    ActionCable.server.broadcast("user_#{@partner.id}", {
      type: "new_dm",
      sender_id: current_user.id
    })

    # Web push notification for offline recipient
    PushNotificationService.send_to_user(
      @partner,
      title: "New message from #{current_user.display_name}",
      body: @dm.body.first(100),
      url: "/users/#{current_user.id}/direct_messages"
    )

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

  def update
    unless @dm.sender == current_user && !@dm.deleted?
      head :forbidden and return
    end

    body = params.require(:direct_message).permit(:body)[:body].to_s.strip.first(4000)
    @dm.update!(body: body, edited: true)
    conversation_key = [ @dm.sender_id, @dm.recipient_id ].sort.join("_")
    ActionCable.server.broadcast("dm_#{conversation_key}", render_dm(@dm))
    head :ok
  rescue ActiveRecord::RecordInvalid => e
    render json: { errors: e.record.errors.full_messages }, status: :unprocessable_entity
  end

  def destroy
    unless @dm.sender == current_user
      head :forbidden and return
    end

    @dm.update_columns(deleted: true, body: "", updated_at: Time.current)
    conversation_key = [ @dm.sender_id, @dm.recipient_id ].sort.join("_")
    ActionCable.server.broadcast("dm_#{conversation_key}", render_dm(@dm))
    head :ok
  end

  private

  def set_partner
    @partner = User.find(params[:user_id])
    if @partner == current_user
      redirect_to rooms_path, alert: "Cannot message yourself." and return
    end
  end

  def set_dm
    @dm = DirectMessage.find(params[:id])
  rescue ActiveRecord::RecordNotFound
    head :not_found
  end

  def dm_params
    params.require(:direct_message).permit(:body, :parent_id, files: [])
  end

  def render_dm(dm)
    parent_data = nil
    if dm.parent_id && !dm.parent&.deleted?
      parent_data = {
        id: dm.parent.id,
        display_name: dm.parent.sender.display_name,
        body: dm.parent.display_body.to_s.first(100)
      }
    end

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
      deleted: dm.deleted,
      parent: parent_data,
      files: dm.files.attached? ? dm.files.map { |f|
        {
          filename: f.filename.to_s,
          content_type: f.content_type,
          url: Rails.application.routes.url_helpers.rails_blob_path(f, only_path: true),
          image: f.content_type&.start_with?("image/")
        }
      } : [],
      reactions: dm.direct_message_reactions.group(:emoji).count.map { |e, c|
        { emoji: e, count: c, reacted: dm.direct_message_reactions.exists?(user_id: current_user.id, emoji: e) }
      }
    }
  end
end
