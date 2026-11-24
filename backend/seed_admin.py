import os

from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session, sessionmaker
from werkzeug.security import generate_password_hash

from backend.db import get_database_url
from backend.models import Admin


def seed_admin(db_session: Session, username: str, password: str) -> dict[str, int]:
    """Tạo tài khoản Admin mẫu nếu username chưa tồn tại.

    - Hash mật khẩu trước khi lưu bằng Werkzeug.
    - Nếu username đã tồn tại thì bỏ qua, tuyệt đối không ghi đè mật khẩu cũ.
    - Trả về dict thống kê: {"added": ..., "skipped": ...}.
    """
    clean_username = username.strip()
    if not clean_username or not password:
        raise ValueError("Username and password must not be empty")

    try:
        existing_admin = db_session.scalars(
            select(Admin).where(Admin.username == clean_username)
        ).first()

        if existing_admin is not None:
            return {"added": 0, "skipped": 1}

        admin = Admin(
            username=clean_username,
            password_hash=generate_password_hash(password),
        )
        db_session.add(admin)
        db_session.commit()
        return {"added": 1, "skipped": 0}
    except Exception:
        db_session.rollback()
        raise


def main() -> int:
    """Điểm chạy chính của script tạo Admin mẫu, yêu cầu SEED_ADMIN=1."""
    if os.getenv("SEED_ADMIN") != "1":
        print("Từ chối chạy seed admin: vui lòng đặt biến môi trường SEED_ADMIN=1 để xác nhận.")
        return 1

    username = os.getenv("ADMIN_USERNAME", "").strip()
    password = os.getenv("ADMIN_PASSWORD", "")
    if not username or not password:
        print("Thiếu biến môi trường ADMIN_USERNAME hoặc ADMIN_PASSWORD.")
        return 1

    engine = create_engine(get_database_url(), pool_pre_ping=True)
    session_factory = sessionmaker(bind=engine)

    try:
        with session_factory() as db_session:
            result = seed_admin(db_session, username=username, password=password)
        if result["added"] == 1:
            print("Hoàn tất: đã tạo tài khoản Admin mẫu mới.")
        else:
            print("Bỏ qua: tài khoản Admin đã tồn tại, giữ nguyên dữ liệu cũ.")
        return 0
    except Exception as exc:
        print(f"Lỗi khi tạo tài khoản Admin mẫu: {type(exc).__name__}")
        return 1
    finally:
        engine.dispose()


if __name__ == "__main__":
    raise SystemExit(main())
