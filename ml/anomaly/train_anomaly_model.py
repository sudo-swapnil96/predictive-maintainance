from pathlib import Path

import joblib
import pandas as pd
from sklearn.ensemble import IsolationForest
from sklearn.preprocessing import StandardScaler


# Project paths
PROJECT_ROOT = Path(__file__).resolve().parents[2]

DATASET_PATH = (
    PROJECT_ROOT
    / "ml"
    / "datasets"
    / "simulated_machine_data.csv"
)

MODEL_DIR = PROJECT_ROOT / "ml" / "models"

MODEL_PATH = MODEL_DIR / "anomaly_detector.joblib"


# The same eight parameters used by our fault classifier
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


def main():
    print("Loading dataset...")

    df = pd.read_csv(DATASET_PATH)

    print(f"Total rows: {len(df)}")

    # Train the anomaly detector only on normal operating data.
    normal_data = df[
        df["operating_state"] == "NORMAL"
    ].copy()

    print(f"Normal operating rows: {len(normal_data)}")

    X = normal_data[FEATURES]

    # Scale the features because their numerical ranges differ significantly.
    scaler = StandardScaler()

    X_scaled = scaler.fit_transform(X)

    print("\nTraining Isolation Forest...")

    model = IsolationForest(
        n_estimators=200,
        contamination=0.05,
        random_state=42,
        n_jobs=-1,
    )

    model.fit(X_scaled)

    MODEL_DIR.mkdir(
        parents=True,
        exist_ok=True,
    )

    package = {
        "model": model,
        "scaler": scaler,
        "features": FEATURES,
        "training_rows": len(normal_data),
        "data_source": "SIMULATED_MODEL",
        "contamination": 0.05,
    }

    joblib.dump(
        package,
        MODEL_PATH,
    )

    print("\nTraining complete.")
    print(f"Model saved to: {MODEL_PATH}")

    # Quick evaluation on the complete dataset
    all_X = df[FEATURES]

    all_X_scaled = scaler.transform(all_X)

    predictions = model.predict(all_X_scaled)

    # Isolation Forest returns:
    #  1  = normal
    # -1  = anomaly
    anomaly_count = int((predictions == -1).sum())

    print("\nQuick evaluation:")
    print(f"Total rows checked: {len(df)}")
    print(f"Anomalies detected: {anomaly_count}")
    print(
        f"Anomaly percentage: "
        f"{anomaly_count / len(df) * 100:.2f}%"
    )


if __name__ == "__main__":
    main()