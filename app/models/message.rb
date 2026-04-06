# frozen_string_literal: true

class Message < ApplicationRecord
  belongs_to :room
  belongs_to :user
  belongs_to :parent, class_name: "Message", optional: true
  has_many :replies, class_name: "Message", foreign_key: :parent_id, dependent: :destroy

  MESSAGE_TYPES = %w[text system].freeze

  # Message context: indicates where/how the message was sent
  # standard   = regular text channel message
  # in_call    = message sent via voice channel in-call text chat (LiveKit DataChannel)
  MESSAGE_CONTEXTS = %w[standard in_call].freeze

  validates :body, presence: true, length: { maximum: 4000 }, unless: :e2ee_message?
  validates :ciphertext, presence: true, if: :e2ee_message?
  validates :message_type, inclusion: { in: MESSAGE_TYPES }

  before_validation :sanitize_body

  scope :recent, -> { order(created_at: :asc) }
  scope :visible, -> { where(deleted: false) }
  scope :standard_messages, -> { where(message_context: [nil, "standard"]) }
  scope :in_call_messages, -> { where(message_context: "in_call") }

  def display_body
    return "[message deleted]" if deleted?
    return "[encrypted]" if e2ee_message?
    body
  end

  def e2ee_message?
    ciphertext.present? || room&.e2ee_enabled?
  end

  def system?
    message_type == "system"
  end

  def in_call?
    message_context == "in_call"
  end

  private

  def sanitize_body
    self.body = body.to_s.strip if body.present?
  end
end
