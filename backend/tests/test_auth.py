import pytest
from sqlalchemy import create_engine, select
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from werkzeug.security import check_password_hash, generate_password_hash

from backend.app import create_app
from backend.models import Admin, Base
from backend.seed_admin import main as seed_admin_main
from backend.seed_admin import seed_admin


@pytest.fixture
def session_factory():
    """Tạo database SQLite tạm trong bộ nhớ, không đụng đến PostgreSQL thật."""
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    yield sessionmaker(bind=engine)
    engine.dispose()


@pytest.fixture
def client(session_factory, monkeypatch):
    """Tạo Flask test client với SECRET_KEY giả lập cho session."""
    monkeypatch.setenv("FLASK_SECRET_KEY", "test-secret-key-not-for-prod")
    app = create_app(session_factory=session_factory)
    app.config["TESTING"] = True
    with app.test_client() as test_client:
        yield test_client


@pytest.fixture
def sample_admin(session_factory):
    """Tạo sẵn một tài khoản Admin mẫu trong database tạm."""
    with session_factory() as db_session:
        admin = Admin(
            username="admin_test",
            password_hash=generate_password_hash("secret123"),
        )
        db_session.add(admin)
        db_session.commit()
        db_session.refresh(admin)
        return {"id": admin.id, "username": admin.username}


def test_login_success(client, sample_admin):
    """Đăng nhập đúng username và password trả về 200, lưu admin_id và không lộ mật khẩu."""
    with client.session_transaction() as sess:
        sess["old_key"] = "old_value"

    response = client.post(
        "/api/auth/login",
        json={"username": "admin_test", "password": "secret123"},
    )

    assert response.status_code == 200
    data = response.get_json()
    assert data["message"] == "Login successful"
    assert data["admin"] == {"id": sample_admin["id"], "username": "admin_test"}

    raw_text = response.get_data(as_text=True).lower()
    assert "password_hash" not in raw_text
    assert "secret123" not in raw_text

    with client.session_transaction() as sess:
        assert "old_key" not in sess
        assert dict(sess) == {"admin_id": sample_admin["id"]}

    set_cookie = response.headers.get("Set-Cookie", "")
    assert "HttpOnly" in set_cookie
    assert "SameSite=Lax" in set_cookie


def test_login_wrong_username(client, sample_admin):
    """Đăng nhập sai username trả về 401 với thông báo lỗi chung."""
    response = client.post(
        "/api/auth/login",
        json={"username": "wrong_user", "password": "secret123"},
    )

    assert response.status_code == 401
    assert response.get_json() == {"error": "Invalid username or password"}


def test_login_wrong_password(client, sample_admin):
    """Đăng nhập sai password trả về 401 với thông báo lỗi chung."""
    response = client.post(
        "/api/auth/login",
        json={"username": "admin_test", "password": "wrong_password"},
    )

    assert response.status_code == 401
    assert response.get_json() == {"error": "Invalid username or password"}


@pytest.mark.parametrize(
    "payload",
    [
        {},
        {"username": "admin_test"},
        {"password": "secret123"},
        {"username": "   ", "password": "secret123"},
        {"username": "admin_test", "password": ""},
    ],
)
def test_login_missing_credentials(client, payload):
    """Thiếu username hoặc password trả về 400."""
    response = client.post("/api/auth/login", json=payload)

    assert response.status_code == 400
    assert response.get_json() == {"error": "Username and password are required"}


def test_auth_me_unauthenticated(client):
    """GET /api/auth/me khi chưa đăng nhập trả về 401."""
    response = client.get("/api/auth/me")

    assert response.status_code == 401
    assert response.get_json() == {"error": "Unauthorized"}


def test_auth_me_authenticated(client, sample_admin):
    """GET /api/auth/me sau khi đăng nhập trả về thông tin cơ bản và không lộ mật khẩu."""
    login_response = client.post(
        "/api/auth/login",
        json={"username": "admin_test", "password": "secret123"},
    )
    assert login_response.status_code == 200

    me_response = client.get("/api/auth/me")
    assert me_response.status_code == 200
    assert me_response.get_json() == {
        "id": sample_admin["id"],
        "username": "admin_test",
    }

    raw_text = me_response.get_data(as_text=True).lower()
    assert "password" not in raw_text


def test_logout_and_session_invalidated(client, sample_admin):
    """Đăng xuất xóa session và không thể truy cập /api/auth/me bằng session cũ."""
    client.post(
        "/api/auth/login",
        json={"username": "admin_test", "password": "secret123"},
    )

    logout_response = client.post("/api/auth/logout")
    assert logout_response.status_code == 200
    assert logout_response.get_json() == {"message": "Logout successful"}

    me_response = client.get("/api/auth/me")
    assert me_response.status_code == 401
    assert me_response.get_json() == {"error": "Unauthorized"}


def test_seed_admin_refuses_without_confirmation(monkeypatch, capsys):
    """Script seed_admin từ chối chạy nếu thiếu SEED_ADMIN=1."""
    monkeypatch.delenv("SEED_ADMIN", raising=False)
    exit_code = seed_admin_main()
    captured = capsys.readouterr()

    assert exit_code == 1
    assert "SEED_ADMIN=1" in captured.out


def test_seed_admin_creates_hashed_admin_and_skips_existing(session_factory):
    """seed_admin băm mật khẩu khi tạo mới và bỏ qua nếu username đã tồn tại."""
    with session_factory() as db_session:
        first_result = seed_admin(db_session, "root_admin", "initial_pass")
        created = db_session.scalars(
            select(Admin).where(Admin.username == "root_admin")
        ).first()

        assert first_result == {"added": 1, "skipped": 0}
        assert created is not None
        assert created.password_hash != "initial_pass"
        assert check_password_hash(created.password_hash, "initial_pass")

        original_hash = created.password_hash
        second_result = seed_admin(db_session, "root_admin", "new_pass_ignored")
        refetched = db_session.scalars(
            select(Admin).where(Admin.username == "root_admin")
        ).first()

        assert second_result == {"added": 0, "skipped": 1}
        assert refetched is not None
        assert refetched.password_hash == original_hash
