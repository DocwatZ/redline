# frozen_string_literal: true

class CreateUserKeys < ActiveRecord::Migration[7.1]
  def change
    create_table :user_keys do |t|
      t.references :user, null: false, foreign_key: true, index: { unique: true }
      t.text :public_key, null: false

      t.timestamps null: false
    end
  end
end
