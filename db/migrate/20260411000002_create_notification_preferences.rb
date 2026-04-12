# frozen_string_literal: true

class CreateNotificationPreferences < ActiveRecord::Migration[7.1]
  def change
    create_table :notification_preferences do |t|
      t.references :user, null: false, foreign_key: true, index: { unique: true }
      t.boolean :dm_sounds, default: true, null: false
      t.boolean :mention_alerts, default: true, null: false
      t.boolean :push_enabled, default: false, null: false
      t.timestamps
    end
  end
end
