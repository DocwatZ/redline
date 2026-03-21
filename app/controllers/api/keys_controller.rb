# frozen_string_literal: true

class Api::KeysController < ApplicationController
  before_action :authenticate_user!

  # Upload user's public key
  def update
    key = current_user.user_key || current_user.build_user_key
    key.public_key = params[:public_key]

    if key.save
      render json: { status: "ok" }, status: :ok
    else
      render json: { errors: key.errors.full_messages }, status: :unprocessable_entity
    end
  end

  # Get a user's public key by user_id
  def show
    user_key = UserKey.find_by(user_id: params[:user_id])
    if user_key
      render json: { user_id: user_key.user_id, public_key: user_key.public_key }
    else
      render json: { error: "No public key found" }, status: :not_found
    end
  end
end
