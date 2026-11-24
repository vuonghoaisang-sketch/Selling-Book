import os

from flask import Flask, jsonify, request, session
from sqlalchemy import create_engine, select
from sqlalchemy.orm import sessionmaker
from werkzeug.security import check_password_hash

from backend.db import check_db_connection, get_database_url
from backend.models import Admin, Book


def book_to_dict(book: Book) -> dict:
    """Chuyển một đối tượng Book thành dict để trả về dạng JSON."""
    return {
        "id": book.id,
        "title": book.title,
        "author": book.author,
        "description": book.description,
        "price": book.price,
        "stock": book.stock,
    }


def admin_to_dict(admin: Admin) -> dict:
    """Chuyển thông tin cơ bản của Admin thành dict (không bao gồm mật khẩu)."""
    return {
        "id": admin.id,
        "username": admin.username,
    }


def create_app(session_factory=None) -> Flask:
    """Khởi tạo và cấu hình ứng dụng Flask (Application Factory).

    session_factory: dùng để tạo session làm việc với database.
    Nếu không truyền vào, ứng dụng tự kết nối PostgreSQL theo file .env.
    Khi chạy test, ta truyền vào một database tạm để không đụng dữ liệu thật.
    """
    app = Flask(__name__)

    secret_key = os.getenv("FLASK_SECRET_KEY")
    if secret_key:
        app.config["SECRET_KEY"] = secret_key

    app.config["SESSION_COOKIE_HTTPONLY"] = True
    app.config["SESSION_COOKIE_SAMESITE"] = "Lax"
    app.config["SESSION_COOKIE_SECURE"] = (
        os.getenv("FLASK_SESSION_COOKIE_SECURE", "false").lower() == "true"
    )

    if session_factory is None:
        engine = create_engine(get_database_url(), pool_pre_ping=True)
        session_factory = sessionmaker(bind=engine)

    @app.route("/api/health", methods=["GET"])
    def health():
        """API kiểm tra trạng thái ứng dụng Flask (không phụ thuộc database)."""
        return jsonify({"status": "ok"}), 200

    @app.route("/api/health/db", methods=["GET"])
    def health_db():
        """API kiểm tra trạng thái kết nối tới PostgreSQL database."""
        success, message = check_db_connection()
        if success:
            return jsonify({
                "status": "ok",
                "database": "connected"
            }), 200
        else:
            return jsonify({
                "status": "error",
                "message": message
            }), 503

    @app.route("/api/books", methods=["GET"])
    def list_books():
        """API lấy danh sách sách. Nếu chưa có sách, trả về danh sách rỗng."""
        with session_factory() as db_session:
            books = db_session.scalars(select(Book).order_by(Book.id)).all()
            return jsonify([book_to_dict(book) for book in books]), 200

    @app.route("/api/books/<int:book_id>", methods=["GET"])
    def get_book(book_id):
        """API lấy chi tiết một cuốn sách theo ID."""
        with session_factory() as db_session:
            book = db_session.get(Book, book_id)
            if book is None:
                return jsonify({"error": "Book not found"}), 404
            return jsonify(book_to_dict(book)), 200

    @app.route("/api/auth/login", methods=["POST"])
    def login():
        """API đăng nhập Admin bằng username và password, lưu admin_id vào Flask session."""
        data = request.get_json(silent=True)
        if not isinstance(data, dict):
            return jsonify({"error": "Username and password are required"}), 400

        username = data.get("username")
        password = data.get("password")
        if (
            not isinstance(username, str)
            or not username.strip()
            or not isinstance(password, str)
            or not password
        ):
            return jsonify({"error": "Username and password are required"}), 400

        username = username.strip()

        with session_factory() as db_session:
            admin = db_session.scalars(
                select(Admin).where(Admin.username == username)
            ).first()

            if admin is None or not check_password_hash(admin.password_hash, password):
                return jsonify({"error": "Invalid username or password"}), 401

            session.clear()
            session["admin_id"] = admin.id

            return jsonify({
                "message": "Login successful",
                "admin": admin_to_dict(admin),
            }), 200

    @app.route("/api/auth/me", methods=["GET"])
    def auth_me():
        """API kiểm tra phiên đăng nhập hiện tại và trả về thông tin Admin."""
        admin_id = session.get("admin_id")
        if admin_id is None:
            return jsonify({"error": "Unauthorized"}), 401

        with session_factory() as db_session:
            admin = db_session.get(Admin, admin_id)
            if admin is None:
                session.clear()
                return jsonify({"error": "Unauthorized"}), 401

            return jsonify(admin_to_dict(admin)), 200

    @app.route("/api/auth/logout", methods=["POST"])
    def logout():
        """API đăng xuất Admin bằng cách xóa Flask session."""
        session.clear()
        return jsonify({"message": "Logout successful"}), 200

    return app


if __name__ == "__main__":
    app = create_app()
    # Chạy Flask tại localhost:5000 (mặc định debug=False)
    app.run(host="127.0.0.1", port=5000, debug=False)
