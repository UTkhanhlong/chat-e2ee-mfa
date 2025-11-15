// lib/e2ee.ts
export type KeyPair = { publicKey: CryptoKey; privateKey: CryptoKey }

/* ================================
   1. ECDH: DÀNH CHO PFS (Perfect Forward Secrecy)
   ================================ */
export async function generateEcdhKeyPair(): Promise<KeyPair> {
  return crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    ['deriveKey', 'deriveBits']
  )
}

export async function importEcdhPublicKey(b64: string): Promise<CryptoKey> {
  const buf = Uint8Array.from(atob(b64), c => c.charCodeAt(0))
  return crypto.subtle.importKey(
    'spki',
    buf,
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    []
  )
}

/* ================================
   2. ECDSA: DÀNH CHO CHỮ KÝ SỐ (Digital Signature)
   ================================ */
export async function generateEcdsaKeyPair(): Promise<KeyPair> {
  return crypto.subtle.generateKey(
    { name: 'ECDSA', namedCurve: 'P-256' },
    true,
    ['sign', 'verify']
  )
}

export async function importEcdsaPublicKey(b64: string): Promise<CryptoKey> {
  const buf = Uint8Array.from(atob(b64), c => c.charCodeAt(0))
  return crypto.subtle.importKey(
    'spki',
    buf,
    { name: 'ECDSA', namedCurve: 'P-256' },
    true,
    ['verify']
  )
}

/* ================================
   3. HÀM CHUNG
   ================================ */
export async function exportPublicKey(key: CryptoKey): Promise<string> {
  const raw = await crypto.subtle.exportKey('spki', key)
  return btoa(String.fromCharCode(...new Uint8Array(raw)))
}

/**
 * Derive AES-GCM key từ ECDH private + peer ECDH public
 */
export async function deriveAesKey(ecdhPriv: CryptoKey, peerEcdhPub: CryptoKey): Promise<CryptoKey> {
  return crypto.subtle.deriveKey(
    { name: 'ECDH', public: peerEcdhPub },
    ecdhPriv,
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  )
}

/**
 * Mã hóa tin nhắn
 */
export async function encryptMessage(aesKey: CryptoKey, plaintext: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const encoded = new TextEncoder().encode(plaintext)
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, aesKey, encoded)

  return {
    ciphertext: btoa(String.fromCharCode(...new Uint8Array(ciphertext))),
    iv: btoa(String.fromCharCode(...new Uint8Array(iv))),
  }
}

/**
 * Giải mã tin nhắn
 */
export async function decryptMessage(aesKey: CryptoKey, ciphertextB64: string, ivB64: string): Promise<string> {
  try {
    const ciphertext = Uint8Array.from(atob(ciphertextB64), c => c.charCodeAt(0))
    const iv = Uint8Array.from(atob(ivB64), c => c.charCodeAt(0))
    const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, aesKey, ciphertext)
    return new TextDecoder().decode(decrypted)
  } catch (err) {
    console.error('Giải mã thất bại:', err)
    return '(Tin nhắn không thể giải mã)'
  }
}

/**
 * Ký dữ liệu bằng ECDSA private key
 */
export async function signData(ecdsaPriv: CryptoKey, data: string): Promise<string> {
  const dataBuffer = new TextEncoder().encode(data)
  const signature = await crypto.subtle.sign(
    { name: 'ECDSA', hash: { name: 'SHA-256' } },
    ecdsaPriv,
    dataBuffer
  )
  return btoa(String.fromCharCode(...new Uint8Array(signature)))
}

/**
 * Xác minh chữ ký bằng ECDSA public key
 */
export async function verifySignature(
  ecdsaPub: CryptoKey,
  data: string,
  signatureB64: string
): Promise<boolean> {
  try {
    const dataBuffer = new TextEncoder().encode(data)
    const signature = Uint8Array.from(atob(signatureB64), c => c.charCodeAt(0))
    return await crypto.subtle.verify(
      { name: 'ECDSA', hash: { name: 'SHA-256' } },
      ecdsaPub,
      signature,
      dataBuffer
    )
  } catch (e) {
    console.error('Lỗi xác minh chữ ký:', e)
    return false
  }
}

/* ================================
   4. AES KEY (BACKUP - KHÔNG KHUYẾN CÁO)
   ================================ */
export async function exportAesKey(key: CryptoKey): Promise<string> {
  const raw = await crypto.subtle.exportKey('raw', key)
  return btoa(String.fromCharCode(...new Uint8Array(raw)))
}

export async function importAesKey(b64: string): Promise<CryptoKey> {
  const buf = Uint8Array.from(atob(b64), c => c.charCodeAt(0))
  return crypto.subtle.importKey(
    'raw',
    buf,
    { name: 'AES-GCM' },
    true,
    ['encrypt', 'decrypt']
  )
}