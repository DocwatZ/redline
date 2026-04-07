# frozen_string_literal: true

Devise.setup do |config|
  config.mailer_sender = ENV.fetch("DEVISE_MAILER_FROM", "redline@example.com")
  require "devise/orm/active_record"

  config.case_insensitive_keys = [ :email ]
  config.strip_whitespace_keys = [ :email ]
  config.skip_session_storage = [ :http_auth ]
  config.stretches = Rails.env.test? ? 1 : 12
  config.reconfirmable = false
  config.expire_all_remember_me_on_sign_out = true
  config.password_length = 12..128
  config.email_regexp = /\A[^@\s]+@[^@\s]+\z/
  config.reset_password_within = 6.hours
  config.sign_out_via = :delete
  config.responder.error_status = :unprocessable_entity
  config.responder.redirect_status = :see_other
  config.navigational_formats = ['*/*', :html, :turbo_stream]

  # Support login via username or email
  config.authentication_keys = [ :login ]

  # Account locking after failed attempts
  # Using time-based unlock (not email) because email is optional in REDLINE
  config.lock_strategy = :failed_attempts
  config.unlock_keys = [ :email ]
  config.unlock_strategy = :time
  config.maximum_attempts = 10
  config.unlock_in = 1.hour
  config.last_attempt_warning = true

  # OmniAuth providers (configured via environment variables)
  if ENV["GITHUB_CLIENT_ID"].present? && ENV["GITHUB_CLIENT_SECRET"].present?
    config.omniauth :github,
      ENV["GITHUB_CLIENT_ID"],
      ENV["GITHUB_CLIENT_SECRET"],
      scope: "user:email"
  end

  if ENV["STEAM_API_KEY"].present?
    config.omniauth :steam, ENV["STEAM_API_KEY"]
  end
end
