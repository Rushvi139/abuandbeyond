"""
Drops the flat background out of a generated illustration so only the food
lands on the roundel's bone field. Flood-fills inward from the edges, which
leaves holes inside the drawing (a gap between basil leaves) intact — a
colour-key would punch those out too.
"""
from collections import deque
from PIL import Image


def cutout(path, tol=26):
    im = Image.open(path).convert("RGBA")
    w, h = im.size
    px = im.load()
    seed = px[0, 0][:3]

    def near(c):
        return all(abs(c[i] - seed[i]) <= tol for i in range(3))

    seen = bytearray(w * h)
    q = deque()
    for x in range(w):
        for y in (0, h - 1):
            q.append((x, y))
    for y in range(h):
        for x in (0, w - 1):
            q.append((x, y))

    while q:
        x, y = q.popleft()
        i = y * w + x
        if seen[i]:
            continue
        seen[i] = 1
        if not near(px[x, y][:3]):
            continue
        px[x, y] = (0, 0, 0, 0)
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            nx, ny = x + dx, y + dy
            if 0 <= nx < w and 0 <= ny < h and not seen[ny * w + nx]:
                q.append((nx, ny))

    return im.crop(im.getbbox() or (0, 0, w, h))
