# Bàn giao WhichWay

## 1. Tạo GitHub repository

Tên đề xuất: `WhichWay`

Upload toàn bộ nội dung bên trong thư mục `WhichWay_PROJECT`. Không upload `node_modules`, `dist`, file `.tsbuildinfo` hoặc `tests/.generated-utils.mjs`.

Commit đề xuất:

`Launch WhichWay BoundDirection workspace`

## 2. Deploy Vercel

1. Import repository `WhichWay`.
2. Framework Preset: `Vite`.
3. Build command: `npm run build`.
4. Output directory: `dist`.
5. Không cần environment variable.
6. Nếu redeploy, bỏ chọn **Use existing Build Cache**.

## 3. Kiểm tra sau deploy

1. Trang mở được và hiển thị contract `0xB47f…eC5B`.
2. Nút **View contract** trỏ đúng Explorer.
3. **Connect MetaMask** yêu cầu StudioNet chain `61999`, không yêu cầu GenLayer Snap.
4. Làm bảy giao dịch trong `TESTING.md` theo đúng thứ tự.
5. Chụp đúng ba ảnh được liệt kê trong `TESTING.md`.

## 4. Khi nộp Project

Dùng nội dung trong `PROJECT_SUBMISSION_NOTE.md`. Thay hai placeholder bằng URL Vercel và URL GitHub thật. Contract link đã điền sẵn.
