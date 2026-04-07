class MigrateVoiceChannelTypeToBoth < ActiveRecord::Migration[7.1]
  def up
    Room.where(channel_type: "voice").update_all(channel_type: "both")
  end

  def down
    # Cannot reliably reverse this migration since we can't distinguish
    # rooms that were originally "voice" from those that were already "both"
  end
end
