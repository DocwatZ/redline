# frozen_string_literal: true
class CreateInvites < ActiveRecord::Migration[7.1]
  def change
    create_table :invites do |t|
      t.references :room, null: false, foreign_key: true
      t.references :user, null: false, foreign_key: true
      t.string :code, null: false
      t.integer :max_uses, default: 0
      t.integer :uses, default: 0
      t.datetime :expires_at
      t.timestamps
    end
    add_index :invites, :code, unique: true
  end
end
