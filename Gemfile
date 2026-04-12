source "https://rubygems.org"

ruby "3.2.3"

gem "rails", "~> 7.1.5"
gem "sprockets-rails"
gem "pg", "~> 1.1"
gem "puma", ">= 5.0"
gem "importmap-rails"
gem "turbo-rails"
gem "stimulus-rails"

gem "jbuilder"
gem "rexml"

# Redis for ActionCable and caching
gem "redis", ">= 4.0.1"

# Pin connection_pool to 2.x — version 3.0 changed to keyword-only args,
# which is incompatible with Rails 7.1's RedisCacheStore
gem "connection_pool", "~> 2.2"

# Authentication
gem "devise", "~> 4.9"
gem "bcrypt", "~> 3.1.7"
gem "omniauth", "~> 2.1"
gem "omniauth-github", "~> 2.0"
gem "omniauth-steam", "~> 1.0"
gem "omniauth-rails_csrf_protection", "~> 1.0"

# JWT for LiveKit token generation
gem "jwt", "~> 2.8"

# HTTP client for external API calls
gem "faraday", "~> 2.7"

# Security — rate limiting
gem "rack-attack", "~> 6.7"

# Image processing for ActiveStorage variants
gem "image_processing", "~> 1.2"

# Web push notifications
gem "webpush", "~> 1.1"

# Windows does not include zoneinfo files, so bundle the tzinfo-data gem
gem "tzinfo-data", platforms: %i[ windows jruby ]

# Reduces boot times through caching; required in config/boot.rb
gem "bootsnap", require: false

group :development, :test do
  gem "debug", platforms: %i[ mri windows ]
end

group :development do
  gem "web-console"
end

