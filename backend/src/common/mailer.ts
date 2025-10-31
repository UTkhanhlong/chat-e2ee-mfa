import nodemailer from 'nodemailer'

// 🧩 Khởi tạo transporter dùng Gmail SMTP
export const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: Number(process.env.SMTP_PORT || 587),
  secure: false, // true nếu dùng port 465
  auth: {
    user: process.env.SMTP_USER, // Gmail bạn dùng để gửi
    pass: process.env.SMTP_PASS, // App Password (không dùng mật khẩu thật)
  },
})

// 🧠 Hàm gửi mail
export async function sendMail(opts: { to: string; subject: string; html: string; text?: string }) {
  const from = process.env.SMTP_FROM || `Secure Chat <${process.env.SMTP_USER}>`

  try {
    const info = await transporter.sendMail({
      from,
      to: opts.to,
      subject: opts.subject,
      text: opts.text,
      html: opts.html,
    })

    console.log(`📧 Email đã gửi đến ${opts.to}: ${info.messageId}`)
    return info
  } catch (err) {
    console.error('❌ Lỗi khi gửi mail:', err)
    throw new Error('Không thể gửi email. Kiểm tra lại cấu hình SMTP hoặc App Password.')
  }
}

// 🧩 Template HTML chung cho email
export function htmlEmailTemplate(title: string, body: string) {
  return `
  <div style="font-family:'Segoe UI',Arial,sans-serif;max-width:600px;margin:auto;padding:16px;background:#fff;border-radius:8px;box-shadow:0 2px 6px rgba(0,0,0,0.1)">
    <h2 style="color:#2563eb">${title}</h2>
    <div style="font-size:15px;line-height:1.6;color:#333">${body}</div>
    <hr style="margin:24px 0;border:none;border-top:1px solid #eee"/>
    <div style="color:#888;font-size:12px;text-align:center">
      Secure Chat © ${new Date().getFullYear()}
    </div>
  </div>
  `
}
