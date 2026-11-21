from flask import Flask, jsonify
from sqlalchemy import create_engine, select
from sqlalchemy.orm import sessionmaker

from backend.db import check_db_connection, get_database_url
from backend.models import Book


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


def create_app(session_factory=None) -> Flask:
    """Khởi tạo và cấu hình ứng dụng Flask (Application Factory).

    session_factory: dùng để tạo session làm việc với database.
    Nếu không truyền vào, ứng dụng tự kết nối PostgreSQL theo file .env.
    Khi chạy test, ta truyền vào một database tạm để không đụng dữ liệu thật.
    """
    app = Flask(__name__)

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
        with session_factory() as session:
            books = session.scalars(select(Book).order_by(Book.id)).all()
            return jsonify([book_to_dict(book) for book in books]), 200

    @app.route("/api/books/<int:book_id>", methods=["GET"])
    def get_book(book_id):
        """API lấy chi tiết một cuốn sách theo ID."""
        with session_factory() as session:
            book = session.get(Book, book_id)
            if book is None:
                return jsonify({"error": "Book not found"}), 404
            return jsonify(book_to_dict(book)), 200

    return app
if __name__ == "__main__":
    app = create_app()
    # Chạy Flask tại localhost:5000 (mặc định debug=False)
    app.run(host="127.0.0.1", port=5000, debug=False)

