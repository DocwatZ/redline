# frozen_string_literal: true

class Users::RegistrationsController < Devise::RegistrationsController
  before_action :check_signup_enabled!, only: [:new, :create]

  def create
    # Turbo Drive sends Accept: text/vnd.turbo-stream.html, causing Rails to
    # negotiate turbo_stream format. The responders gem only renders the form
    # template for HTML format; for other formats it returns an empty 422 body,
    # which Turbo cannot process and displays a generic error page.
    request.format = :html

    super do |resource|
      if resource.persisted?
        @recovery_codes = RecoveryCodeService.generate(resource)
        AuditService.log(
          action: "auth.signup",
          user: resource,
          request: request
        )
      end
    end
  end

  protected

  def after_sign_up_path_for(resource)
    if @recovery_codes&.any?
      flash[:recovery_codes] = @recovery_codes
      recovery_codes_path
    else
      rooms_path
    end
  end

  def after_inactive_sign_up_path_for(resource)
    new_user_session_path
  end

  private

  def check_signup_enabled!
    unless AppSetting.instance.self_signup_enabled?
      redirect_to registration_closed_path
    end
  end
end
