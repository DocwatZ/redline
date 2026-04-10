# frozen_string_literal: true

class DirectMessage < ApplicationRecord
  belongs_to :sender, class_name: "User"
  belongs_to :recipient, class_name: "User"
  has_many_attached :files

  validates :body, presence: true, length: { maximum: 4000 }

  before_validation :sanitize_body

  scope :between, ->(user_a_id, user_b_id) {
    where(
      "(sender_id = ? AND recipient_id = ?) OR (sender_id = ? AND recipient_id = ?)",
      user_a_id, user_b_id, user_b_id, user_a_id
    ).order(created_at: :asc)
  }

  scope :conversation, ->(user_a_id, user_b_id) {
    between(user_a_id, user_b_id).where(deleted: false)
  }

  def display_body
    deleted? ? "[message deleted]" : body
  end

  private

  def sanitize_body
    self.body = body.to_s.strip
  end
end
