# frozen_string_literal: true

class CreateAppSettings < ActiveRecord::Migration[7.1]
  def change
    create_table :app_settings do |t|
      t.boolean :self_signup_enabled, default: true, null: false
      t.string  :request_access_url,  default: "https://steamcommunity.com/groups/G13UK/"

      t.timestamps
    end
  end
end
