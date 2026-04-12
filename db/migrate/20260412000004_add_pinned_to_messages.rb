class AddPinnedToMessages < ActiveRecord::Migration[7.1]
  def change
    add_column :messages, :pinned, :boolean, default: false, null: false
  end
end
