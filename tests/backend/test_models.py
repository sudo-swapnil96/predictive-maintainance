"""
Verifies that every ORM model imports cleanly, registers with
Base.metadata, and that its DDL actually compiles for the PostgreSQL
dialect. This does NOT require a live database connection — it only
proves the schema is syntactically valid Postgres DDL, which catches
type/constraint mistakes before you ever run Alembic against a real
database.
"""

import app.models  # noqa: F401  (registers all models)
from app.database.session import Base
from sqlalchemy.dialects import postgresql
from sqlalchemy.schema import CreateTable

EXPECTED_TABLES = {
    "users",
    "machines",
    "machine_parameters",
    "sensors",
    "sensor_calibrations",
    "sensor_readings",
    "machine_status",
    "anomalies",
    "predictions",
    "faults",
    "maintenance_records",
    "maintenance_recommendations",
    "alerts",
    "ai_models",
    "model_metrics",
    "datasets",
    "system_logs",
}


def test_all_expected_tables_are_registered():
    registered = set(Base.metadata.tables.keys())
    missing = EXPECTED_TABLES - registered
    assert not missing, f"Tables missing from metadata: {missing}"


def test_every_table_ddl_compiles_for_postgresql():
    dialect = postgresql.dialect()
    for table in Base.metadata.tables.values():
        # Raises if the DDL is invalid for Postgres — no DB connection needed.
        compiled = str(CreateTable(table).compile(dialect=dialect))
        assert "CREATE TABLE" in compiled


def test_machine_parameter_has_unique_constraint_on_machine_and_key():
    """
    Phase 2 hardening: a machine must not be able to have two parameters
    registered under the same parameter_key. Verifies the constraint is
    actually present in the compiled DDL, not just declared in Python.
    """
    table = Base.metadata.tables["machine_parameters"]
    dialect = postgresql.dialect()
    compiled = str(CreateTable(table).compile(dialect=dialect))
    assert "uq_machine_parameter_key" in compiled
    assert "UNIQUE" in compiled.upper()

