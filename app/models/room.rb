# frozen_string_literal: true

class Room < ApplicationRecord
  belongs_to :owner, class_name: "User"
  has_many :room_memberships, dependent: :destroy
  has_many :members, through: :room_memberships, source: :user
  has_many :messages, dependent: :destroy
  has_many :room_keys, dependent: :destroy
  has_many :channel_permissions, dependent: :destroy
  has_many :invites, dependent: :destroy

  # Hierarchy: a room can be a subchannel of another room
  belongs_to :parent, class_name: "Room", optional: true
  has_many :subchannels, class_name: "Room", foreign_key: :parent_id, dependent: :destroy

  ROOM_TYPES = %w[text voice announcement dm public private].freeze

  # Channel types determine the primary communication mode
  # chat         = persistent text chat (marked with #️⃣)
  # both         = real-time voice & video with persistent text chat (marked with 🔊)
  # announcement = one-way broadcast channel (marked with 📢)
  CHANNEL_TYPES = %w[chat both announcement].freeze

  validates :name, presence: true, length: { minimum: 2, maximum: 64 },
            format: { with: /\A[a-zA-Z0-9\-_\s]+\z/, message: "only letters, numbers, spaces, hyphens, underscores" }
  validates :room_type, inclusion: { in: ROOM_TYPES }
  validates :channel_type, inclusion: { in: CHANNEL_TYPES }, allow_nil: true
  validates :slug, presence: true, uniqueness: true
  validates :position, numericality: { only_integer: true, greater_than_or_equal_to: 0 }

  validate :parent_must_be_voice_channel, if: :parent_id?
  validate :subchannel_must_be_voice, if: :parent_id?
  validate :no_deep_nesting, if: :parent_id?

  before_validation :generate_slug, on: :create
  before_validation :set_default_channel_type
  after_create :add_owner_as_admin

  scope :public_rooms, -> { where(private: false) }
  scope :by_name, -> { order(:name) }
  scope :by_position, -> { order(:position, :name) }
  scope :e2ee, -> { where(e2ee_enabled: true) }
  scope :top_level, -> { where(parent_id: nil) }
  scope :chats, -> { where(channel_type: %w[chat both]) }
  scope :voice_channels, -> { where(channel_type: "both") }
  scope :announcements, -> { where(channel_type: "announcement") }

  # --- Channel type queries ---

  def chat?
    channel_type == "chat" || channel_type == "both"
  end

  def voice_channel?
    channel_type == "both"
  end

  def combined?
    channel_type == "both"
  end

  def subchannel?
    parent_id.present?
  end

  # --- Legacy room_type queries (backward compatible) ---

  def text?
    room_type == "text"
  end

  def voice?
    room_type == "voice"
  end

  def announcement?
    # Check channel_type first; fall back to room_type for backward
    # compatibility with rooms created before the channel_type migration.
    channel_type == "announcement" || room_type == "announcement"
  end

  def dm?
    room_type == "dm"
  end

  def e2ee?
    e2ee_enabled?
  end

  # --- Display helpers ---

  # Returns the icon for this channel based on its type.
  # Checks channel_type first; falls back to room_type for
  # announcement rooms which predate the channel_type system.
  def channel_icon
    if announcement?
      "📢"
    elsif voice_channel?
      "🔊"
    else
      "#️⃣"
    end
  end

  # Returns the icon with optional modifiers (private, e2ee)
  def display_icon
    icon = channel_icon
    icon += "🗝️" if private?
    icon += "🔐" if e2ee?
    icon
  end

  # Returns the LiveKit room name (slug) for voice channels
  def livekit_room_name
    slug
  end

  def to_param
    slug
  end

  def member?(user)
    members.include?(user)
  end

  def membership_for(user)
    room_memberships.find_by(user: user)
  end

  # --- Permission helpers ---

  # Check if a user has a specific permission in this channel
  def user_can?(user, permission)
    membership = membership_for(user)
    return false unless membership

    # Admins and moderators have all permissions
    return true if membership.admin? || membership.moderator?

    # Check channel-specific permission override
    perm = channel_permissions.find_by(room_membership: membership)
    if perm
      perm.public_send(permission)
    else
      # Default permissions for members
      default_permission(permission)
    end
  end

  private

  def generate_slug
    self.slug ||= name.downcase.gsub(/[^a-z0-9]+/, "-").gsub(/(^-|-$)/, "")
    self.slug = "#{slug}-#{SecureRandom.hex(4)}" if Room.exists?(slug: slug)
  end

  def add_owner_as_admin
    room_memberships.create!(user: owner, role: "admin")
  end

  def set_default_channel_type
    # Auto-derive room_type from channel_type when channel_type is set
    if channel_type.present? && room_type.blank?
      self.room_type = case channel_type
      when "both" then "voice"
      when "announcement" then "announcement"
      else "text"
      end
      return
    end

    return if channel_type.present?

    self.channel_type = case room_type
    when "voice" then "both"
    when "announcement" then "announcement"
    when "text", "dm", "public", "private" then "chat"
    end
  end

  # Subchannels can only exist under voice or combined channels
  def parent_must_be_voice_channel
    return unless parent

    unless parent.voice_channel?
      errors.add(:parent_id, "must be a voice or combined channel")
    end
  end

  # Only voice (both) subchannels are allowed
  def subchannel_must_be_voice
    unless channel_type == "both"
      errors.add(:channel_type, "subchannels must be 🔊 Channel type")
    end
  end

  # Only one level of nesting is allowed (Channel -> Subchannel, no deeper)
  def no_deep_nesting
    if parent&.subchannel?
      errors.add(:parent_id, "cannot nest more than one level deep")
    end
  end

  # Default permissions for regular members
  def default_permission(permission)
    case permission.to_s
    when "view_channel", "send_messages", "read_message_history",
         "connect", "speak", "video"
      true
    when "create_invite", "screen_share", "mute_members",
         "deafen_members", "move_members"
      false
    else
      false
    end
  end
end
