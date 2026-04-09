# frozen_string_literal: true

# Generates LiveKit access tokens for WebRTC voice/video sessions.
# The client uses this token to join a LiveKit room.
#
# Supports:
# - Instant Join: users click a voice channel to join without ringing
# - Microphone auto-activation on connect
# - Screen sharing for users with screen_share permission
# - Deafening / muting via client-side controls
# - In-call text chat via LiveKit DataChannels
class LivekitController < ApplicationController
  def token
    room = Room.find_by!(slug: params[:room_id])

    unless room.voice_channel?
      render json: { error: "Not a voice channel" }, status: :bad_request
      return
    end

    membership = room.membership_for(current_user)

    unless membership || !room.private?
      render json: { error: "Access denied" }, status: :forbidden
      return
    end

    # Check voice connect permission
    if membership && !membership.can_connect?(room)
      render json: { error: "You do not have permission to connect to this channel" }, status: :forbidden
      return
    end

    token = generate_livekit_token(room, membership)
    render json: {
      token: token,
      url: ENV.fetch("LIVEKIT_URL", "ws://localhost:7880"),
      room: room.livekit_room_name,
      identity: current_user.id.to_s,
      channel_type: room.channel_type,
      can_screen_share: membership&.can_screen_share?(room) || false,
      has_in_call_chat: room.voice_channel?
    }
  end

  private

  def generate_livekit_token(room, membership)
    api_key    = ENV.fetch("LIVEKIT_API_KEY", "devkey")
    api_secret = ENV.fetch("LIVEKIT_API_SECRET", "devsecret")

    can_publish = membership&.can_speak?(room) != false
    can_subscribe = true
    can_publish_data = true  # Required for in-call DataChannel chat
    can_screen_share = membership&.can_screen_share?(room) || false
    can_publish_video = membership&.can_video?(room) != false

    # Build the list of allowed publish sources based on permissions.
    # LiveKit uses canPublishSources to restrict which tracks a user can send.
    allowed_sources = []
    allowed_sources << "microphone" if can_publish
    allowed_sources << "camera" if can_publish_video
    allowed_sources << "screen_share" if can_screen_share
    allowed_sources << "screen_share_audio" if can_screen_share

    grants = {
      roomJoin: true,
      room: room.livekit_room_name,
      canPublish: can_publish || can_publish_video,
      canSubscribe: can_subscribe,
      canPublishData: can_publish_data,
      canPublishSources: allowed_sources
    }

    token = JWT.encode(
      {
        iss: api_key,
        sub: current_user.id.to_s,
        iat: Time.now.to_i,
        exp: Time.now.to_i + 3600,
        nbf: Time.now.to_i - 10,
        name: current_user.display_name,
        video: grants,
        metadata: {
          can_screen_share: can_screen_share,
          user_display_name: current_user.display_name,
          user_avatar_color: current_user.avatar_color,
          user_initials: current_user.initials
        }.to_json
      },
      api_secret,
      "HS256"
    )

    token
  end
end
