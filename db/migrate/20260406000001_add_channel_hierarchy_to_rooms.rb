# frozen_string_literal: true

class AddChannelHierarchyToRooms < ActiveRecord::Migration[7.1]
  def change
    # Channel type: chat (text #), voice (🔊), or both (chat+voice)
    add_column :rooms, :channel_type, :string, default: nil

    # Parent channel reference for subchannel hierarchy
    add_reference :rooms, :parent, foreign_key: { to_table: :rooms }, null: true

    # Display order within parent or top-level
    add_column :rooms, :position, :integer, default: 0, null: false
  end
end
