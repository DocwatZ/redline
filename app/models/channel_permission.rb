# frozen_string_literal: true

class ChannelPermission < ApplicationRecord
  belongs_to :room
  belongs_to :room_membership

  validates :room_membership_id, uniqueness: { scope: :room_id }

  # Chat permission set required for text channels
  CHAT_PERMISSIONS = %w[view_channel send_messages read_message_history create_invite].freeze

  # Voice permission set required for voice channels
  VOICE_PERMISSIONS = %w[connect speak video screen_share mute_members deafen_members move_members].freeze

  # All manageable permissions
  ALL_PERMISSIONS = (CHAT_PERMISSIONS + VOICE_PERMISSIONS).freeze

  # Permissions required to participate in a Chat# channel
  CHAT_REQUIRED = %w[view_channel send_messages read_message_history].freeze

  # Permissions required for in-voice text chat
  IN_VOICE_CHAT_REQUIRED = %w[send_messages read_message_history].freeze

  # Build default permissions for admin role
  def self.admin_defaults
    ALL_PERMISSIONS.index_with { true }
  end

  # Build default permissions for moderator role
  def self.moderator_defaults
    defaults = ALL_PERMISSIONS.index_with { true }
    defaults["move_members"] = false
    defaults
  end

  # Build default permissions for member role
  def self.member_defaults
    {
      "view_channel" => true,
      "send_messages" => true,
      "read_message_history" => true,
      "create_invite" => false,
      "connect" => true,
      "speak" => true,
      "video" => true,
      "screen_share" => false,
      "mute_members" => false,
      "deafen_members" => false,
      "move_members" => false
    }
  end
end
