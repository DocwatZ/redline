# frozen_string_literal: true

class Admin::ChannelPermissionsController < Admin::BaseController
  before_action :set_room

  def index
    @memberships = @room.room_memberships.includes(:user, :channel_permissions).order("users.display_name")
  end

  def update
    @membership = @room.room_memberships.find(params[:id])
    perm = @membership.channel_permissions.find_or_initialize_by(room: @room)

    allowed = ChannelPermission::ALL_PERMISSIONS
    perm_attrs = allowed.index_with { |p| params.dig(:permissions, p) == "1" }

    if perm.update(perm_attrs)
      AuditService.log(
        action: "admin.permissions_updated",
        user: current_user,
        metadata: { room_id: @room.id, membership_id: @membership.id, permissions: perm_attrs }
      )
      redirect_to admin_room_channel_permissions_path(@room),
                  notice: "Permissions updated for #{@membership.user.display_name}."
    else
      redirect_to admin_room_channel_permissions_path(@room),
                  alert: "Failed to update permissions: #{perm.errors.full_messages.join(', ')}"
    end
  end

  private

  def set_room
    @room = Room.find_by!(slug: params[:room_id])
  end
end
