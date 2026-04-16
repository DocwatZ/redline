# Pin npm packages by running ./bin/importmap

pin "application", preload: true
pin "@hotwired/turbo-rails", to: "turbo.min.js", preload: true
pin "@hotwired/stimulus", to: "stimulus.min.js", preload: true
pin "@hotwired/stimulus-loading", to: "stimulus-loading.js", preload: true
pin "@rails/actioncable", to: "actioncable.esm.js", preload: true

# Application controllers
pin "controllers/application", to: "controllers/application.js"
pin "controllers/index", to: "controllers/index.js"
pin "controllers/chat_controller", to: "controllers/chat_controller.js"
pin "controllers/dm_chat_controller", to: "controllers/dm_chat_controller.js"
pin "controllers/message_input_controller", to: "controllers/message_input_controller.js"
pin "controllers/dm_input_controller", to: "controllers/dm_input_controller.js"
pin "controllers/markdown_controller", to: "controllers/markdown_controller.js"
pin "controllers/password_toggle_controller", to: "controllers/password_toggle_controller.js"
pin "controllers/sidebar_controller", to: "controllers/sidebar_controller.js"
pin "controllers/link_preview_controller", to: "controllers/link_preview_controller.js"
pin "controllers/channel_controller", to: "controllers/channel_controller.js"
pin "controllers/bottom_sheet_controller", to: "controllers/bottom_sheet_controller.js"
pin "controllers/media_controls_controller", to: "controllers/media_controls_controller.js"

pin "controllers/message_actions_controller", to: "controllers/message_actions_controller.js"
pin "controllers/new_dm_controller",          to: "controllers/new_dm_controller.js"
pin "controllers/status_picker_controller",   to: "controllers/status_picker_controller.js"
pin "controllers/search_controller",          to: "controllers/search_controller.js"
pin "controllers/invite_controller",          to: "controllers/invite_controller.js"
pin "controllers/e2ee_controller",            to: "controllers/e2ee_controller.js"
pin "controllers/username_check_controller",  to: "controllers/username_check_controller.js"
pin "controllers/member_role_controller",     to: "controllers/member_role_controller.js"

# Services
pin "services/livekit_singleton", to: "services/livekit_singleton.js"

# Channels
pin "channels/consumer", to: "channels/consumer.js"
pin "channels/index", to: "channels/index.js"
pin "channels/presence_channel", to: "channels/presence_channel.js"
pin "channels/user_notifications_channel", to: "channels/user_notifications_channel.js"
pin "controllers", to: "controllers/index.js"
pin "controllers/compose_helpers",           to: "controllers/compose_helpers.js"
pin "channels", to: "channels/index.js"

# LiveKit client (loaded dynamically by livekit_controller)
pin "livekit-client", to: "https://cdn.jsdelivr.net/npm/livekit-client@2.5.5/dist/livekit-client.esm.mjs", preload: false
