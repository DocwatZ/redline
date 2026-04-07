# frozen_string_literal: true

require "net/http"
require "uri"
require "cgi"
require "openssl"
require "ipaddr"

class LinkPreviewService
  FETCH_TIMEOUT = 3 # seconds
  MAX_BODY_SIZE = 50_000 # bytes — only read enough HTML for meta tags
  MAX_REDIRECTS = 3
  USER_AGENT = "Redline LinkPreview/1.0"

  # URL pattern for extracting URLs from text.
  # Matches http:// and https:// URLs.
  URL_PATTERN = %r{
    https?://                           # scheme
    (?:[a-zA-Z0-9\-]+\.)+               # domain segments (each followed by a dot)
    [a-zA-Z]{2,}                        # TLD
    (?::\d{1,5})?                       # optional port
    (?:/[^\s<>\"\)\]\}]*)?              # optional path
  }x

  class << self
    # Extract all URLs from a text string.
    # Returns an array of hashes: { url: "...", suppressed: true/false }
    # URLs wrapped in angle brackets <URL> are marked as suppressed (no preview).
    def extract_urls(text)
      return [] if text.blank?

      urls = []

      # First, find angle-bracket-wrapped URLs (suppressed previews)
      text.scan(/<(#{URL_PATTERN})>/) do |match|
        urls << { url: match[0], suppressed: true }
      end
      suppressed_urls = urls.map { |u| u[:url] }

      # Then find all other URLs
      text.scan(URL_PATTERN).each do |url|
        next if suppressed_urls.include?(url)

        urls << { url: url, suppressed: false }
      end

      urls.uniq { |u| u[:url] }
    end

    # Fetch Open Graph / meta tag data for a URL.
    # Returns a Hash with :url, :title, :description, :image_url, :favicon_url, :site_name
    # or nil if the URL is invalid or unreachable.
    def fetch(url)
      return nil unless valid_url?(url)

      html = fetch_html(url)
      return nil if html.nil?

      uri = URI.parse(url)
      parse_metadata(html, uri)
    rescue URI::InvalidURIError, Encoding::UndefinedConversionError => e
      Rails.logger.debug { "LinkPreviewService: Failed to fetch #{url}: #{e.message}" }
      nil
    end

    private

    def valid_url?(url)
      uri = URI.parse(url)
      return false unless %w[http https].include?(uri.scheme) && uri.host.present?

      # Reject private/reserved IP addresses to prevent SSRF
      begin
        ip = IPAddr.new(uri.host)
        return false if ip.private? || ip.loopback? || ip.link_local?
      rescue IPAddr::InvalidAddressError
        # Not an IP address, check hostname
      end

      # Reject localhost and other dangerous hostnames
      return false if %w[localhost].include?(uri.host.downcase)
      return false if uri.host.downcase.end_with?(".local", ".internal")

      true
    rescue URI::InvalidURIError
      false
    end

    def fetch_html(url, redirects_remaining = MAX_REDIRECTS)
      uri = URI.parse(url)
      return nil unless %w[http https].include?(uri.scheme)

      http = Net::HTTP.new(uri.host, uri.port)
      http.use_ssl = (uri.scheme == "https")
      http.verify_mode = OpenSSL::SSL::VERIFY_PEER
      http.open_timeout = FETCH_TIMEOUT
      http.read_timeout = FETCH_TIMEOUT

      request = Net::HTTP::Get.new(uri)
      request["User-Agent"] = USER_AGENT
      request["Accept"] = "text/html"

      response = http.request(request)

      case response
      when Net::HTTPSuccess
        body = response.body.to_s
        body.encode("UTF-8", invalid: :replace, undef: :replace, replace: "")[0, MAX_BODY_SIZE]
      when Net::HTTPRedirection
        return nil if redirects_remaining <= 0

        location = response["location"]
        return nil if location.blank?

        # Resolve relative redirects
        redirect_uri = URI.parse(location)
        redirect_uri = URI.join(uri, location) unless redirect_uri.host

        # Validate redirect target against SSRF
        return nil unless valid_url?(redirect_uri.to_s)

        fetch_html(redirect_uri.to_s, redirects_remaining - 1)
      else
        nil
      end
    rescue Net::OpenTimeout, Net::ReadTimeout, SocketError, Errno::ECONNREFUSED,
           Errno::EHOSTUNREACH, OpenSSL::SSL::SSLError, IOError => e
      Rails.logger.debug { "LinkPreviewService: HTTP error for #{url}: #{e.message}" }
      nil
    end

    def parse_metadata(html, uri)
      data = {
        url: uri.to_s,
        title: nil,
        description: nil,
        image_url: nil,
        favicon_url: nil,
        site_name: nil
      }

      # Open Graph tags
      data[:title]       = extract_meta(html, "og:title")
      data[:description] = extract_meta(html, "og:description")
      data[:image_url]   = extract_meta(html, "og:image")
      data[:site_name]   = extract_meta(html, "og:site_name")

      # Twitter card fallbacks
      data[:title]       ||= extract_meta(html, "twitter:title")
      data[:description] ||= extract_meta(html, "twitter:description")
      data[:image_url]   ||= extract_meta(html, "twitter:image")

      # Standard meta tag fallbacks
      data[:title]       ||= extract_title_tag(html)
      data[:description] ||= extract_meta_name(html, "description")

      # Favicon
      data[:favicon_url] = extract_favicon(html, uri)

      # Truncate description
      if data[:description].present?
        data[:description] = data[:description].truncate(300)
      end

      # Resolve relative image URLs
      data[:image_url] = resolve_url(data[:image_url], uri) if data[:image_url].present?

      # Only return if we got at least a title or description
      return nil if data[:title].blank? && data[:description].blank?

      data
    end

    def extract_meta(html, property)
      match = html.match(/<meta[^>]*+(?:property|name)\s*=\s*["']#{Regexp.escape(property)}["'][^>]*+content\s*=\s*["']([^"']*+)["'][^>]*+>/i) ||
              html.match(/<meta[^>]*+content\s*=\s*["']([^"']*+)["'][^>]*+(?:property|name)\s*=\s*["']#{Regexp.escape(property)}["'][^>]*+>/i)
      match ? CGI.unescapeHTML(match[1].to_s.strip) : nil
    end

    def extract_meta_name(html, name)
      match = html.match(/<meta[^>]*+name\s*=\s*["']#{Regexp.escape(name)}["'][^>]*+content\s*=\s*["']([^"']*+)["'][^>]*+>/i) ||
              html.match(/<meta[^>]*+content\s*=\s*["']([^"']*+)["'][^>]*+name\s*=\s*["']#{Regexp.escape(name)}["'][^>]*+>/i)
      match ? CGI.unescapeHTML(match[1].to_s.strip) : nil
    end

    def extract_title_tag(html)
      match = html.match(/<title[^>]*+>([^<]*+)<\/title>/i)
      match ? CGI.unescapeHTML(match[1].to_s.strip) : nil
    end

    def extract_favicon(html, uri)
      match = html.match(/<link[^>]*+rel\s*=\s*["'](?:shortcut\s+)?icon["'][^>]*+href\s*=\s*["']([^"']*+)["'][^>]*+>/i) ||
              html.match(/<link[^>]*+href\s*=\s*["']([^"']*+)["'][^>]*+rel\s*=\s*["'](?:shortcut\s+)?icon["'][^>]*+>/i)

      if match
        resolve_url(match[1].to_s.strip, uri)
      else
        # Default favicon path
        port_str = [80, 443].include?(uri.port) ? "" : ":#{uri.port}"
        "#{uri.scheme}://#{uri.host}#{port_str}/favicon.ico"
      end
    end

    def resolve_url(url, base_uri)
      return url if url.blank?
      return url if url.start_with?("http://", "https://")

      port_str = [80, 443].include?(base_uri.port) ? "" : ":#{base_uri.port}"

      if url.start_with?("//")
        "#{base_uri.scheme}:#{url}"
      elsif url.start_with?("/")
        "#{base_uri.scheme}://#{base_uri.host}#{port_str}#{url}"
      else
        "#{base_uri.scheme}://#{base_uri.host}#{port_str}/#{url}"
      end
    end
  end
end
