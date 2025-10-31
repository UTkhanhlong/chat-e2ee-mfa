// lib/e2ee.ts
export type KeyPair = { publicKey: CryptoKey; privateKey: CryptoKey }

// 🔑 Sinh cặp khóa ECDH
export async function generateKeyPair(): Promise<KeyPair> {
  return await crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    ['deriveKey', 'deriveBits']
  )
}

// 📤 Xuất public key (base64)
export async function exportPublicKey(key: CryptoKey): Promise<string> {
  const raw = await crypto.subtle.exportKey('spki', key)
  return btoa(String.fromCharCode(...new Uint8Array(raw)))
}

// 📥 Nhập public key từ base64
export async function importPublicKey(b64: string): Promise<CryptoKey> {
  const buf = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))
  return await crypto.subtle.importKey(
    'spki',
    buf,
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    []
  )
}

// 🔐 Derive AES key từ ECDH private & peer public
export async function deriveAesKey(priv: CryptoKey, peerPub: CryptoKey): Promise<CryptoKey> {
  return await crypto.subtle.deriveKey(
    { name: 'ECDH', public: peerPub },
    priv,
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  )
}

// 🧱 Mã hóa tin nhắn
export async function encryptMessage(aesKey: CryptoKey, plaintext: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const encoded = new TextEncoder().encode(plaintext)
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, aesKey, encoded)
  return {
    ciphertext: btoa(String.fromCharCode(...new Uint8Array(ciphertext))),
    iv: btoa(String.fromCharCode(...iv)),
  }
}

// 🔓 Giải mã tin nhắn
export async function decryptMessage(aesKey: CryptoKey, ciphertextB64: string, ivB64: string) {
  try {
    const ciphertext = Uint8Array.from(atob(ciphertextB64), (c) => c.charCodeAt(0))
    const iv = Uint8Array.from(atob(ivB64), (c) => c.charCodeAt(0))
    const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, aesKey, ciphertext)
    return new TextDecoder().decode(decrypted)
  } catch {
    return '(Không thể giải mã)'
  }
}

// 🧷 Export/import AES key base64
export async function exportAesKey(key: CryptoKey): Promise<string> {
  const raw = await crypto.subtle.exportKey('raw', key)
  return btoa(String.fromCharCode(...new Uint8Array(raw)))
}

export async function importAesKey(b64: string): Promise<CryptoKey> {
  const buf = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))
  return await crypto.subtle.importKey('raw', buf, { name: 'AES-GCM' }, true, [
    'encrypt',
    'decrypt',
  ])
}
