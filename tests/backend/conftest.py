import os

# Test-safe env vars so Settings() doesn't fail validation on import
# during collection, even before a real .env exists. These are dummy
# values only — never used against a real database.
os.environ.setdefault("DATABASE_URL", "postgresql+psycopg://test:test@localhost:5432/test")
os.environ.setdefault("JWT_SECRET_KEY", "test-secret-key-for-pytest-only-not-for-production-use")
