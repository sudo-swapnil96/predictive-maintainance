"""
Tests for the Phase 2 machine-configuration schemas. Pure validation
logic — no database connection required.
"""

import pytest
from pydantic import ValidationError

from app.models.enums import DataSource, ParameterSourceType
from app.schemas.machine import MachineParameterCreate


def test_machine_parameter_defaults_are_tbd_not_invented():
    """A parameter created with no source info must default to TBD/
    SIMULATED, never to a real-sounding value that wasn't provided."""
    param = MachineParameterCreate(parameter_key="vibration", display_name="Vibration")
    assert param.source_type == ParameterSourceType.TBD
    assert param.expected_data_source == DataSource.SIMULATED
    assert param.normal_min is None
    assert param.normal_max is None


def test_machine_parameter_rejects_inverted_normal_range():
    with pytest.raises(ValidationError):
        MachineParameterCreate(
            parameter_key="temperature",
            display_name="Temperature",
            normal_min=80,
            normal_max=20,
        )


def test_machine_parameter_accepts_valid_range():
    param = MachineParameterCreate(
        parameter_key="temperature",
        display_name="Temperature",
        unit="C",
        normal_min=20,
        normal_max=80,
    )
    assert param.normal_min == 20
    assert param.normal_max == 80


def test_sampling_interval_must_be_positive():
    with pytest.raises(ValidationError):
        MachineParameterCreate(
            parameter_key="pressure",
            display_name="Pressure",
            sampling_interval_seconds=0,
        )
