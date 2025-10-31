export async function genECDH(){return crypto.subtle.generateKey({name:'ECDH',namedCurve:'P-256'},true,['deriveKey','deriveBits'])}
export async function exportPubJWK(key:CryptoKey){return crypto.subtle.exportKey('jwk',key)}
export async function importPeerPub(jwk:JsonWebKey){return crypto.subtle.importKey('jwk',jwk,{name:'ECDH',namedCurve:'P-256'},true,[])}
export async function deriveAesKey(priv:CryptoKey,peer:CryptoKey,salt:Uint8Array){const bits=await crypto.subtle.deriveBits({name:'ECDH',public:peer},priv,256); const raw=new Uint8Array(bits); const hkdf=await crypto.subtle.importKey('raw',raw,'HKDF',false,['deriveKey']); return crypto.subtle.deriveKey({name:'HKDF',hash:'SHA-256',salt,info:new Uint8Array()},hkdf,{name:'AES-GCM',length:256},false,['encrypt','decrypt'])}
export async function aesGcmEncrypt(key:CryptoKey,data:Uint8Array){const iv=crypto.getRandomValues(new Uint8Array(12)); const ct=await crypto.subtle.encrypt({name:'AES-GCM',iv},key,data); return {iv,ct:new Uint8Array(ct)}}
export async function aesGcmDecrypt(key:CryptoKey,iv:Uint8Array,ct:Uint8Array){const pt=await crypto.subtle.decrypt({name:'AES-GCM',iv},key,ct); return new Uint8Array(pt)}
export const b64={enc:(b:Uint8Array)=>btoa(String.fromCharCode(...b)),dec:(s:string)=>new Uint8Array(atob(s).split('').map(c=>c.charCodeAt(0)))}
