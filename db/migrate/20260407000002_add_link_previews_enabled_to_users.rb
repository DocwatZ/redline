# frozen_string_literal: true

class AddLinkPreviewsEnabledToUsers < ActiveRecord::Migration[7.1]
  def change
    add_column :users, :link_previews_enabled, :boolean, null: false, default: true
  end
end
