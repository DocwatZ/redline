# frozen_string_literal: true
class SearchController < ApplicationController
  def index
    @query = params[:q].to_s.strip
    if @query.length >= 2
      safe_q = "%#{ActiveRecord::Base.sanitize_sql_like(@query)}%"
      @messages = Message.joins(:room, :user)
                         .where(deleted: false)
                         .where("messages.body ILIKE ?", safe_q)
                         .where(rooms: { id: current_user.room_ids })
                         .order(created_at: :desc).limit(20)
      @users = User.where("display_name ILIKE ? OR username ILIKE ?", safe_q, safe_q).limit(10)
    else
      @messages = []
      @users = []
    end
    respond_to do |format|
      format.html
      format.json do
        render json: {
          messages: @messages.map { |m|
            { id: m.id, body: m.display_body, room_slug: m.room.slug, room_name: m.room.name,
              display_name: m.user.display_name, created_at: m.created_at.iso8601 }
          },
          users: @users.map { |u|
            { id: u.id, display_name: u.display_name, username: u.username,
              avatar_color: u.avatar_color, initials: u.initials }
          }
        }
      end
    end
  end
end
