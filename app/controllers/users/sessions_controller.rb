# frozen_string_literal: true

class Users::SessionsController < Devise::SessionsController
  after_action :log_sign_in, only: :create
  after_action :log_sign_out, only: :destroy

  private

  def log_sign_in
    return unless current_user

    AuditService.log(
      action: "auth.login",
      user: current_user,
      request: request
    )
  end

  def log_sign_out
    AuditService.log(
      action: "auth.logout",
      metadata: { message: "User signed out" },
      request: request
    )
  end
end
