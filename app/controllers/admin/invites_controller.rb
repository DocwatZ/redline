# frozen_string_literal: true

class Admin::InvitesController < Admin::BaseController
  def index
    @active_invites  = Invite.valid.includes(:room, :user).order(created_at: :desc)
    @expired_invites = Invite.where("expires_at IS NOT NULL AND expires_at <= ?", Time.current)
                             .or(Invite.where("max_uses > 0 AND uses >= max_uses"))
                             .includes(:room, :user)
                             .order(created_at: :desc)
                             .limit(50)
  end

  def purge_expired
    expired = Invite.where("expires_at IS NOT NULL AND expires_at <= ?", Time.current)
                    .or(Invite.where("max_uses > 0 AND uses >= max_uses"))
    count = expired.count
    expired.destroy_all
    AuditService.log(
      action: "admin.invites_purged",
      user: current_user,
      metadata: { count: count }
    )
    redirect_to admin_invites_path, notice: "Purged #{count} expired or exhausted #{"invite".pluralize(count)}."
  end
end
