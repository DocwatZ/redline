import { Controller } from "@hotwired/stimulus"

/**
 * E2EE controller — manages client-side end-to-end encryption using
 * the Web Crypto API (SubtleCrypto) with ECDH P-256 key agreement
 * and AES-GCM symmetric encryption.
 *
 * Key storage: private keys are stored in IndexedDB and never sent to the server.
 * Public keys are uploaded to /api/keys for the server to distribute.
 *
 * Usage:
 *   - Call encrypt(plaintext) → ciphertext (base64) using the room AES key
 *   - Call decrypt(ciphertext) → plaintext using the room AES key
 */
export default class extends Controller {
  static values = { roomId: Number, e2eeEnabled: Boolean }

  DB_NAME = "redline_e2ee"
  DB_VERSION = 1
  KEY_STORE = "keys"

  connect() {
    if (!this.e2eeEnabledValue) return
    this.roomKey = null
    this._init()
  }

  async _init() {
    try {
      this.db = await this._openDb()
      const privateKey = await this._getPrivateKey()
      if (privateKey) {
        this.privateKey = privateKey
      } else {
        await this._generateAndUploadKeyPair()
      }
      await this._loadRoomKey()
      this._updateBanner()
    } catch (err) {
      console.error("[E2EE] init error:", err)
      this._updateBanner()
    }
  }

  // ── Public API ──────────────────────────────────────────────────────────

  async encrypt(plaintext) {
    if (!this.roomKey) throw new Error("E2EE room key not loaded")
    const encoder = new TextEncoder()
    const iv = crypto.getRandomValues(new Uint8Array(12))
    const cipherBuffer = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      this.roomKey,
      encoder.encode(plaintext)
    )
    // Prepend IV (12 bytes) to ciphertext, then base64-encode
    const combined = new Uint8Array(iv.byteLength + cipherBuffer.byteLength)
    combined.set(iv, 0)
    combined.set(new Uint8Array(cipherBuffer), iv.byteLength)
    return btoa(String.fromCharCode(...combined))
  }

  async decrypt(ciphertextBase64) {
    if (!this.roomKey) throw new Error("E2EE room key not loaded")
    const combined = Uint8Array.from(atob(ciphertextBase64), c => c.charCodeAt(0))
    const iv = combined.slice(0, 12)
    const cipherBuffer = combined.slice(12)
    const plainBuffer = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv },
      this.roomKey,
      cipherBuffer
    )
    return new TextDecoder().decode(plainBuffer)
  }

  isReady() {
    return !!this.roomKey
  }

  // ── Key pair generation & upload ────────────────────────────────────────

  async _generateAndUploadKeyPair() {
    const keyPair = await crypto.subtle.generateKey(
      { name: "ECDH", namedCurve: "P-256" },
      true,
      ["deriveKey"]
    )
    const publicKeyBuffer = await crypto.subtle.exportKey("spki", keyPair.publicKey)
    const publicKeyBase64 = btoa(String.fromCharCode(...new Uint8Array(publicKeyBuffer)))

    // Store private key in IndexedDB
    await this._storePrivateKey(keyPair.privateKey)
    this.privateKey = keyPair.privateKey

    // Upload public key to server
    const token = document.querySelector('meta[name="csrf-token"]')?.content
    await fetch("/api/keys", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "X-CSRF-Token": token || ""
      },
      body: JSON.stringify({ public_key: publicKeyBase64 })
    })
  }

  // ── Room key loading ────────────────────────────────────────────────────

  async _loadRoomKey() {
    if (!this.privateKey || !this.roomIdValue) return

    try {
      const resp = await fetch(`/api/room_keys/${this.roomIdValue}`, {
        headers: { "Accept": "application/json" }
      })
      if (!resp.ok) return
      const data = await resp.json()
      if (!data.encrypted_room_key || !data.sender_public_key) return

      // Derive shared secret using ECDH
      const senderPubKeyBuffer = Uint8Array.from(atob(data.sender_public_key), c => c.charCodeAt(0))
      const senderPublicKey = await crypto.subtle.importKey(
        "spki",
        senderPubKeyBuffer,
        { name: "ECDH", namedCurve: "P-256" },
        false,
        []
      )
      const sharedSecret = await crypto.subtle.deriveKey(
        { name: "ECDH", public: senderPublicKey },
        this.privateKey,
        { name: "AES-GCM", length: 256 },
        false,
        ["decrypt"]
      )

      // Decrypt the room AES key
      const encryptedKey = Uint8Array.from(atob(data.encrypted_room_key), c => c.charCodeAt(0))
      const iv = encryptedKey.slice(0, 12)
      const keyData = encryptedKey.slice(12)
      const roomKeyBuffer = await crypto.subtle.decrypt(
        { name: "AES-GCM", iv },
        sharedSecret,
        keyData
      )
      this.roomKey = await crypto.subtle.importKey(
        "raw",
        roomKeyBuffer,
        { name: "AES-GCM" },
        false,
        ["encrypt", "decrypt"]
      )
    } catch (err) {
      console.error("[E2EE] room key load error:", err)
    }
  }

  // ── IndexedDB helpers ───────────────────────────────────────────────────

  _openDb() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(this.DB_NAME, this.DB_VERSION)
      req.onupgradeneeded = (e) => {
        e.target.result.createObjectStore(this.KEY_STORE)
      }
      req.onsuccess = (e) => resolve(e.target.result)
      req.onerror = (e) => reject(e.target.error)
    })
  }

  _getPrivateKey() {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(this.KEY_STORE, "readonly")
      const req = tx.objectStore(this.KEY_STORE).get("privateKey")
      req.onsuccess = (e) => resolve(e.target.result || null)
      req.onerror = (e) => reject(e.target.error)
    })
  }

  _storePrivateKey(key) {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(this.KEY_STORE, "readwrite")
      const req = tx.objectStore(this.KEY_STORE).put(key, "privateKey")
      req.onsuccess = () => resolve()
      req.onerror = (e) => reject(e.target.error)
    })
  }

  // ── UI helpers ──────────────────────────────────────────────────────────────

  _updateBanner() {
    const banner = document.getElementById("e2ee-status-banner")
    if (!banner) return
    const textEl = banner.querySelector("p")
    if (!textEl) return

    if (this.isReady()) {
      textEl.textContent = "Messages in this channel are encrypted. Your key is active."
      banner.style.borderLeftColor = "var(--rl-success, #22c55e)"
    } else {
      textEl.textContent = "Encryption key not available. A channel admin must share the room key with you before you can read or send messages."
      banner.style.borderLeftColor = "var(--rl-warning, #f59e0b)"
    }
  }
}
