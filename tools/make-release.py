#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Сборка zip-архивов Awesome Tanks 2.0.

    python3 tools/make-release.py                 # только мод (можно публиковать)
    python3 tools/make-release.py --with-game     # мод + копия игры (ЛИЧНОЕ, не публиковать)

Архив с модом не содержит ни одного файла игры: только код мода, инструменты
и start.py. Архив --with-game кладёт рядом локальную копию игры из этого
репозитория — такой архив нельзя выкладывать, он только для себя.
"""

import argparse
import hashlib
import os
import re
import shutil
import sys
import zipfile

ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
DIST = os.path.join(ROOT, "release")
NAME = "awesome-tanks-2.0"
VERSION = "2.0.5"

KIT_DIRS = ["mods", "tools"]
KIT_FILES = ["start.py", "README.md", "PUBLISHING.md", "ANALYSIS.md", "LICENSE"]
GAME_FILES = ["awesome_tanks_2.js"]
GAME_DIRS = ["images", "sounds", "styles", "fonts", "scripts"]

# что никогда не должно попасть в публикуемый архив
FORBIDDEN = [
    "awesome_tanks_2.js", "sdk.js", "(index)", "_anonymous code_",
    "images/", "sounds/", "styles/", "fonts/", "scripts/",
    "gunplay.ttf", "game.png", "game.json",
]

IGNORE = shutil.ignore_patterns(
    ".git", ".gitignore", "node_modules", "dist", "__pycache__", "*.pyc",
    "*.zip", "*.bak", ".DS_Store", "*.log",
)

START_BAT = """@echo off
rem Awesome Tanks 2.0 — запуск в один клик (нужен установленный Python 3)
where py >nul 2>nul && (py -3 start.py %* & goto :eof)
python start.py %*
"""

PLACEHOLDER = """Положите сюда свою копию HTML5-версии Awesome Tanks 2:

    awesome_tanks_2.js
    images/   sounds/   styles/   fonts/   scripts/

Затем запустите  python3 start.py  из корня архива — мод установится сам,
поднимется локальный сервер и игра откроется в браузере.

Файлы игры в этот архив не входят: они принадлежат правообладателям
(Coolmath Games; автор оригинала — emittercritter). Разрешено ставить мод
только в свою собственную копию. Подробности — в PUBLISHING.md.
"""

README_SHORT = """# Awesome Tanks 2.0 — как играть

## Быстрый старт

1. Распакуйте архив **в папку со своей копией игры** так, чтобы рядом с
   `start.py` лежал файл `awesome_tanks_2.js` и папки `images/ sounds/ styles/`
   (если игра в подпапке `game/` — тоже подойдёт).
2. Запустите:

       python3 start.py        (Windows: start.bat  или  py -3 start.py)

3. Игра откроется в браузере сама, на адресе вида http://127.0.0.1:8080.
   Остановить — Ctrl+C в консоли.

Если игра лежит в другом месте, `start.py` найдёт её сам (ищет рядом, в
подпапках `game/`, у соседей и в «Загрузках») либо укажите путь вручную:

    python3 start.py --game "путь/к/копии/игры"

Ещё полезное:

    python3 start.py --port 9000     другой порт
    python3 start.py --check         только установить мод, без запуска
    python3 start.py --uninstall     убрать мод (index.html вернётся из бэкапа)

## Что нового в 2.0

* **Хаб-меню** вместо старого выбора уровня: кампании 1.0 и 2.0, арсенал,
  магазин модификаторов, сложность, справка по клавишам.
* **15 новых карт** (уровни 16–30) в дополнение к 15 оригинальным.
* **6 новых стволов**: «Шквал», «Плазмаган», «Осколочница», «Пронзатель»,
  «Рой», «Тесла» — клавиши `Z X C V B N`, покупаются в хабе.
* **20 модификаторов за ядра** (вторая валюта ◈): ноуклип на 5 секунд сквозь
  стены и пули, рывок, щит, хронометр, ядерный залп, блинк, ударная волна,
  форсаж, берсерк, гусеницы/колёса, вампиризм, сканер, магнит и другие.
* **Родная физика**: управление и скорость — как в оригинальной игре.
* В бою: счётчик ядер, быстрый выбор новых стволов, панель мода по клавише `M`.

Ядра падают за убийства, боссов и зачистку уровней. Всё сохраняется в
обычном сохранении игры, оригинальные карты и оружие не изменены.

## Команды в консоли браузера (F12)

```js
MOD.help();        // все команды
MOD.help2();       // что в моде
MOD.addCores(200); // ядра (вторая валюта)
MOD.toHub();       // открыть хаб 2.0
MOD.unlockAll(); MOD.maxWeapons(5); MOD.god(true);
```

## Права

