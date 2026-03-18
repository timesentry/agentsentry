import os
from flask import Blueprint, send_from_directory, current_app

main_bp = Blueprint("main", __name__)


@main_bp.route("/", defaults={"path": ""})
@main_bp.route("/<path:path>")
def serve(path):
    static_folder = os.path.join(current_app.root_path, "static")

    if path and os.path.exists(os.path.join(static_folder, path)):
        return send_from_directory(static_folder, path)

    index_path = os.path.join(static_folder, "index.html")
    if os.path.exists(index_path):
        return send_from_directory(static_folder, "index.html")

    return "Frontend not built. Run the Vite dev server or build the frontend.", 404
