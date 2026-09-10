#!/bin/bash
# Regenerate assets/photos/thumbs/ — the 480px copies the map pins and popups
# load instead of the 2200px originals. Run after adding a photo.
#
#   ./assets/photos/build-thumbs.sh
#
# Metadata is stripped AFTER the resize: sips writes its own Exif/XMP during
# the resize, so stripping any earlier leaves the published file dirty.
set -euo pipefail
cd "$(dirname "$0")"
mkdir -p thumbs
TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT
cat > "$TMP/strip.py" <<'PY'
import sys
d = open(sys.argv[1], "rb").read()
DROP = set(range(0xE1, 0xF0)) | {0xFE}   # APP1-APP15 and COM; APP0/JFIF stays
out = bytearray(b"\xff\xd8"); i = 2
while i < len(d) - 1:
    if d[i] != 0xFF: i += 1; continue
    m = d[i+1]
    if m == 0xDA: out += d[i:]; break
    if m in (0xD8, 0x01) or 0xD0 <= m <= 0xD7: i += 2; continue
    ln = int.from_bytes(d[i+2:i+4], "big")
    if m not in DROP: out += d[i:i+2+ln]
    i += 2 + ln
open(sys.argv[2], "wb").write(bytes(out))
PY
n=0
for f in *.jpg; do
  [ -e "$f" ] || continue
  cp "$f" "$TMP/$f"
  sips -Z 480 "$TMP/$f" --setProperty formatOptions 78 >/dev/null
  python3 "$TMP/strip.py" "$TMP/$f" "thumbs/$f"
  n=$((n+1))
done
echo "$n thumbnails -> thumbs/ ($(du -sh thumbs | cut -f1))"
