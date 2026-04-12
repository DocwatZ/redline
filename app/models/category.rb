# frozen_string_literal: true

class Category < ApplicationRecord
  has_many :rooms, dependent: :nullify
  validates :name, presence: true, length: { maximum: 64 }
  default_scope { order(:position, :name) }
end
