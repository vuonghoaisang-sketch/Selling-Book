import os

from flask import Flask, jsonify, request, session
from sqlalchemy import create_engine, select
from sqlalchemy.exc import IntegrityError
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


MAX_INT = 2147483647  # Giá trị lớn nhất của cột Integer trong PostgreSQL


def validate_book_data(data, partial=False):
    """Kiểm tra dữ liệu sách gửi lên từ Admin.

    partial=False (thêm sách): bắt buộc có title, author, price, stock.
    partial=True (cập nhật): chỉ kiểm tra những trường được gửi lên.

    Trả về (dữ liệu_đã_làm_sạch, None) nếu hợp lệ,
    hoặc (None, "thông báo lỗi") nếu không hợp lệ.
    """
    if not isinstance(data, dict):
        return None, "Request body must be a JSON object"

    if not partial:
        for field in ("title", "author", "price", "stock"):
            if field not in data:
                return None, f"{field} is required"

    clean = {}

    for field, max_length in (("title", 255), ("author", 150)):
        if field in data:
            value = data[field]
            if not isinstance(value, str) or not value.strip():
                return None, f"{field} must be a non-empty string"
            value = value.strip()
            if len(value) > max_length:
                return None, f"{field} must be at most {max_length} characters"
            clean[field] = value

    if "description" in data:
        value = data["description"]
        if value is not None and not isinstance(value, str):
            return None, "description must be a string or null"
        clean["description"] = value

    for field in ("price", "stock"):
        if field in data:
            value = data[field]
            # bool cũng là int trong Python nên phải loại riêng
            if isinstance(value, bool) or not isinstance(value, int):
                return None, f"{field} must be an integer"
            if value < 0:
                return None, f"{field} must not be negative"
            if value > MAX_INT:
                return None, f"{field} is too large"
            clean[field] = value

    if partial and not clean:
        return None, "No valid fields to update"

    return clean, None


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

    def check_admin(db_session):
        """Kiểm tra phiên đăng nhập Admin (dùng chung cho các API quản lý sách).

        Trả về None nếu Admin hợp lệ.
        Trả về response lỗi 401 nếu chưa đăng nhập hoặc Admin không còn tồn tại.
        """
        admin_id = session.get("admin_id")
        if admin_id is None or db_session.get(Admin, admin_id) is None:
            session.clear()
            return jsonify({"error": "Unauthorized"}), 401
        return None

    @app.route("/api/admin/books", methods=["GET"])
    def admin_list_books():
        """API Admin: lấy danh sách toàn bộ sách trong database."""
        with session_factory() as db_session:
            error = check_admin(db_session)
            if error is not None:
                return error

            books = db_session.scalars(select(Book).order_by(Book.id)).all()
            return jsonify([book_to_dict(book) for book in books]), 200

    @app.route("/api/admin/books", methods=["POST"])
    def admin_create_book():
        """API Admin: thêm một cuốn sách mới. Thành công trả về 201."""
        with session_factory() as db_session:
            error = check_admin(db_session)
            if error is not None:
                return error

            data = request.get_json(silent=True)
            clean, message = validate_book_data(data)
            if message is not None:
                return jsonify({"error": message}), 400

            book = Book(**clean)
            db_session.add(book)
            db_session.commit()
            db_session.refresh(book)
            return jsonify(book_to_dict(book)), 201

    @app.route("/api/admin/books/<int:book_id>", methods=["PATCH"])
    def admin_update_book(book_id):
        """API Admin: cập nhật một số trường của sách. Thành công trả về 200."""
        with session_factory() as db_session:
            error = check_admin(db_session)
            if error is not None:
                return error

            book = db_session.get(Book, book_id)
            if book is None:
                return jsonify({"error": "Book not found"}), 404

            data = request.get_json(silent=True)
            clean, message = validate_book_data(data, partial=True)
            if message is not None:
                return jsonify({"error": message}), 400

            for field, value in clean.items():
                setattr(book, field, value)
            db_session.commit()
            db_session.refresh(book)
            return jsonify(book_to_dict(book)), 200

    @app.route("/api/admin/books/<int:book_id>", methods=["DELETE"])
    def admin_delete_book(book_id):
        """API Admin: xóa một cuốn sách. Thành công trả về 200."""
        with session_factory() as db_session:
            error = check_admin(db_session)
            if error is not None:
                return error

            book = db_session.get(Book, book_id)
            if book is None:
                return jsonify({"error": "Book not found"}), 404

            try:
                db_session.delete(book)
                db_session.commit()
            except IntegrityError:
                # Sách đã nằm trong đơn hàng nên database không cho xóa
                db_session.rollback()
                return jsonify({"error": "Book is used in orders and cannot be deleted"}), 409

            return jsonify({"message": "Book deleted"}), 200

    return app


if __name__ == "__main__":
    app = create_app()
    # Chạy Flask tại localhost:5000 (mặc định debug=False)
    app.run(host="127.0.0.1", port=5000, debug=False)
