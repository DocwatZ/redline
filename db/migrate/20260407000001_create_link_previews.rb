# frozen_string_literal: true

class CreateLinkPreviews < ActiveRecord::Migration[7.1]
  def change
    create_table :link_previews do |t|
      t.string :url, null: false
      t.string :title
      t.text :description
      t.string :image_url
      t.string :favicon_url
      t.string :site_name

      t.timestamps
    end

    add_index :link_previews, :url, unique: true
  end
end
