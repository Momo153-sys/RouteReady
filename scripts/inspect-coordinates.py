import csv
from pathlib import Path


def normalize_coordinate(value, axis):
    value = value.strip()

    if value.count(".") == 1:
        try:
            result = float(value)
        except ValueError:
            return None
    else:
        if not value.replace(".", "").isdigit():
            return None

        digits = value.replace(".", "")

        if len(digits) < 3:
            return None

        result = float(digits[:2] + "." + digits[2:])

    limit = 90 if axis == "lat" else 180

    if not 0 < result <= limit:
        return None

    return result


valid_stops = []
rejected_stops = []

with Path("public/data/stops.csv").open(
    encoding="utf-8-sig", newline=""
) as file:
    reader = csv.DictReader(file, delimiter=";")

    for row in reader:
        latitude = normalize_coordinate(row["stop_lat"], "lat")
        longitude = normalize_coordinate(row["stop_lon"], "lon")

        if latitude is None or longitude is None:
            rejected_stops.append(row)
            continue

        row["normalized_lat"] = latitude
        row["normalized_lon"] = longitude
        valid_stops.append(row)


print("Valid stops:", len(valid_stops))
print("Rejected stops:", len(rejected_stops))

assert len(valid_stops) == 15387
assert len(rejected_stops) == 3