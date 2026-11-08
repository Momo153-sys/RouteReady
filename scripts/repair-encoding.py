from pathlib import Path

file_path = Path("public/data/routes.csv")

original = file_path.read_text(encoding="utf-8-sig")

encoded = bytearray()

for char in original:
    try:
        encoded.extend(char.encode("cp1252"))
    except UnicodeEncodeError:
        if ord(char) <= 255:
            encoded.append(ord(char))
        else:
            encoded.extend(char.encode("utf-8"))

repaired = encoded.decode("utf-8")

file_path.write_text(repaired, encoding="utf-8-sig")

print("Routes encoding repaired successfully.")