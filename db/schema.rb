# This file is auto-generated from the current state of the database. Instead
# of editing this file, please use the migrations feature of Active Record to
# incrementally modify your database, and then regenerate this schema definition.
#
# This file is the source Rails uses to define your schema when running `bin/rails
# db:schema:load`. When creating a new database, `bin/rails db:schema:load` tends to
# be faster and is potentially less error prone than running all of your
# migrations from scratch. Old migrations may fail to apply correctly if those
# migrations use external dependencies or application code.
#
# It's strongly recommended that you check this file into your version control system.

ActiveRecord::Schema[7.1].define(version: 2026_04_11_000002) do
  # These are extensions that must be enabled in order to support this database
  enable_extension "plpgsql"

  create_table "active_storage_attachments", force: :cascade do |t|
    t.string "name", null: false
    t.string "record_type", null: false
    t.bigint "record_id", null: false
    t.bigint "blob_id", null: false
    t.datetime "created_at", null: false
    t.index ["blob_id"], name: "index_active_storage_attachments_on_blob_id"
    t.index ["record_type", "record_id", "name", "blob_id"], name: "index_active_storage_attachments_uniqueness", unique: true
  end

  create_table "active_storage_blobs", force: :cascade do |t|
    t.string "key", null: false
    t.string "filename", null: false
    t.string "content_type"
    t.text "metadata"
    t.string "service_name", null: false
    t.bigint "byte_size", null: false
    t.string "checksum"
    t.datetime "created_at", null: false
    t.index ["key"], name: "index_active_storage_blobs_on_key", unique: true
  end

  create_table "active_storage_variant_records", force: :cascade do |t|
    t.bigint "blob_id", null: false
    t.string "variation_digest", null: false
    t.index ["blob_id", "variation_digest"], name: "index_active_storage_variant_records_uniqueness", unique: true
  end

  create_table "app_settings", force: :cascade do |t|
    t.boolean "self_signup_enabled", default: true, null: false
    t.string "request_access_url"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
  end

  create_table "audit_logs", force: :cascade do |t|
    t.bigint "user_id"
    t.string "action", null: false
    t.jsonb "metadata", default: {}
    t.string "ip_address"
    t.datetime "created_at", null: false
    t.index ["action"], name: "index_audit_logs_on_action"
    t.index ["created_at"], name: "index_audit_logs_on_created_at"
    t.index ["user_id"], name: "index_audit_logs_on_user_id"
  end

  create_table "channel_permissions", force: :cascade do |t|
    t.bigint "room_id", null: false
    t.bigint "room_membership_id", null: false
    t.boolean "view_channel", default: true, null: false
    t.boolean "send_messages", default: true, null: false
    t.boolean "read_message_history", default: true, null: false
    t.boolean "create_invite", default: false, null: false
    t.boolean "connect", default: true, null: false
    t.boolean "speak", default: true, null: false
    t.boolean "video", default: true, null: false
    t.boolean "screen_share", default: false, null: false
    t.boolean "mute_members", default: false, null: false
    t.boolean "deafen_members", default: false, null: false
    t.boolean "move_members", default: false, null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["room_id", "room_membership_id"], name: "idx_channel_perms_room_membership", unique: true
    t.index ["room_id"], name: "index_channel_permissions_on_room_id"
    t.index ["room_membership_id"], name: "index_channel_permissions_on_room_membership_id"
  end

  create_table "direct_messages", force: :cascade do |t|
    t.text "body", null: false
    t.bigint "sender_id", null: false
    t.bigint "recipient_id", null: false
    t.boolean "read", default: false, null: false
    t.boolean "edited", default: false, null: false
    t.boolean "deleted", default: false, null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["recipient_id", "read"], name: "index_direct_messages_on_recipient_id_and_read"
    t.index ["recipient_id"], name: "index_direct_messages_on_recipient_id"
    t.index ["sender_id", "recipient_id"], name: "index_direct_messages_on_sender_id_and_recipient_id"
    t.index ["sender_id"], name: "index_direct_messages_on_sender_id"
  end

  create_table "identities", force: :cascade do |t|
    t.bigint "user_id", null: false
    t.string "provider", null: false
    t.string "uid", null: false
    t.text "access_token"
    t.text "refresh_token"
    t.datetime "expires_at"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["provider", "uid"], name: "index_identities_on_provider_and_uid", unique: true
    t.index ["user_id"], name: "index_identities_on_user_id"
  end

  create_table "invites", force: :cascade do |t|
    t.bigint "room_id", null: false
    t.bigint "user_id", null: false
    t.string "code", null: false
    t.integer "max_uses", default: 0
    t.integer "uses", default: 0
    t.datetime "expires_at"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["code"], name: "index_invites_on_code", unique: true
    t.index ["room_id"], name: "index_invites_on_room_id"
    t.index ["user_id"], name: "index_invites_on_user_id"
  end

  create_table "link_previews", force: :cascade do |t|
    t.string "url", null: false
    t.string "title"
    t.text "description"
    t.string "image_url"
    t.string "favicon_url"
    t.string "site_name"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["url"], name: "index_link_previews_on_url", unique: true
  end

  create_table "message_reactions", force: :cascade do |t|
    t.bigint "message_id", null: false
    t.bigint "user_id", null: false
    t.string "emoji", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["message_id", "user_id", "emoji"], name: "idx_reactions_unique", unique: true
    t.index ["message_id"], name: "index_message_reactions_on_message_id"
    t.index ["user_id"], name: "index_message_reactions_on_user_id"
  end

  create_table "messages", force: :cascade do |t|
    t.text "body"
    t.bigint "room_id", null: false
    t.bigint "user_id", null: false
    t.bigint "parent_id"
    t.boolean "edited", default: false, null: false
    t.boolean "deleted", default: false, null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.text "ciphertext"
    t.string "message_type", default: "text", null: false
    t.string "message_context", default: "standard"
    t.index ["parent_id"], name: "index_messages_on_parent_id"
    t.index ["room_id", "created_at"], name: "index_messages_on_room_id_and_created_at"
    t.index ["room_id"], name: "index_messages_on_room_id"
    t.index ["user_id"], name: "index_messages_on_user_id"
  end

  create_table "notification_preferences", force: :cascade do |t|
    t.bigint "user_id", null: false
    t.boolean "dm_sounds", default: true, null: false
    t.boolean "mention_alerts", default: true, null: false
    t.boolean "push_enabled", default: false, null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["user_id"], name: "index_notification_preferences_on_user_id", unique: true
  end

  create_table "push_subscriptions", force: :cascade do |t|
    t.bigint "user_id", null: false
    t.string "endpoint", null: false
    t.string "p256dh", null: false
    t.string "auth", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["user_id", "endpoint"], name: "index_push_subscriptions_on_user_id_and_endpoint", unique: true
    t.index ["user_id"], name: "index_push_subscriptions_on_user_id"
  end

  create_table "recovery_codes", force: :cascade do |t|
    t.bigint "user_id", null: false
    t.string "code_digest", null: false
    t.datetime "used_at"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["user_id", "code_digest"], name: "index_recovery_codes_on_user_id_and_code_digest"
    t.index ["user_id"], name: "index_recovery_codes_on_user_id"
  end

  create_table "room_keys", force: :cascade do |t|
    t.bigint "room_id", null: false
    t.bigint "user_id", null: false
    t.text "encrypted_room_key", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["room_id", "user_id"], name: "index_room_keys_on_room_id_and_user_id", unique: true
    t.index ["room_id"], name: "index_room_keys_on_room_id"
    t.index ["user_id"], name: "index_room_keys_on_user_id"
  end

  create_table "room_memberships", force: :cascade do |t|
    t.bigint "room_id", null: false
    t.bigint "user_id", null: false
    t.string "role", default: "member", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["room_id", "user_id"], name: "index_room_memberships_on_room_id_and_user_id", unique: true
    t.index ["room_id"], name: "index_room_memberships_on_room_id"
    t.index ["user_id"], name: "index_room_memberships_on_user_id"
  end

  create_table "rooms", force: :cascade do |t|
    t.string "name", null: false
    t.text "description"
    t.string "room_type", default: "text", null: false
    t.boolean "private", default: false, null: false
    t.string "slug", null: false
    t.bigint "owner_id", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.boolean "e2ee_enabled", default: false, null: false
    t.string "channel_type"
    t.bigint "parent_id"
    t.integer "position", default: 0, null: false
    t.index ["name"], name: "index_rooms_on_name"
    t.index ["owner_id"], name: "index_rooms_on_owner_id"
    t.index ["parent_id"], name: "index_rooms_on_parent_id"
    t.index ["slug"], name: "index_rooms_on_slug", unique: true
  end

  create_table "user_keys", force: :cascade do |t|
    t.bigint "user_id", null: false
    t.text "public_key", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["user_id"], name: "index_user_keys_on_user_id", unique: true
  end

  create_table "users", force: :cascade do |t|
    t.string "email"
    t.string "encrypted_password", default: "", null: false
    t.string "display_name", default: "", null: false
    t.string "avatar_color", default: "#e53e3e", null: false
    t.string "status", default: "offline", null: false
    t.text "bio"
    t.string "reset_password_token"
    t.datetime "reset_password_sent_at"
    t.datetime "remember_created_at"
    t.integer "sign_in_count", default: 0, null: false
    t.datetime "current_sign_in_at"
    t.datetime "last_sign_in_at"
    t.string "current_sign_in_ip"
    t.string "last_sign_in_ip"
    t.integer "failed_attempts", default: 0, null: false
    t.string "unlock_token"
    t.datetime "locked_at"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.string "username"
    t.string "role", default: "user", null: false
    t.boolean "link_previews_enabled", default: true, null: false
    t.index ["email"], name: "index_users_on_email", unique: true, where: "((email IS NOT NULL) AND ((email)::text <> ''::text))"
    t.index ["reset_password_token"], name: "index_users_on_reset_password_token", unique: true
    t.index ["unlock_token"], name: "index_users_on_unlock_token", unique: true
    t.index ["username"], name: "index_users_on_username", unique: true
  end

  add_foreign_key "active_storage_attachments", "active_storage_blobs", column: "blob_id"
  add_foreign_key "active_storage_variant_records", "active_storage_blobs", column: "blob_id"
  add_foreign_key "audit_logs", "users"
  add_foreign_key "channel_permissions", "room_memberships"
  add_foreign_key "channel_permissions", "rooms"
  add_foreign_key "direct_messages", "users", column: "recipient_id"
  add_foreign_key "direct_messages", "users", column: "sender_id"
  add_foreign_key "identities", "users"
  add_foreign_key "invites", "rooms"
  add_foreign_key "invites", "users"
  add_foreign_key "message_reactions", "messages"
  add_foreign_key "message_reactions", "users"
  add_foreign_key "messages", "messages", column: "parent_id"
  add_foreign_key "messages", "rooms"
  add_foreign_key "messages", "users"
  add_foreign_key "notification_preferences", "users"
  add_foreign_key "push_subscriptions", "users"
  add_foreign_key "recovery_codes", "users"
  add_foreign_key "room_keys", "rooms"
  add_foreign_key "room_keys", "users"
  add_foreign_key "room_memberships", "rooms"
  add_foreign_key "room_memberships", "users"
  add_foreign_key "rooms", "rooms", column: "parent_id"
  add_foreign_key "rooms", "users", column: "owner_id"
  add_foreign_key "user_keys", "users"
end
