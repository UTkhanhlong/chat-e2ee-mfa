// frontend/src/pages/HomePage.tsx

import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import Stack from "@mui/material/Stack";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import CheckCircleRoundedIcon from "@mui/icons-material/CheckCircleRounded";
import LockOutlined from "@mui/icons-material/LockOutlined";
import VerifiedUserOutlined from "@mui/icons-material/VerifiedUserOutlined";
import SpeedOutlined from "@mui/icons-material/SpeedOutlined";
import ChatBubbleOutlineRoundedIcon from "@mui/icons-material/ChatBubbleOutlineRounded";
import SecurityOutlinedIcon from "@mui/icons-material/SecurityOutlined";

function ChatMockupImage() {
  return (
    <Box
      sx={{
        width: "100%",
        height: { xs: 200, md: 400 },
        borderRadius: 3,
        bgcolor: "grey.100",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "column",
        boxShadow: 6,
        color: "grey.600",
        p: 3,
      }}
    >
      <SecurityOutlinedIcon sx={{ fontSize: 64, mb: 1 }} />
      <Typography variant="subtitle1" fontWeight={500}>
        [Thay thế bằng hình ảnh giao diện Chat]
      </Typography>
    </Box>
  );
}

export default function HomePage() {
  return (
    <Box
      sx={{
        py: { xs: 4, md: 8 },
        px: { xs: 2, md: 4 },
        backgroundColor: "background.default",
      }}
    >
      <Stack
        spacing={8}
        direction={{ xs: "column", md: "row" }}
        alignItems="center"
      >
        {/* === Cột trái: Giới thiệu === */}
        <Box flex={1.2} minWidth={0} maxWidth={{ md: 600 }}>
          <Stack spacing={3}>
            {/* Header nhỏ */}
            <Stack direction="row" spacing={1.5} alignItems="center">
              <ChatBubbleOutlineRoundedIcon color="primary" fontSize="large" />
              <Chip
                label="E2EE | MFA | WebCrypto"
                color="primary"
                size="small"
                sx={{ fontWeight: 600 }}
              />
            </Stack>

            {/* Tiêu đề chính */}
            <Typography
              variant="h2"
              sx={{
                fontWeight: 800,
                lineHeight: 1.15,
                fontSize: { xs: 36, md: 48 },
              }}
            >
              <Box component="span" color="primary.main">
                Chat An Toàn
              </Box>{" "}
              Tuyệt Đối Cho Mọi Trình Duyệt
            </Typography>

            {/* Mô tả */}
            <Typography
              color="text.secondary"
              sx={{ fontSize: { xs: 16, md: 18 } }}
            >
              Mã hoá đầu cuối (ECDH → HKDF → AES-GCM) ngay trên client. Máy chủ
              chỉ chuyển tiếp gói tin — không thể đọc dữ liệu. Xác thực đa yếu
              tố (TOTP / Backup Codes) bảo vệ tài khoản tối đa.
            </Typography>

            {/* Nút hành động */}
            <Stack direction={{ xs: "column", sm: "row" }} spacing={2} pt={1}>
              <Button
                size="large"
                variant="contained"
                disableElevation
                sx={{ py: 1.5, px: 4, fontWeight: 700 }}
                onClick={() => window.location.assign("/login")}
              >
                Dùng thử ngay
              </Button>
              <Button
                size="large"
                variant="outlined"
                sx={{ py: 1.5, px: 4, fontWeight: 700 }}
                onClick={() => window.location.assign("/chat")}
              >
                Vào phòng chat
              </Button>
            </Stack>
          </Stack>
        </Box>

        {/* === Cột phải: Hình ảnh mô phỏng === */}
        <Box flex={1} minWidth={0} sx={{ width: "100%" }}>
          <ChatMockupImage />
        </Box>
      </Stack>

      {/* === Section Tính năng === */}
      <Box sx={{ mt: { xs: 6, md: 10 } }}>
        <Paper
          elevation={0}
          sx={{
            p: 4,
            bgcolor: "background.paper",
            border: "1px solid",
            borderColor: "divider",
            borderRadius: 3,
          }}
        >
          <Typography
            variant="h5"
            align="center"
            sx={{ fontWeight: 700, mb: 4 }}
          >
            Các Tính Năng Bảo Mật Cốt Lõi
          </Typography>

          <Stack
            spacing={{ xs: 2, md: 4 }}
            direction={{ xs: "column", md: "row" }}
            justifyContent="space-between"
          >
            <FeatureCard
              icon={<LockOutlined />}
              title="E2EE Toàn Trình"
              description="Khoá mã hoá nằm hoàn toàn trên thiết bị của bạn. Máy chủ không thể đọc nội dung tin nhắn."
              chipLabel="Bảo mật mặc định"
            />
            <FeatureCard
              icon={<VerifiedUserOutlined />}
              title="MFA Đa Lớp"
              description="Hỗ trợ TOTP (Google Authenticator, v.v.) và mã dự phòng, cung cấp lớp bảo vệ thứ hai cho tài khoản."
              chipLabel="Chống truy cập trái phép"
            />
            <FeatureCard
              icon={<SpeedOutlined />}
              title="WebCrypto Tối Ưu"
              description="Sử dụng API WebCrypto tốc độ cao (AES-GCM) để mã hoá mà không gây trễ giao diện."
              chipLabel="Hiệu năng vượt trội"
            />
          </Stack>
        </Paper>
      </Box>
    </Box>
  );
}

function FeatureCard({
  icon,
  title,
  description,
  chipLabel,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  chipLabel: string;
}) {
  return (
    <Paper
      elevation={0}
      sx={{
        p: 3,
        flex: 1,
        borderLeft: "3px solid",
        borderColor: "primary.main",
        borderRadius: 1,
      }}
    >
      <Stack spacing={1.5}>
        <Box color="primary.main" sx={{ fontSize: 32 }}>
          {icon}
        </Box>
        <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
          {title}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {description}
        </Typography>
        <Chip
          label={chipLabel}
          size="small"
          variant="outlined"
          color="primary"
          sx={{ width: "fit-content", mt: 1 }}
        />
      </Stack>
    </Paper>
  );
}
