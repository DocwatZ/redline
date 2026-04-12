class CreateCategories < ActiveRecord::Migration[7.1]
  def change
    create_table :categories do |t|
      t.string :name, null: false
      t.integer :position, default: 0, null: false
      t.timestamps
    end

    add_column :rooms, :category_id, :bigint
    add_index :rooms, :category_id
  end
end
