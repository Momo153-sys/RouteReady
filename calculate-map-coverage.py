import json
import math
from pathlib import Path
from shapely.geometry import shape, box
from shapely.ops import unary_union

DISTRICTS_FILE = Path("istanbul-districts.json")

TARGET_DISTRICTS = {
    "Avcılar", "Bağcılar", "Bahçelievler", "Bakırköy",
    "Başakşehir", "Bayrampaşa", "Beşiktaş", "Beylikdüzü",
    "Beyoğlu", "Esenler", "Esenyurt", "Eyüpsultan",
    "Fatih", "Gaziosmanpaşa", "Güngören", "Kâğıthane",
    "Küçükçekmece", "Sarıyer", "Sultangazi", "Şişli",
    "Zeytinburnu", "Beykoz", "Çekmeköy", "Kadıköy",
    "Üsküdar", "Sultanbeyli",
}

MARGIN = 0.02  # approximately 2 km in latitude

def tile_x(lon, zoom):
    return math.floor((lon + 180) / 360 * (2 ** zoom))

def tile_y(lat, zoom):
    lat = max(min(lat, 85.05112878), -85.05112878)
    lat_rad = math.radians(lat)
    return math.floor(
        (1 - math.asinh(math.tan(lat_rad)) / math.pi)
        / 2 * (2 ** zoom)
    )

with DISTRICTS_FILE.open(encoding="utf-8") as file:
    data = json.load(file)

features = data["features"]

selected = []
found_names = set()

for feature in features:
    properties = feature.get("properties", {})
    name = (
        properties.get("name")
        or properties.get("NAME_2")
        or properties.get("district")
    )

    if name in TARGET_DISTRICTS or name == "Kağıthane":
        selected.append(shape(feature["geometry"]))
        found_names.add(name)

missing = {
    name for name in TARGET_DISTRICTS
    if name not in found_names
    and not (name == "Kâğıthane" and "Kağıthane" in found_names)
}

print(f"Districts found: {len(found_names)}/26")

if missing:
    print("Districts not matched:", sorted(missing))
    print("Available property names:")
    for feature in features:
        print(feature.get("properties", {}))
    raise SystemExit("District name matching needs adjustment.")

combined = unary_union(selected)

min_lon, min_lat, max_lon, max_lat = combined.bounds

# Add a small coverage margin.
min_lon -= MARGIN
min_lat -= MARGIN
max_lon += MARGIN
max_lat += MARGIN

print("\nFINAL BOUNDING BOX")
print(f"{min_lon:.6f},{min_lat:.6f},{max_lon:.6f},{max_lat:.6f}")

print("\nTILE ESTIMATES")

total_tiles = 0

for zoom in range(10, 15):
    x_min = tile_x(min_lon, zoom)
    x_max = tile_x(max_lon, zoom)
    y_min = tile_y(max_lat, zoom)
    y_max = tile_y(min_lat, zoom)

    count = (x_max - x_min + 1) * (y_max - y_min + 1)
    total_tiles += count

    print(
        f"Zoom {zoom}: {count:,} tiles "
        f"(X: {x_min}-{x_max}, Y: {y_min}-{y_max})"
    )

print(f"\nTOTAL ESTIMATED TILES: {total_tiles:,}")