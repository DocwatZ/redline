# frozen_string_literal: true

class PushSubscriptionsController < ApplicationController
  before_action :authenticate_user!

  def create
    sub = current_user.push_subscriptions.find_or_initialize_by(endpoint: params[:endpoint])
    sub.p256dh = params[:p256dh]
    sub.auth   = params[:auth]

    if sub.save
      # Enable push in notification preferences
      pref = NotificationPreference.for_user(current_user)
      pref.update(push_enabled: true)
      head :created
    else
      render json: { errors: sub.errors.full_messages }, status: :unprocessable_entity
    end
  end

  def destroy
    sub = current_user.push_subscriptions.find_by(id: params[:id])
    sub&.destroy
    head :no_content
  end
end
