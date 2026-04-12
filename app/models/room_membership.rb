# frozen_string_literal: true

class RoomMembership < ApplicationRecord
  belongs_to :room
  belongs_to :user
  has_many :channel_permissions, dependent: :destroy

  ROLES = %w[member moderator admin].freeze

  validates :role, inclusion: { in: ROLES }
  validates :user_id, uniqueness: { scope: :room_id }

  def admin?
    role == "admin"
  end

  def moderator?
    role == "moderator" || admin?
  end

  # Check a specific permission for this membership in a given channel
  def has_permission?(channel, permission)
    # Admins and moderators bypass permission checks
    return true if admin? || moderator?

    perm = channel_permissions.find_by(room: channel)
    if perm
      perm.public_send(permission)
    else
      ChannelPermission.member_defaults[permission.to_s] || false
    end
  end

  # Can this member send messages in the given channel?
  def can_send_messages?(channel = room)
    has_permission?(channel, :send_messages)
  end

  # Can this member read message history in the given channel?
  def can_read_history?(channel = room)
    has_permission?(channel, :read_message_history)
  end

  # Can this member view the given channel?
  def can_view?(channel = room)
    has_permission?(channel, :view_channel)
  end

  # Can this member connect to voice?
  def can_connect?(channel = room)
    has_permission?(channel, :connect)
  end

  # Can this member speak (transmit audio) in voice?
  def can_speak?(channel = room)
    has_permission?(channel, :speak)
  end

  # Can this member transmit video?
  def can_video?(channel = room)
    has_permission?(channel, :video)
  end

  # Can this member share their screen?
  def can_screen_share?(channel = room)
    has_permission?(channel, :screen_share)
  end

  def unread?(room)
    return false if last_read_at.nil?
    room.messages.where("created_at > ?", last_read_at).exists?
  end
end
