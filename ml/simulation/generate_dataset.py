"""
Synthetic predictive-maintenance time-series dataset generator.

IMPORTANT:
    This module generates SIMULATED data only.
    The values are not measurements from the real industrial machine.

The simulator creates repeated operating cycles:
    NORMAL -> DEGRADING -> FAULT -> NORMAL

This allows chronological train/test evaluation while ensuring that
all operating states can appear in both portions of the dataset.

Usage:
    python -m ml.simulation.generate_dataset
"""

from __future__ import annotations

import argparse
from pathlib import Path

import numpy as np
import pandas as pd


PARAMETERS = [
    "vibration",
    "motor_temperature",
    "motor_current",
    "motor_voltage",
    "rpm",
    "pressure",
    "ambient_temperature",
    "humidity",
]


def generate_dataset(
    rows: int = 10000,
    seed: int = 42,
    machine_id: str = "SIM-MACHINE-001",
) -> pd.DataFrame:
    """Generate a correlated synthetic predictive-maintenance dataset."""

    if rows < 1000:
        raise ValueError("rows must be at least 1000")

    rng = np.random.default_rng(seed)

    timestamps = pd.date_range(
        start="2026-01-01T00:00:00Z",
        periods=rows,
        freq="1min",
    )

    # ------------------------------------------------------------------
    # Repeated degradation cycles
    # ------------------------------------------------------------------
    #
    # Each cycle has four phases:
    #
    # NORMAL      -> healthy operation
    # DEGRADING   -> gradual deterioration
    # FAULT       -> severe deterioration
    # RECOVERY    -> maintenance/recovery back toward normal
    #
    # We use a continuous degradation signal rather than assigning
    # arbitrary sensor values directly.
    # ------------------------------------------------------------------

    cycle_position = np.linspace(0.0, 1.0, rows)

    # Approximately five degradation cycles over the dataset.
    cycle_count = 5
    phase = (cycle_position * cycle_count) % 1.0

    degradation = np.zeros(rows)

    normal_mask = phase < 0.45
    degrading_mask = (phase >= 0.45) & (phase < 0.72)
    fault_mask = (phase >= 0.72) & (phase < 0.87)
    recovery_mask = phase >= 0.87

    degradation[normal_mask] = (
        0.05
        + 0.05 * (phase[normal_mask] / 0.45)
    )

    degradation[degrading_mask] = (
        0.10
        + 0.65
        * ((phase[degrading_mask] - 0.45) / 0.27)
    )

    degradation[fault_mask] = (
        0.75
        + 0.20
        * ((phase[fault_mask] - 0.72) / 0.15)
    )

    # During recovery, degradation gradually falls.
    degradation[recovery_mask] = (
        0.95
        * (1.0 - ((phase[recovery_mask] - 0.87) / 0.13))
    )

    degradation = np.clip(degradation, 0.0, 1.0)

    # ------------------------------------------------------------------
    # Operating/load variation
    # ------------------------------------------------------------------

    load_cycle = (
        0.55
        + 0.20 * np.sin(np.linspace(0, 30 * np.pi, rows))
        + rng.normal(0, 0.04, rows)
    )

    load_cycle = np.clip(load_cycle, 0.15, 1.0)

    # ------------------------------------------------------------------
    # Environmental conditions
    # ------------------------------------------------------------------

    ambient_temperature = (
        27.0
        + 3.0 * np.sin(np.linspace(0, 10 * np.pi, rows))
        + rng.normal(0, 0.4, rows)
    )

    humidity = (
        58.0
        + 8.0 * np.sin(np.linspace(0, 7 * np.pi, rows) + 1.0)
        + rng.normal(0, 1.2, rows)
    )

    humidity = np.clip(humidity, 25.0, 90.0)

    # ------------------------------------------------------------------
    # Simulated machine parameters
    # ------------------------------------------------------------------

    # Voltage remains relatively stable.
    motor_voltage = (
        230.0
        + 1.5 * np.sin(np.linspace(0, 40 * np.pi, rows))
        + rng.normal(0, 1.0, rows)
    )

    # Current increases with load and degradation.
    motor_current = (
        2.2
        + 2.6 * load_cycle
        + 1.0 * degradation
        + rng.normal(0, 0.10, rows)
    )

    motor_current = np.clip(motor_current, 0.1, None)

    # RPM decreases as degradation increases.
    rpm = (
        1500.0
        - 35.0 * load_cycle
        - 120.0 * degradation
        + rng.normal(0, 8.0, rows)
    )

    rpm = np.clip(rpm, 1000.0, None)

    # Temperature increases with load and degradation.
    motor_temperature = (
        ambient_temperature
        + 18.0
        + 7.0 * load_cycle
        + 22.0 * degradation
        + rng.normal(0, 0.8, rows)
    )

    motor_temperature = np.maximum(
        motor_temperature,
        ambient_temperature + 5.0,
    )

    # Pressure decreases during degradation.
    pressure = (
        5.0
        + 0.8 * load_cycle
        - 0.8 * degradation
        + rng.normal(0, 0.08, rows)
    )

    pressure = np.clip(pressure, 0.5, None)

    # Vibration is one of the strongest degradation indicators.
    vibration = (
        0.18
        + 0.12 * load_cycle
        + 0.65 * degradation
        + rng.normal(0, 0.025, rows)
    )

    vibration = np.clip(vibration, 0.02, None)

    # ------------------------------------------------------------------
    # Operating-state labels
    # ------------------------------------------------------------------

    operating_state = np.select(
        [
            degradation < 0.35,
            degradation < 0.75,
        ],
        [
            "NORMAL",
            "DEGRADING",
        ],
        default="FAULT",
    )

    fault_label = np.where(
        degradation >= 0.75,
        "SIMULATED_DEGRADATION_FAULT",
        "NONE",
    )

    dataframe = pd.DataFrame(
        {
            "timestamp": timestamps,
            "machine_id": machine_id,
            "vibration": vibration,
            "motor_temperature": motor_temperature,
            "motor_current": motor_current,
            "motor_voltage": motor_voltage,
            "rpm": rpm,
            "pressure": pressure,
            "ambient_temperature": ambient_temperature,
            "humidity": humidity,
            "operating_state": operating_state,
            "fault_label": fault_label,
            "data_source": "SIMULATED",
        }
    )

    return dataframe


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Generate a synthetic predictive-maintenance dataset."
    )

    parser.add_argument(
        "--rows",
        type=int,
        default=10000,
        help="Number of time-series rows to generate.",
    )

    parser.add_argument(
        "--seed",
        type=int,
        default=42,
        help="Random seed for reproducible simulation.",
    )

    parser.add_argument(
        "--machine-id",
        default="SIM-MACHINE-001",
        help="Identifier assigned to the simulated machine.",
    )

    parser.add_argument(
        "--output",
        default="ml/datasets/simulated_machine_data.csv",
        help="Output CSV path.",
    )

    args = parser.parse_args()

    dataframe = generate_dataset(
        rows=args.rows,
        seed=args.seed,
        machine_id=args.machine_id,
    )

    output_path = Path(args.output)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    dataframe.to_csv(output_path, index=False)

    print("Synthetic dataset generated successfully.")
    print(f"Rows: {len(dataframe)}")
    print(f"Columns: {len(dataframe.columns)}")
    print(f"Output: {output_path}")
    print()

    print("Operating-state distribution:")
    print(dataframe["operating_state"].value_counts())
    print()

    print("Fault-label distribution:")
    print(dataframe["fault_label"].value_counts())
    print()

    print("Preview:")
    print(dataframe.head())


if __name__ == "__main__":
    main()