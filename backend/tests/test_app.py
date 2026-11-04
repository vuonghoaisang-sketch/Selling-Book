from unittest.mock import patch
import pytest
from backend.app import create_app
from backend.db import check_db_connection


@pytest.fixture
def client():
    """Tạo Flask test client để giả lập các HTTP request."""
    app = create_app()
    app.config["TESTING"] = True
    with app.test_client() as test_client:
        yield test_client


def test_health_api_status_code(client):
    """Kiểm tra GET /api/health trả về HTTP 200."""
    response = client.get("/api/health")
    assert response.status_code == 200


def test_health_api_json_payload(client):
    """Kiểm tra GET /api/health trả về đúng định dạng JSON mong muốn."""
    response = client.get("/api/health")
    assert response.get_json() == {"status": "ok"}


def test_db_health_mock_success(client):
    """Kiểm tra GET /api/health/db trả về HTTP 200 khi kết nối database thành công (mock)."""
    with patch("backend.app.check_db_connection", return_value=(True, "Database connection successful")):
        response = client.get("/api/health/db")
        assert response.status_code == 200
        data = response.get_json()
        assert data["status"] == "ok"
        assert data["database"] == "connected"


def test_db_health_mock_failure(client):
    """Kiểm tra GET /api/health/db trả về HTTP 503 khi kết nối database thất bại (mock)."""
    with patch("backend.app.check_db_connection", return_value=(False, "Database connection failed")):
        response = client.get("/api/health/db")
        assert response.status_code == 503
        data = response.get_json()
        assert data["status"] == "error"
        assert data["message"] == "Database connection failed"
        # Đảm bảo không để lộ mật khẩu trong response
        assert "password" not in response.get_data(as_text=True).lower()


def test_db_check_connection_mock_failure():
    """Kiểm thử trực tiếp hàm check_db_connection khi xảy ra ngoại lệ kết nối."""
    with patch("backend.db.create_engine") as mock_create_engine:
        mock_create_engine.side_effect = Exception("Connection refused")
        success, message = check_db_connection()
        assert success is False
        assert message == "Database connection failed"
