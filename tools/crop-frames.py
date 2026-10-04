#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Вырезает кадры из атласов игры в отдельные png (для просмотра и отладки).

    python3 tools/crop-frames.py menu/upgrades/parts/buttons/buy_normal.png ...

Кадры кладутся в /tmp/at2frames/<имя>.png. Нужен ImageMagick (convert).
Используется только для разработки; в релизный архив не обязателен.
"""
import json
import os
import subprocess
import sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
OUT = "/tmp/at2frames"

ATLASES = [
    ("images/menu/upgrades/parts.png", "images/menu/upgrades/parts.json"),
    ("images/menu/levels.png", "images/menu/levels.json"),
    ("images/game.png", "images/game.json"),
    ("images/menu/title/parts.png", "images/menu/title/parts.json"),
]


def load_index():
    idx = {}
    for png, js in ATLASES:
        if not os.path.isfile(os.path.join(ROOT, png)) or not os.path.isfile(os.path.join(ROOT, js)):
            continue
        data = json.load(open(os.path.join(ROOT, js), encoding="utf-8"))
        for name, entry in (data.get("frames") or {}).items():
            f = entry.get("frame", entry)
            idx[name] = (os.path.join(ROOT, png), f["x"], f["y"], f["w"], f["h"])
    return idx


def main():
    if len(sys.argv) < 2:
        idx = load_index()
        print("кадров в индексе: %d" % len(idx))
        for name in sorted(idx)[:40]:
            print("  " + name)
        print("...\nукажите имена кадров аргументами")
        return
    idx = load_index()
    os.makedirs(OUT, exist_ok=True)
    for name in sys.argv[1:]:
        hit = idx.get(name)
        if not hit:
            cand = [k for k in idx if name in k]
            print("нет кадра %r; похожие: %s" % (name, ", ".join(cand[:5]) or "—"))
            continue
        png, x, y, w, h = hit
        dst = os.path.join(OUT, name.split("/")[-1])
        subprocess.run(["convert", png, "-crop", "%dx%d+%d+%d" % (w, h, x, y), "+repage", dst], check=True)
        print("%-52s %3dx%-3d -> %s" % (name, w, h, dst))


if __name__ == "__main__":
    main()
