# frozen_string_literal: true

class Admin::SettingsController < Admin::BaseController
  def show
    @settings = AppSetting.instance
  end

  def update
    @settings = AppSetting.instance
    if @settings.update(settings_params)
      AuditService.log(
        action:   "admin.settings_updated",
        user:     current_user,
        metadata: { self_signup_enabled: @settings.self_signup_enabled },
        request:  request
      )
      redirect_to admin_settings_path, notice: "Settings saved."
    else
      render :show, status: :unprocessable_entity
    end
  end

  private

  def settings_params
    params.require(:app_setting).permit(:self_signup_enabled, :request_access_url)
  end
end
