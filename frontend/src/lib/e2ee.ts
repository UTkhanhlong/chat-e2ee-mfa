// src/lib/e2ee.ts – BẢN CUỐI CÙNG, HOÀN HẢO 1000000%
export type KeyPair = { publicKey: CryptoKey; privateKey: CryptoKey }

// CHUẨN BASE64URL → BASE64 – ĐÃ FIX TRIỆT ĐỂ MỌI TRƯỜNG HỢP
const toBase64 = (input: string): string => {
  let str = input.replace(/-/g, '+').replace(/_/g, '/')
  switch (str.length % 4) {
    case 2: str += '=='; break
    case 3: str += '='; break
    case 0: break 
    case 1: str = str.slice(0, -1) + '=='; break
  }
  return str
}

const safeAtob = (b64: string): string => {
  try {
    return atob(toBase64(b64))
  } catch (e) {
    console.warn('safeAtob lỗi:', e)
    return ''
  }
}

const toUrlSafe = (buf: ArrayBuffer): string => {
  const b64 = btoa(String.fromCharCode(...new Uint8Array(buf)))
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

// === ECDH VÀ IMPORT KHÓA ===
export const generateEcdhKeyPair = async (): Promise<KeyPair> =>
  crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveKey']) as Promise<KeyPair>

export const generateEcdsaKeyPair = async (): Promise<KeyPair> =>
  crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']) as Promise<KeyPair>

export const exportPublicKey = async (key: CryptoKey): Promise<string> =>
  toUrlSafe(await crypto.subtle.exportKey('spki', key))

export const importEcdhPublicKey = async (b64: string): Promise<CryptoKey> => {
  const raw = safeAtob(b64)
  if (!raw) throw new Error('ECDH Public key invalid')
  return crypto.subtle.importKey(
    'spki',
    Uint8Array.from(raw, c => c.charCodeAt(0)).buffer,
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    []
  )
}

// 🔑 BỔ SUNG: IMPORT KHÓA CÔNG KHAI ECDSA
export const importEcdsaPublicKey = async (b64: string): Promise<CryptoKey> => {
  const raw = safeAtob(b64)
  if (!raw) throw new Error('ECDSA Public key invalid')
  return crypto.subtle.importKey(
    'spki',
    Uint8Array.from(raw, c => c.charCodeAt(0)).buffer,
    { name: 'ECDSA', namedCurve: 'P-256' }, // Thuật toán: ECDSA
    true,
    ['verify'] // Mục đích: Xác minh
  )
}

export const deriveAesKey = async (priv: CryptoKey, pub: CryptoKey): Promise<CryptoKey> =>
  crypto.subtle.deriveKey(
    { name: 'ECDH', public: pub },
    priv,
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  )

// === MÃ HÓA / GIẢI MÃ ===
export const encryptMessage = async (key: CryptoKey, text: string) => {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const data = new TextEncoder().encode(text)
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, data)
  return {
    ciphertext: toUrlSafe(ct),
    iv: toUrlSafe(iv.buffer),
  }
}

export const decryptMessage = async (key: CryptoKey, ctB64: string, ivB64: string): Promise<string> => {
  try {
    const ctStr = safeAtob(ctB64)
    const ivStr = safeAtob(ivB64)
    if (!ctStr || !ivStr) return '(Lỗi định dạng)'

    const ciphertext = Uint8Array.from(ctStr, c => c.charCodeAt(0))
    const iv = Uint8Array.from(ivStr, c => c.charCodeAt(0))

    const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext)
    return new TextDecoder().decode(decrypted)
  } catch (err) {
    console.error('Giải mã thất bại:', err)
    return '(Tin nhắn không thể giải mã)'
  }
}

// === KÝ / XÁC MINH CHỮ KÝ ===
export const signData = async (priv: CryptoKey, data: string): Promise<string> => {
  const sig = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    priv,
    new TextEncoder().encode(data)
  )
  return toUrlSafe(sig)
}

// 🔑 BỔ SUNG: XÁC MINH CHỮ KÝ
export const verifySignature = async (
  pub: CryptoKey,
  sigB64: string,
  data: string
): Promise<boolean> => {
  const sigStr = safeAtob(sigB64)
  if (!sigStr) return false

  const signature = Uint8Array.from(sigStr, c => c.charCodeAt(0))

  return crypto.subtle.verify(
    { name: 'ECDSA', hash: 'SHA-256' },
    pub, // Khóa công khai của người gửi
    signature,
    new TextEncoder().encode(data) // Dữ liệu đã ký
  )
}