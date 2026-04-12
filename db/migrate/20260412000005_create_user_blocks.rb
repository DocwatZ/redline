class CreateUserBlocks < ActiveRecord::Migration[7.1]
  def change
    create_table :user_blocks do |t|
      t.bigint :blocker_id, null: false
      t.bigint :blocked_id, null: false
      t.timestamps
    end
    add_index :user_blocks, [:blocker_id, :blocked_id], unique: true
    add_index :user_blocks, :blocked_id
  end
end
