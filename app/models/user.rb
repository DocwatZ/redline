# frozen_string_literal: true

class User < ApplicationRecord
  attr_accessor :login

  # Build provider list based on what's actually configured via env vars
  OMNIAUTH_PROVIDERS = [].tap do |providers|
    providers << :github if ENV["GITHUB_CLIENT_ID"].present? && ENV["GITHUB_CLIENT_SECRET"].present?
    providers << :steam  if ENV["STEAM_API_KEY"].present?
  end.freeze

  devise :database_authenticatable, :registerable,
         :recoverable, :rememberable, :validatable,
         :lockable, :trackable,
         :omniauthable, omniauth_providers: OMNIAUTH_PROVIDERS

  has_many :room_memberships, dependent: :destroy
  has_many :rooms, through: :room_memberships
  has_many :owned_rooms, class_name: "Room", foreign_key: :owner_id, dependent: :destroy
  has_many :messages, dependent: :destroy
  has_many :sent_direct_messages, class_name: "DirectMessage",
           foreign_key: :sender_id, dependent: :destroy
  has_many :received_direct_messages, class_name: "DirectMessage",
           foreign_key: :recipient_id, dependent: :destroy
  has_many :identities, dependent: :destroy
  has_many :recovery_codes, dependent: :destroy
  has_one :user_key, dependent: :destroy
  has_many :room_keys, dependent: :destroy
  has_many :audit_logs, dependent: :nullify

  STATUSES = %w[online away busy offline].freeze
  AVATAR_COLORS = %w[#e53e3e #dd6b20 #d69e2e #38a169 #3182ce #805ad5 #d53f8c].freeze
  ROLES = %w[user admin].freeze

  validates :display_name, presence: true, length: { minimum: 2, maximum: 32 }
  validates :username, presence: true, uniqueness: { case_sensitive: false },
            length: { minimum: 3, maximum: 32 },
            format: { with: /\A[a-zA-Z0-9_\-]+\z/, message: "only letters, numbers, underscores, and hyphens" }
  validates :status, inclusion: { in: STATUSES }
  validates :role, inclusion: { in: ROLES }
  validates :email, uniqueness: { case_sensitive: false, allow_blank: true },
            format: { with: /\A[^@\s]+@[^@\s]+\z/, allow_blank: true }

  before_validation :set_defaults, on: :create

  def online?
    status == "online"
  end

  def admin?
    role == "admin"
  end

  def initials
    display_name.split.map(&:first).first(2).join.upcase
  end

  def dm_partner?(user)
    DirectMessage.between(id, user.id).exists?
  end

  # Allow username or email login
  def self.find_for_database_authentication(warden_conditions)
    conditions = warden_conditions.dup
    login = conditions.delete(:login)&.downcase&.strip
    if login.present?
      where("LOWER(username) = :login OR LOWER(email) = :login", login: login).first
    elsif conditions.key?(:username)
      where("LOWER(username) = ?", conditions[:username].downcase.strip).first
    elsif conditions.key?(:email)
      where("LOWER(email) = ?", conditions[:email].downcase.strip).first
    end
  end

  # Override Devise — email is NOT required
  def email_required?
    false
  end

  def email_changed?
    super if email.present?
  end

  def will_save_change_to_email?
    super if email.present?
  end

  # Override Devise — password is not required for OAuth-only users
  def password_required?
    return false if identities.any? && password.blank?
    !persisted? || !password.nil? || !password_confirmation.nil?
  end

  private

  def set_defaults
    self.username = generate_username if username.blank?
    self.display_name = username if display_name.blank?
    self.avatar_color = AVATAR_COLORS.sample if avatar_color.blank?
    self.role ||= "user"
  end

  def generate_username
    if email.present?
      base = email.split("@").first.gsub(/[^a-zA-Z0-9_\-]/, "")
    else
      base = "user"
    end
    base = base[0..27] # leave room for suffix
    candidate = base
    counter = 1
    while User.exists?(username: candidate)
      candidate = "#{base}#{counter}"
      counter += 1
    end
    candidate
  end
end
