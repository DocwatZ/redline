# frozen_string_literal: true

# REDLINE Security Headers
# These headers are set on all responses to improve security posture.
Rails.application.config.action_dispatch.default_headers.merge!(
  "X-Content-Type-Options" => "nosniff",
  "X-Frame-Options" => "DENY",
  "X-XSS-Protection" => "0",
  "Referrer-Policy" => "strict-origin-when-cross-origin",
  "Permissions-Policy" => "camera=(self), microphone=(self), geolocation=()"
)
