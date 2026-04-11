# This migration comes from active_storage (originally 20170806125915)
class CreateActiveStorageTables < ActiveRecord::Migration[7.1]
  def change
    create_table :active_storage_blobs, id: :primary_key do |t|
      t.string   :key,          null: false
      t.string   :filename,     null: false
      t.string   :content_type
      t.text     :metadata
      t.string   :service_name, null: false
      t.bigint   :byte_size,    null: false
      t.string   :checksum
      t.datetime :created_at,   null: false
    end
    add_index :active_storage_blobs, [:key], unique: true
    create_table :active_storage_attachments, id: :primary_key do |t|
      t.string     :name,     null: false
      t.references :record,   null: false, polymorphic: true, index: false
      t.references :blob,     null: false
      t.datetime   :created_at, null: false
    end
    add_foreign_key :active_storage_attachments, :active_storage_blobs, column: :blob_id
    add_index :active_storage_attachments, [:record_type, :record_id, :name, :blob_id], unique: true, name: "index_active_storage_attachments_uniqueness"
    create_table :active_storage_variant_records do |t|
      t.belongs_to :blob, null: false, index: false
      t.string :variation_digest, null: false
    end
    add_index :active_storage_variant_records, [:blob_id, :variation_digest], unique: true, name: "index_active_storage_variant_records_uniqueness"
    add_foreign_key :active_storage_variant_records, :active_storage_blobs, column: :blob_id
  end
end
