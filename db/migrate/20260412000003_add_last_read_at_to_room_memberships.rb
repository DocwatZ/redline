class AddLastReadAtToRoomMemberships < ActiveRecord::Migration[7.1]
  def change
    add_column :room_memberships, :last_read_at, :datetime
  end
end
