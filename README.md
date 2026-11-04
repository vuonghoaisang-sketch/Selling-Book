# Bán Sách (Selling-Book)
Website Bán Sách - Đồ án môn Phần mềm mã nguồn mở

---

## Hướng dẫn thiết lập cơ sở dữ liệu PostgreSQL (Docker Compose)

Mỗi thành viên trong nhóm phát triển chạy một cơ sở dữ liệu PostgreSQL riêng biệt trên máy cá nhân của mình thông qua Docker Compose. Điều này giúp môi trường độc lập, tránh xung đột dữ liệu khi làm việc song song và không phụ thuộc vào kết nối mạng bên ngoài.

### 1. Công cụ cần cài đặt
- **Git**
- **Docker Desktop** (trên Windows / macOS) hoặc **Docker Engine & Docker Compose plugin** (trên Linux)

### 2. Tạo file môi trường `.env`
Sao chép file `.env.example` thành `.env`:

- **Windows (PowerShell):**
  ```powershell
  Copy-Item .env.example .env
  ```
- **Linux / macOS / Git Bash:**
  ```bash
  cp .env.example .env
  ```

### 3. Đổi mật khẩu trong `.env`
Mở file `.env` vừa tạo và cập nhật lại biến `POSTGRES_PASSWORD` bằng mật khẩu an toàn của riêng bạn trên máy cá nhân:
```env
POSTGRES_DB=ban_sach_db
POSTGRES_USER=ban_sach_user
POSTGRES_PASSWORD=mat_khau_cua_ban
POSTGRES_PORT=5433
```

### 4. Khởi động database
Chạy lệnh sau để tải image và khởi chạy PostgreSQL dưới nền:
```bash
docker compose up -d
```

### 5. Kiểm tra trạng thái container
Xem danh sách container đang chạy và trạng thái sức khỏe:
```bash
docker compose ps
```
Khi container sẵn sàng, cột `STATUS` sẽ hiển thị `healthy`.

### 6. Kiểm tra kết nối PostgreSQL
Kiểm tra khả năng phản hồi của PostgreSQL qua `pg_isready`:
```bash
docker compose exec db pg_isready -U ban_sach_user -d ban_sach_db
```
Bạn cũng có thể kết nối bằng các công cụ quản trị giao diện (DBeaver, pgAdmin, TablePlus, VS Code extension) với thông tin:
- **Host:** `127.0.0.1`
- **Port:** `5433` (hoặc cổng cấu hình trong `.env`)
- **Database:** `ban_sach_db`
- **User:** `ban_sach_user`
- **Password:** mật khẩu bạn đã đặt trong `.env`

### 7. Cách dừng và chạy lại database
- **Tạm dừng database:**
  ```bash
  docker compose stop
  ```
- **Chạy lại database đã dừng:**
  ```bash
  docker compose start
  ```
- **Dừng và hạ container:**
  ```bash
  docker compose down
  ```

### 8. Lưu ý an toàn quan trọng
- **Tuyệt đối không commit file `.env` lên Git:** File `.env` chứa mật khẩu riêng của bạn và đã được cấu hình trong `.gitignore` để không bị đẩy lên repository.
- **Không dùng cờ `-v` khi tắt container:** Tuyệt đối tránh chạy `docker compose down -v` vì cờ `-v` sẽ xóa sạch Docker named volume `postgres_data`, làm mất toàn bộ dữ liệu database đã tạo.
