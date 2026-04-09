# frozen_string_literal: true

class UsersController < ApplicationController
  def index
    users = User.where.not(id: current_user.id).order(:display_name)
    render json: users.map { |u|
      {
        id: u.id,
        display_name: u.display_name,
        username: u.username,
        initials: u.initials,
        avatar_color: u.avatar_color,
        status: u.status
      }
    }
  end

  def show
    @user = User.find(params[:id])
  end

  def update_status
    current_user.update!(status: params[:status]) if User::STATUSES.include?(params[:status])
    head :ok
  end
end
