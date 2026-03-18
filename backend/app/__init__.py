import os
from flask import Flask
from .config import config
from .extensions import db, migrate, login_manager


def create_app():
    app = Flask(__name__, static_folder="static", static_url_path="/")

    env = os.getenv("FLASK_ENV", "development")
    app.config.from_object(config[env])

    db.init_app(app)
    migrate.init_app(app, db)
    login_manager.init_app(app)

    # Import all models so Alembic autogenerate can detect them
    from .models import User, Agent, Entry, Project, project_agents  # noqa: F401

    from .routes import api_bp
    from .routes.main import main_bp

    app.register_blueprint(api_bp)
    app.register_blueprint(main_bp)

    return app
