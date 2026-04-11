# frozen_string_literal: true
class InvitesController < ApplicationController
  before_action :set_room, only: [:index, :create]

  def index
    @invites = @room.invites.valid.includes(:user)
    render json: @invites.map { |i| invite_json(i) }
  end

  def create
    @invite = @room.invites.build(
      user: current_user,
      max_uses: (params[:max_uses] || 0).to_i,
      expires_at: params[:expires_at].present? ? Time.zone.parse(params[:expires_at]) : nil
    )
    if @invite.save
      render json: { url: accept_invite_url(@invite.code) }.merge(invite_json(@invite)), status: :created
    else
      render json: { errors: @invite.errors.full_messages }, status: :unprocessable_entity
    end
  end

  def show
    @invite = Invite.find_by!(code: params[:code])
    if @invite.usable?
      render :show
    else
      redirect_to root_path, alert: "This invite link is no longer valid."
    end
  end

  def accept
    @invite = Invite.find_by!(code: params[:code])
    unless @invite.usable?
      redirect_to root_path, alert: "This invite link is no longer valid."
      return
    end
    room = @invite.room
    unless room.member?(current_user)
      room.room_memberships.create!(user: current_user, role: :member)
      @invite.increment!(:uses)
    end
    redirect_to room_path(room), notice: "Welcome to ##{room.name}!"
  end

  def destroy
    @invite = Invite.find_by!(code: params[:code])
    if @invite.user == current_user || current_user.admin?
      @invite.destroy
      redirect_to root_path, notice: "Invite revoked."
    else
      redirect_to root_path, alert: "Access denied."
    end
  end

  private

  def set_room
    @room = Room.find_by!(slug: params[:room_id])
    unless @room.member?(current_user) || !@room.private?
      render json: { error: "Access denied" }, status: :forbidden
    end
  end

  def invite_json(invite)
    {
      id: invite.id,
      code: invite.code,
      url: accept_invite_url(invite.code),
      uses: invite.uses,
      max_uses: invite.max_uses,
      expires_at: invite.expires_at&.iso8601,
      created_at: invite.created_at.iso8601
    }
  end
end
