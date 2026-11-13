"""Generate toolbar PNGs with only the Python standard library."""

from pathlib import Path
import struct
import zlib


def chunk(kind, data):
    return (struct.pack(">I", len(data)) + kind + data
            + struct.pack(">I", zlib.crc32(kind + data)))


directory = Path(__file__).parent / "icons"
directory.mkdir(exist_ok=True)
for name, color in {"grey": (128, 128, 128), "red": (220, 55, 55),
                    "green": (35, 175, 85)}.items():
    for size in (16, 32):
        rows = bytearray()
        for y in range(size):
            rows.append(0)
            for x in range(size):
                # Supersampled circular background and a white heart.
                samples = []
                for dy in (0.125, 0.375, 0.625, 0.875):
                    for dx in (0.125, 0.375, 0.625, 0.875):
                        px = (x + dx) / size
                        py = (y + dy) / size
                        inside = (px - .5)**2 + (py - .5)**2 < .47**2
                        hx, hy = (px - .5) * 4, (.49 - py) * 4
                        heart = (hx*hx + hy*hy - .48)**3 - hx*hx * hy**3 < 0
                        samples.append((*( (255, 255, 255) if heart else color),
                                        255 if inside else 0))
                rows.extend(round(sum(s[i] for s in samples) / 16) for i in range(4))
        png = (b"\x89PNG\r\n\x1a\n"
               + chunk(b"IHDR", struct.pack(">IIBBBBB", size, size, 8, 6, 0, 0, 0))
               + chunk(b"IDAT", zlib.compress(bytes(rows))) + chunk(b"IEND", b""))
        (directory / f"{name}-{size}.png").write_bytes(png)
