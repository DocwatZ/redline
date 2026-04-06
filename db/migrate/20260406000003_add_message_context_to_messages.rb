# frozen_string_literal: true

class AddMessageContextToMessages < ActiveRecord::Migration[7.1]
  def change
    add_column :messages, :message_context, :string, default: "standard"
  end
end
