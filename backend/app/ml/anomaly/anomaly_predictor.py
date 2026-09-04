"""
Anomaly detection inference service for the
predictive-maintenance platform.

IMPORTANT:
    The current anomaly detector is trained using
    SIMULATED machine data and should therefore be
    treated as a demonstration model.
"""

from __future__ import annotations

from pathlib import Path
from typing import Any

import joblib
import pandas as pd


BASE_DIR = Path(__file__).resolve().parent.parent
DEFAULT_MODEL_PATH = BASE_DIR / "models" / "anomaly_detector.joblib"
MODEL_PATH = DEFAULT_MODEL_PATH if DEFAULT_MODEL_PATH.exists() else Path("/app/app/ml/models/anomaly_detector.joblib")

class AnomalyPredictor:
    """Loads and runs the trained Isolation Forest model."""

    def __init__(self, model_path: Path = MODEL_PATH) -> None:

        if not model_path.exists():
            raise FileNotFoundError(
                f"Anomaly model not found: {model_path}"
            )

        package = joblib.load(model_path)

        required_keys = {
            "model",
            "scaler",
            "features",
        }

        missing_keys = required_keys - package.keys()

        if missing_keys:
            raise ValueError(
                f"Model package is missing keys: "
                f"{sorted(missing_keys)}"
            )

        self.model = package["model"]
        self.scaler = package["scaler"]
        self.features = package["features"]
        self.model_path = model_path

    def predict(
        self,
        features: dict[str, float],
    ) -> dict[str, Any]:

        # Check that all required sensor values exist.
        missing = [
            feature
            for feature in self.features
            if feature not in features
        ]

        if missing:
            raise ValueError(
                f"Missing required features: {missing}"
            )

        # Preserve the exact feature order used during training.
        input_data = {
            feature: float(features[feature])
            for feature in self.features
        }

        dataframe = pd.DataFrame(
            [input_data],
            columns=self.features,
        )

        # Scale the sensor values.
        scaled_data = self.scaler.transform(dataframe)

        # Isolation Forest prediction:
        #  1  = normal
        # -1  = anomaly
        prediction = int(
            self.model.predict(scaled_data)[0]
        )

        # Lower decision-function values indicate
        # more unusual behaviour.
        decision_score = float(
            self.model.decision_function(scaled_data)[0]
        )

        anomaly_score = float(-decision_score)

        is_anomaly = prediction == -1

        return {
            "is_anomaly": is_anomaly,
            "status": (
                "ANOMALY"
                if is_anomaly
                else "NORMAL"
            ),
            "anomaly_score": anomaly_score,
            "decision_score": decision_score,
            "features": input_data,
            "data_source": "SIMULATED_MODEL",
            "model_path": str(self.model_path),
        }


_predictor: AnomalyPredictor | None = None


def get_anomaly_predictor() -> AnomalyPredictor:
    """Return a lazily initialized anomaly predictor."""

    global _predictor

    if _predictor is None:
        _predictor = AnomalyPredictor()

    return _predictor


def detect_anomaly(
    features: dict[str, float],
) -> dict[str, Any]:
    """Convenience function for anomaly detection."""

    predictor = get_anomaly_predictor()

    return predictor.predict(features)