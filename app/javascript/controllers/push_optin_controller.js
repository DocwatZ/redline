import { Controller } from "@hotwired/stimulus"

/**
 * PushOptinController — shows a "Enable notifications" banner once per session
 * when Notification.permission === "default", then handles the subscribe flow.
 *
 * The banner is rendered in the sidebar footer with the controller element
 * initially hidden. On connect(), if conditions are met, the element is shown.
 */
export default class extends Controller {
  static values = { vapidKey: String }

  connect() {
    if (!("Notification" in window) || !("serviceWorker" in navigator)) return
    if (Notification.permission !== "default") return
    if (sessionStorage.getItem("push-optin-dismissed")) return

    this.element.classList.remove("hidden")
  }

  async enable() {
    const permission = await Notification.requestPermission()
    if (permission === "granted") {
      await this.#subscribe()
    }
    this.#dismiss()
  }

  dismiss() {
    this.#dismiss()
  }

  // ── Private ────────────────────────────────────────────────────────────────

  #dismiss() {
    sessionStorage.setItem("push-optin-dismissed", "1")
    this.element.classList.add("hidden")
  }

  async #subscribe() {
    try {
      const reg = await navigator.serviceWorker.ready
      const existing = await reg.pushManager.getSubscription()
      if (existing) return

      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: this.#urlBase64ToUint8Array(this.vapidKeyValue)
      })
      const json = sub.toJSON()
      const csrf = document.querySelector('meta[name="csrf-token"]')?.content
      await fetch("/push_subscriptions", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-CSRF-Token": csrf ?? "" },
        body: JSON.stringify({ endpoint: json.endpoint, p256dh: json.keys.p256dh, auth: json.keys.auth })
      })
    } catch (e) {
      console.warn("[PushOptin] subscription failed:", e)
    }
  }

  #urlBase64ToUint8Array(base64String) {
    const padding = "=".repeat((4 - base64String.length % 4) % 4)
    const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/")
    const raw = atob(base64)
    const arr = new Uint8Array(raw.length)
    for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i)
    return arr
  }
}
