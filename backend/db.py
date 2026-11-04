import os
from pathlib import Path
from dotenv import load_dotenv
from sqlalchemy import create_engine, text
from sqlalchemy.engine import URL

# Tìm đường dẫn file .env ở thư mục gốc của dự án
env_path = Path(__file__).resolve().parent.parent / ".env"
load_dotenv(dotenv_path=env_path)


def get_database_url() -> URL:
    """Tạo đối tượng URL kết nối PostgreSQL an toàn từ biến môi trường."""
    db_name = os.getenv("POSTGRES_DB", "ban_sach_db")
    user = os.getenv("POSTGRES_USER", "ban_sach_user")
    password = os.getenv("POSTGRES_PASSWORD", "")
    host = os.getenv("POSTGRES_HOST", "127.0.0.1")
    raw_port = os.getenv("POSTGRES_PORT", "")
    port = int(raw_port) if raw_port and raw_port.strip().isdigit() else 5432

    return URL.create(
        drivername="postgresql+psycopg",
        username=user,
        password=password,
        host=host,
        port=port,
        database=db_name,
    )


def check_db_connection(engine=None) -> tuple[bool, str]:
    """
    Kiểm tra kết nối đến PostgreSQL bằng truy vấn 'SELECT 1'.
    Trả về (True, 'ok') nếu thành công, hoặc (False, 'thông báo lỗi chung') nếu thất bại.
    Không để lộ mật khẩu hoặc chuỗi kết nối.
    """
    created_engine = None
    try:
        if engine is None:
            url = get_database_url()
            created_engine = create_engine(url, pool_pre_ping=True)
            target_engine = created_engine
        else:
            target_engine = engine

        with target_engine.connect() as connection:
            connection.execute(text("SELECT 1"))
        return True, "Database connection successful"
    except Exception:
        return False, "Database connection failed"
    finally:
        if created_engine is not None:
            created_engine.dispose()
