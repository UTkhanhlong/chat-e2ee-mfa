/**
 * 🧩 Interface cho payload khi đăng ký tài khoản
 */
export interface RegisterPayload {
  username: string             // ✅ Bắt buộc (hiện tại form cần có)
  email: string                // ✅ Bắt buộc
  rawPassword: string          // ✅ Mật khẩu người dùng
  publicKey?: string           // 👈 Optional - dùng cho mã hóa E2EE
  dob?: string                 // 👈 Ngày sinh (YYYY-MM-DD)
  gender?: string              // 👈 "Nam" | "Nữ" | "Khác"
}

/**
 * 🧩 Interface cho payload khi đăng nhập
 * (Có thể dùng email hoặc username để đăng nhập)
 */
export interface LoginPayload {
  identifier: string           // ✅ Có thể là email hoặc username
  rawPassword: string
}
