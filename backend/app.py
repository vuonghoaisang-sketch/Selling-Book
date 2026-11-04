from flask import Flask, jsonify
from backend.db import check_db_connection


def create_app() -> Flask:
    """Khởi tạo và cấu hình ứng dụng Flask (Application Factory)."""
    app = Flask(__name__)

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

    return app


if __name__ == "__main__":
    app = create_app()
    # Chạy Flask tại localhost:5000 (mặc định debug=False)
    app.run(host="127.0.0.1", port=5000, debug=False)
