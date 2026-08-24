"""
Explainable AI service using SHAP.

The current model is trained only on simulated data.
SHAP explanations therefore explain the simulated-model prediction,
not real-machine behavior.
"""

from __future__ import annotations

from typing import Any

import pandas as pd
import shap

from app.ml.inference.predictor import get_predictor


def explain_prediction(features: dict[str, float]) -> dict[str, Any]:
    """Generate SHAP feature contributions for a prediction."""

    predictor = get_predictor()

    missing = [
        feature
        for feature in predictor.features
        if feature not in features
    ]

    if missing:
        raise ValueError(f"Missing required features: {missing}")

    input_data = {
        feature: float(features[feature])
        for feature in predictor.features
    }

    dataframe = pd.DataFrame(
        [input_data],
        columns=predictor.features,
    )

    explainer = shap.TreeExplainer(predictor.model)
    shap_values = explainer.shap_values(dataframe)

    prediction = int(predictor.model.predict(dataframe)[0])

    # XGBoost multiclass models can return either:
    #   (samples, features, classes)
    # or a list of arrays depending on SHAP/model version.
    if isinstance(shap_values, list):
        values = shap_values[prediction][0]
    else:
        values = shap_values[0, :, prediction]

    contributions = {
        feature: float(value)
        for feature, value in zip(predictor.features, values)
    }

    ranked = sorted(
        contributions.items(),
        key=lambda item: abs(item[1]),
        reverse=True,
    )

    return {
        "predicted_state": predictor.label_names[prediction],
        "feature_contributions": contributions,
        "top_contributors": [
            {
                "feature": feature,
                "shap_value": value,
                "direction": (
                    "increases_fault_prediction"
                    if value > 0
                    else "decreases_fault_prediction"
                    if value < 0
                    else "neutral"
                ),
            }
            for feature, value in ranked[:5]
        ],
        "method": "SHAP TreeExplainer",
        "data_source": "SIMULATED_MODEL",
    }