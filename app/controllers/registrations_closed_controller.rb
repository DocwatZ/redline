# frozen_string_literal: true

# Shown when self-signup is disabled; provides REDLINE branding,
# a Sign In link for existing users, and the configurable Request Access URL.
class RegistrationsClosedController < ApplicationController
  skip_before_action :authenticate_user!

  def show
    @settings = AppSetting.instance
  end
end
