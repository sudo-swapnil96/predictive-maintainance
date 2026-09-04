"""
ML inference service for the predictive-maintenance platform.

IMPORTANT:
    The current model is trained only on SIMULATED data.
    Predictions produced by this service must therefore be treated
    as simulation/demo predictions until the model is retrained and
    validated using real machine data.
"""

from __future__ import annotations
import uuid
from datetime import datetime, timezone

from pathlib import Path
from typing import Any

import joblib
import pandas as pd


BASE_DIR = Path(__file__).resolve().parent.parent
DEFAULT_MODEL_PATH = BASE_DIR / "models" / "fault_state_xgboost.joblib"
MODEL_PATH = DEFAULT_MODEL_PATH if DEFAULT_MODEL_PATH.exists() else Path("/app/app/ml/models/fault_state_xgboost.joblib")

class FaultPredictor:
    """Loads and runs the trained fault-state classification model."""

    def __init__(self, model_path: Path = MODEL_PATH) -> None:
        if not model_path.exists():
            raise FileNotFoundError(
                f"ML model not found: {model_path}. "
                "Train the model before running predictions."
            )

        package = joblib.load(model_path)

        if not isinstance(package, dict):
            raise ValueError("Invalid model package format.")

        required_keys = {
            "model",
            "features",
            "label_map",
            "label_names",
        }

        missing_keys = required_keys - package.keys()

        if missing_keys:
            raise ValueError(
                f"Model package is missing required keys: {sorted(missing_keys)}"
            )

        self.model = package["model"]
        self.features = package["features"]
        self.label_map = package["label_map"]
        self.label_names = package["label_names"]

        self.model_path = model_path

    def predict(self, features: dict[str, float]) -> dict[str, Any]:
        """
        Generate a fault-state prediction.

        Parameters
        ----------
        features:
            Dictionary containing the eight required sensor parameters.

        Returns
        -------
        dict
            Predicted state, probability and class probabilities.
        """

        missing = [
            feature
            for feature in self.features
            if feature not in features
        ]

        if missing:
            raise ValueError(
                f"Missing required features: {missing}"
            )

        # Keep only the features expected by the trained model and
        # preserve the exact training order.
        input_data = {
            feature: float(features[feature])
            for feature in self.features
        }

        dataframe = pd.DataFrame(
            [input_data],
            columns=self.features,
        )

        prediction = int(self.model.predict(dataframe)[0])

        probabilities = self.model.predict_proba(dataframe)[0]

        predicted_state = self.label_names[prediction]

        class_probabilities = {
            self.label_names[index]: float(probability)
            for index, probability in enumerate(probabilities)
        }

        return {
            "predicted_state": predicted_state,
            "probability": float(probabilities[prediction]),
            "class_probabilities": class_probabilities,
            "features": input_data,
            "data_source": "SIMULATED_MODEL",
            "model_path": str(self.model_path),
        }


_predictor: FaultPredictor | None = None


def get_predictor() -> FaultPredictor:
    """Return a lazily initialized predictor instance."""

    global _predictor

    if _predictor is None:
        _predictor = FaultPredictor()

    return _predictor


def predict_machine_state(
    features: dict[str, float],
) -> dict[str, Any]:
    """Convenience function for application code."""

    predictor = get_predictor()

    return predictor.predict(features)