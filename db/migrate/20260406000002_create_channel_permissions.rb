# frozen_string_literal: true

class CreateChannelPermissions < ActiveRecord::Migration[7.1]
  def change
    create_table :channel_permissions do |t|
      t.references :room, null: false, foreign_key: true
      t.references :room_membership, null: false, foreign_key: true

      # Chat permissions
      t.boolean :view_channel, default: true, null: false
      t.boolean :send_messages, default: true, null: false
      t.boolean :read_message_history, default: true, null: false
      t.boolean :create_invite, default: false, null: false

      # Voice permissions
      t.boolean :connect, default: true, null: false
      t.boolean :speak, default: true, null: false
      t.boolean :video, default: true, null: false
      t.boolean :screen_share, default: false, null: false
      t.boolean :mute_members, default: false, null: false
      t.boolean :deafen_members, default: false, null: false
      t.boolean :move_members, default: false, null: false

      t.timestamps
    end

    add_index :channel_permissions, [:room_id, :room_membership_id], unique: true, name: "idx_channel_perms_room_membership"
  end
end
