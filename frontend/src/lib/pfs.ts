// lib/pfs.ts
import {
  generateEcdhKeyPair,     // ← DÀNH CHO PFS
  generateEcdsaKeyPair,    // ← DÀNH CHO CHỮ KÝ
  exportPublicKey,
  deriveAesKey,
  encryptMessage,
  importEcdhPublicKey,     // ← DÀNH CHO PFS
  importEcdsaPublicKey,    // ← DÀNH CHO XÁC MINH
  signData,
} from './e2ee'

export interface PFSMessage {
  ciphertext: string
  iv: string
  ephemeralPubKey: string
  signature: string
}

/**
 * Mã hóa PFS + Ký chữ số
 * - Dùng ECDH cho PFS (mỗi tin nhắn)
 * - Dùng ECDSA private key (long-term) để ký
 */
export async function encryptWithPFS(
  plaintext: string,
  peerEcdhPublicKeyB64: string,     // ← Public key ECDH của người nhận
  myEcdsaPrivateKeyJwk: JsonWebKey  // ← Private key ECDSA của người gửi (để ký)
): Promise<PFSMessage> {
  try {
    // 1. Tạo ephemeral key pair (ECDH) cho PFS
    const { publicKey: ephemeralPub, privateKey: ephemeralPriv } = await generateEcdhKeyPair()

    // 2. Nhập public key ECDH của người nhận
    const peerPub = await importEcdhPublicKey(peerEcdhPublicKeyB64)

    // 3. Derive AES key (PFS)
    const aesKey = await deriveAesKey(ephemeralPriv, peerPub)

    // 4. Mã hóa tin nhắn
    const { ciphertext, iv } = await encryptMessage(aesKey, plaintext)

    // 5. Ký ciphertext + iv bằng ECDSA private key (long-term)
    const ecdsaPrivKey = await crypto.subtle.importKey(
      'jwk',
      myEcdsaPrivateKeyJwk,
      { name: 'ECDSA', namedCurve: 'P-256' },
      true,
      ['sign']
    )

    const dataToSign = `${ciphertext}:${iv}`
    const signature = await signData(ecdsaPrivKey, dataToSign)

    // 6. Xuất ephemeral public key (ECDH)
    const ephemeralPubKey = await exportPublicKey(ephemeralPub)

    return { ciphertext, iv, ephemeralPubKey, signature }
  } catch (err) {
    console.error('PFS encrypt error:', err)
    throw err
  }
}