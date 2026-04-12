# frozen_string_literal: true

class UserBlocksController < ApplicationController
  def create
    @blocked_user = User.find(params[:blocked_user_id])
    if @blocked_user == current_user
      redirect_back fallback_location: user_path(@blocked_user), alert: "Cannot block yourself."
      return
    end
    current_user.blocks_given.find_or_create_by!(blocked: @blocked_user)
    redirect_back fallback_location: user_path(@blocked_user), notice: "#{@blocked_user.display_name} has been blocked."
  rescue ActiveRecord::RecordNotFound
    redirect_back fallback_location: root_path, alert: "User not found."
  end

  def destroy
    block = current_user.blocks_given.find_by!(blocked_id: params[:blocked_user_id])
    block.destroy
    redirect_back fallback_location: user_path(User.find(params[:blocked_user_id])), notice: "User unblocked."
  rescue ActiveRecord::RecordNotFound
    redirect_back fallback_location: root_path, alert: "Block not found."
  end
end
