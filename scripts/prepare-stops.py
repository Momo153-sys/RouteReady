import csv
from pathlib import Path


def normalize_coordinate(value, axis):
    value = (value or "").strip()

    try:
        if not value or "E" in value.upper():
            return None

        if value.count(".") == 1:
            result = float(value)
        else:
            digits = value.replace(".", "")

            if not digits.isdigit() or len(digits) < 3:
                return None

            result = float(digits[:2] + "." + digits[2:])

        limit = 90 if axis == "latitude" else 180

        if not 0 < result <= limit:
            return None

        return result

    except (ValueError, TypeError):
        return None


source = Path("public/data/stops.csv")
destination = Path("public/data/stops-clean.csv")

accepted = 0
invalid_coordinates = 0
rejected = 0

with source.open(encoding="utf-8-sig", newline="") as input_file:
    reader = csv.DictReader(input_file, delimiter=";")

    fieldnames = [
        "stop_id",
        "stop_code",
        "stop_name",
        "stop_desc",
        "latitude",
        "longitude",
        "location_type",
    ]

    with destination.open("w", encoding="utf-8-sig", newline="") as output_file:
        writer = csv.DictWriter(output_file, fieldnames=fieldnames)
        writer.writeheader()

        for row in reader:
            stop_id = (row.get("stop_id") or "").strip()

            if not stop_id:
                rejected += 1
                continue

            latitude = normalize_coordinate(
                row.get("stop_lat"), "latitude"
            )
            longitude = normalize_coordinate(
                row.get("stop_lon"), "longitude"
            )

            if latitude is None or longitude is None:
                latitude = ""
                longitude = ""
                invalid_coordinates += 1

            writer.writerow({
                "stop_id": stop_id,
                "stop_code": row.get("stop_code", ""),
                "stop_name": row.get("stop_name", ""),
                "stop_desc": row.get("stop_desc", ""),
                "latitude": latitude,
                "longitude": longitude,
                "location_type": row.get("location_type") or "0",
            })

            accepted += 1

print(f"Accepted stops: {accepted}")
print(f"Stops with invalid coordinates: {invalid_coordinates}")
print(f"Rejected stops (missing ID): {rejected}")
print(f"Output: {destination}")