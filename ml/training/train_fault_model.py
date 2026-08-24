"""
Train a fault-state classifier for the predictive-maintenance project.

IMPORTANT:
    This model is trained on SIMULATED data only.
    It must not be presented as a model validated on the real industrial machine.
"""

from __future__ import annotations

from pathlib import Path

import joblib
import pandas as pd
from sklearn.metrics import (
    accuracy_score,
    classification_report,
    confusion_matrix,
)
from xgboost import XGBClassifier


DATASET_PATH = Path("ml/datasets/simulated_machine_data.csv")
MODEL_DIR = Path("ml/models")
MODEL_PATH = MODEL_DIR / "fault_state_xgboost.joblib"

FEATURES = [
    "vibration",
    "motor_temperature",
    "motor_current",
    "motor_voltage",
    "rpm",
    "pressure",
    "ambient_temperature",
    "humidity",
]

LABEL_MAP = {
    "NORMAL": 0,
    "DEGRADING": 1,
    "FAULT": 2,
}

LABEL_NAMES = ["NORMAL", "DEGRADING", "FAULT"]


def load_dataset() -> pd.DataFrame:
    if not DATASET_PATH.exists():
        raise FileNotFoundError(
            f"Dataset not found: {DATASET_PATH}. "
            "Run the simulation generator first."
        )

    df = pd.read_csv(DATASET_PATH)

    required_columns = FEATURES + ["operating_state", "data_source"]

    missing = [column for column in required_columns if column not in df.columns]

    if missing:
        raise ValueError(f"Missing required columns: {missing}")

    if df["data_source"].ne("SIMULATED").any():
        raise ValueError(
            "This training script is intended for the current simulated dataset."
        )

    if df[FEATURES].isnull().any().any():
        raise ValueError("Feature dataset contains missing values.")

    return df


def main() -> None:
    df = load_dataset()

    print("Dataset loaded successfully.")
    print(f"Rows: {len(df)}")
    print(f"Features: {len(FEATURES)}")
    print()

    # Convert labels to numeric classes.
    df["target"] = df["operating_state"].map(LABEL_MAP)

    if df["target"].isnull().any():
        raise ValueError("Unknown operating_state found in dataset.")

    # Chronological split:
    # first 80% = training data
    # final 20% = test data
    split_index = int(len(df) * 0.80)

    train_df = df.iloc[:split_index].copy()
    test_df = df.iloc[split_index:].copy()

    X_train = train_df[FEATURES]
    y_train = train_df["target"]

    X_test = test_df[FEATURES]
    y_test = test_df["target"]

    print("Chronological split:")
    print(f"Training rows: {len(train_df)}")
    print(f"Testing rows:  {len(test_df)}")
    print()

    print("Training class distribution:")
    print(train_df["operating_state"].value_counts())
    print()

    print("Testing class distribution:")
    print(test_df["operating_state"].value_counts())
    print()

    # XGBoost multiclass classifier.
    model = XGBClassifier(
        objective="multi:softprob",
        num_class=3,
        n_estimators=200,
        max_depth=5,
        learning_rate=0.05,
        subsample=0.8,
        colsample_bytree=0.8,
        random_state=42,
        eval_metric="mlogloss",
        n_jobs=-1,
    )

    print("Training XGBoost model...")
    model.fit(X_train, y_train)

    predictions = model.predict(X_test).astype(int)

    accuracy = accuracy_score(y_test, predictions)

    print()
    print("=" * 60)
    print("MODEL EVALUATION")
    print("=" * 60)
    print(f"Accuracy: {accuracy:.4f}")
    print()

    print("Classification Report:")
    print(
        classification_report(
            y_test,
            predictions,
            labels=[0, 1, 2],
            target_names=LABEL_NAMES,
            digits=4,
            zero_division=0,
        )
    )

    print("Confusion Matrix:")
    print(confusion_matrix(y_test, predictions, labels=[0, 1, 2]))

    # Feature importance.
    importance = pd.Series(
        model.feature_importances_,
        index=FEATURES,
    ).sort_values(ascending=False)

    print()
    print("Feature Importance:")
    print(importance.to_string())

    # Save model and metadata.
    MODEL_DIR.mkdir(parents=True, exist_ok=True)

    model_package = {
        "model": model,
        "features": FEATURES,
        "label_map": LABEL_MAP,
        "label_names": LABEL_NAMES,
        "training_data_source": "SIMULATED",
        "dataset": str(DATASET_PATH),
    }

    joblib.dump(model_package, MODEL_PATH)

    print()
    print(f"Model saved to: {MODEL_PATH}")


if __name__ == "__main__":
    main()