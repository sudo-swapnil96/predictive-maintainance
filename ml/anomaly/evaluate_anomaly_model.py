from pathlib import Path

import joblib
import pandas as pd


PROJECT_ROOT = Path(__file__).resolve().parents[2]

DATASET_PATH = (
    PROJECT_ROOT
    / "ml"
    / "datasets"
    / "simulated_machine_data.csv"
)

MODEL_PATH = (
    PROJECT_ROOT
    / "ml"
    / "models"
    / "anomaly_detector.joblib"
)


def main():
    print("Loading dataset and anomaly model...\n")

    df = pd.read_csv(DATASET_PATH)

    package = joblib.load(MODEL_PATH)

    model = package["model"]
    scaler = package["scaler"]
    features = package["features"]

    X = df[features]

    X_scaled = scaler.transform(X)

    # Isolation Forest:
    #  1 = normal
    # -1 = anomaly
    df["anomaly_prediction"] = model.predict(X_scaled)

    df["anomaly_score"] = -model.decision_function(X_scaled)

    print("=" * 60)
    print("ANOMALY DETECTION BY OPERATING STATE")
    print("=" * 60)

    summary = df.groupby("operating_state").agg(
        total_samples=("anomaly_prediction", "count"),
        anomalies=("anomaly_prediction",
                   lambda x: (x == -1).sum()),
        normal_predictions=("anomaly_prediction",
                            lambda x: (x == 1).sum()),
        average_anomaly_score=("anomaly_score", "mean"),
    )

    summary["anomaly_percentage"] = (
        summary["anomalies"]
        / summary["total_samples"]
        * 100
    )

    print(summary.to_string())

    print("\n" + "=" * 60)
    print("INTERPRETATION")
    print("=" * 60)

    for state in ["NORMAL", "DEGRADING", "FAULT"]:
        state_data = df[
            df["operating_state"] == state
        ]

        anomalies = (
            state_data["anomaly_prediction"] == -1
        ).sum()

        percentage = (
            anomalies / len(state_data) * 100
        )

        print(
            f"{state}: "
            f"{percentage:.2f}% detected as anomalous"
        )


if __name__ == "__main__":
    main()