Мод не связан с правообладателями и не содержит файлов игры. Игра и её
материалы принадлежат Coolmath Games и автору оригинала *emittercritter*.
Подробности — в PUBLISHING.md.
"""

def log(msg):
    print(msg, flush=True)


def die(msg):
    log("ОШИБКА: " + msg)
    sys.exit(1)


def copy_tree(src, dst):
    if os.path.isdir(src):
        shutil.copytree(src, dst, ignore=IGNORE)


def patch_game_index(stage_game):
    """Подключает мод в index.html копии игры (как start.py)."""
    sys.path.insert(0, ROOT)
    import importlib.util
    spec = importlib.util.spec_from_file_location("at2_start", os.path.join(ROOT, "start.py"))
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    steps = mod.install_mod(stage_game, quiet=True)
    return steps


def build_stage(prefix, with_game):
    stage_root = os.path.join(DIST, prefix)
    if os.path.isdir(stage_root):
        shutil.rmtree(stage_root)
    os.makedirs(stage_root)

    for d in KIT_DIRS:
        copy_tree(os.path.join(ROOT, d), os.path.join(stage_root, d))
    license_src = None
    for f in KIT_FILES:
        src = os.path.join(ROOT, f)
        if os.path.isfile(src):
            shutil.copyfile(src, os.path.join(stage_root, f))
            if f == "LICENSE":
                license_src = src
    if license_src is None and os.path.isfile(os.path.join(ROOT, "mods", "LICENSE")):
        shutil.copyfile(os.path.join(ROOT, "mods", "LICENSE"), os.path.join(stage_root, "LICENSE"))
    with open(os.path.join(stage_root, "start.bat"), "w", encoding="utf-8", newline="\r\n") as fh:
        fh.write(START_BAT)
    with open(os.path.join(stage_root, "КАК-ИГРАТЬ.txt"), "w", encoding="utf-8") as fh:
        fh.write(README_SHORT)

    game_dir = os.path.join(stage_root, "game")
    os.makedirs(game_dir, exist_ok=True)

    if with_game:
        missing = [f for f in GAME_FILES if not os.path.isfile(os.path.join(ROOT, f))]
        missing += [d for d in GAME_DIRS if not os.path.isdir(os.path.join(ROOT, d))]
        if missing:
            die("нет файлов игры для --with-game: " + ", ".join(missing))
        for f in GAME_FILES:
            shutil.copyfile(os.path.join(ROOT, f), os.path.join(game_dir, f))
        for d in GAME_DIRS:
            copy_tree(os.path.join(ROOT, d), os.path.join(game_dir, d))
        steps = patch_game_index(game_dir)
        log("  · мод установлен в копию игры: " + ", ".join(steps))
    else:
        with open(os.path.join(game_dir, "ПОЛОЖИТЕ-СЮДА-ИГРУ.txt"), "w", encoding="utf-8") as fh:
            fh.write(PLACEHOLDER)

    return stage_root


def make_zip(stage_root, zip_path, with_game):
    count = 0
    total = 0
    bad = []
    with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED, compresslevel=9) as zf:
        for base, _dirs, files in os.walk(stage_root):
            for name in sorted(files):
                full = os.path.join(base, name)
                rel = os.path.relpath(full, stage_root)
                arc = os.path.join(NAME, rel).replace(os.sep, "/")
                if not with_game:
                    for f in FORBIDDEN:
                        if rel.replace(os.sep, "/").startswith(f) or rel == f:
                            bad.append(rel)
                zf.write(full, arc)
                count += 1
                total += os.path.getsize(full)
    return count, total, bad


def sha256(path):
    h = hashlib.sha256()
    with open(path, "rb") as fh:
        for chunk in iter(lambda: fh.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def main():
    ap = argparse.ArgumentParser(description="Сборка архивов Awesome Tanks 2.0")
    ap.add_argument("--with-game", action="store_true",
                    help="включить копию игры (для личного использования, не для публикации)")
    ap.add_argument("--out", default=None, help="папка для архивов (по умолчанию release/)")
    args = ap.parse_args()

    global DIST
    if args.out:
        DIST = os.path.abspath(args.out)
    if not os.path.isdir(DIST):
        os.makedirs(DIST)

    log("Awesome Tanks 2.0 — сборка архива" + (" (с копией игры)" if args.with_game else " (только мод)"))
    log("=" * 46)

    prefix = NAME + ("-full" if args.with_game else "-mod")
    stage = build_stage(prefix, args.with_game)
    zip_path = os.path.join(DIST, prefix + ".zip")
    count, total, bad = make_zip(stage, zip_path, args.with_game)

    if bad:
        die("в публикуемый архив попали файлы игры: " + ", ".join(bad))

    log("  · файлов: %d, размер %.1f МБ" % (count, total / 1048576.0))
    log("  · архив:  %s (%.1f МБ)" % (zip_path, os.path.getsize(zip_path) / 1048576.0))
    log("  · sha256: " + sha256(zip_path)[:32] + "…")

    if args.with_game:
        log("")
        log("ВАЖНО: этот архив содержит копию игры — не выкладывайте его в интернет.")
        log("Для публикации используйте архив без игры: %s-mod.zip" % NAME)
    else:
        log("")
        log("Проверка: ни одного файла игры внутри — можно публиковать.")


if __name__ == "__main__":
    main()
