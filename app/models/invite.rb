# frozen_string_literal: true
class Invite < ApplicationRecord
  belongs_to :room
  belongs_to :user

  before_create :generate_code

  validates :code, presence: true, uniqueness: true

  scope :valid, -> { where("expires_at IS NULL OR expires_at > ?", Time.current) }

  def expired?
    expires_at.present? && expires_at < Time.current
  end

  def exhausted?
    max_uses.positive? && uses >= max_uses
  end

  def usable?
    !expired? && !exhausted?
  end

  private

  def generate_code
    self.code = SecureRandom.alphanumeric(10)
  end
end
