# frozen_string_literal: true

# Sends Web Push notifications to users via the webpush gem.
# Requires VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY environment variables.
class PushNotificationService
  VAPID_SUBJECT = ENV.fetch("VAPID_SUBJECT", "mailto:admin@redline.app")

  def self.send_to_user(user, title:, body:, url: nil)
    return unless vapid_configured?

    prefs = user.notification_preference
    return unless prefs&.push_enabled

    user.push_subscriptions.each do |sub|
      send_push(sub, title: title, body: body, url: url)
    end
  end

  def self.vapid_configured?
    ENV["VAPID_PUBLIC_KEY"].present? && ENV["VAPID_PRIVATE_KEY"].present?
  end

  private_class_method def self.send_push(subscription, title:, body:, url: nil)
    payload = JSON.generate({ title: title, body: body, url: url }.compact)
    Webpush.payload_send(
      message: payload,
      endpoint: subscription.endpoint,
      p256dh: subscription.p256dh,
      auth: subscription.auth,
      vapid: {
        subject: VAPID_SUBJECT,
        public_key: ENV["VAPID_PUBLIC_KEY"],
        private_key: ENV["VAPID_PRIVATE_KEY"]
      }
    )
  rescue Webpush::ExpiredSubscription, Webpush::InvalidSubscription
    subscription.destroy
  rescue => e
    Rails.logger.warn("[PushNotificationService] send error: #{e.message}")
  end
end
