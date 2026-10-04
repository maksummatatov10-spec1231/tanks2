#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Awesome Tanks 2.0 — запуск одной командой.

Что делает:
  1) ищет копию игры рядом с собой (или берёт путь из --game);
  2) ставит мод: копирует mods/ и подключает их в index.html;
  3) поднимает локальный http-сервер и САМ открывает игру в браузере.

Игровых файлов этот скрипт не содержит и ниоткуда не скачивает: нужна своя
копия HTML5-версии Awesome Tanks 2 (файлы awesome_tanks_2.js, images/, ...).

Примеры:
    python3 start.py                      # игра рядом (или в ./game)
    python3 start.py --game "C:/tanks2"   # указать папку с игрой
    python3 start.py --check              # только проверить и поставить мод
    python3 start.py --uninstall          # убрать мод
    python3 start.py --port 9000 --no-browser
"""

import argparse
import functools
import http.server
import os
import re
import shutil
import socket
import socketserver
import sys
import threading
import webbrowser

HERE = os.path.dirname(os.path.abspath(__file__))
GAME_FILE = "awesome_tanks_2.js"

MOD_BUILD = "2.0.4"          # версия сборки мода (видна в игре и в чит-меню)
ASSET_DIRS = ("images", "sounds", "scripts", "styles", "fonts")

BEGIN = "<!-- AT2MOD:BEGIN -->"
LOADER_TAG = re.compile(r"<script[^>]+src=[\"'][^\"']*mods/mod-loader\.js")
END = "<!-- AT2MOD:END -->"

PACKS = [
    "mods/mod-loader.js",
    "mods/packs/at2-core.js",
    "mods/packs/at2-campaign.js",
    "mods/packs/at2-weapons.js",
    "mods/packs/at2-modifiers.js",
    "mods/packs/at2-ui.js",
    "mods/packs/at2-cheats.js",
]

INDEX_TEMPLATE = """<!doctype html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <title>Awesome Tanks 2.0</title>
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
  <link href="styles/main.css" rel="stylesheet">
  <link href="styles/fonts.css" rel="stylesheet">
</head>
<body>
  <script>
    var AT = { SITE_LOCK_TARGET: '' };
    window.showBanner = function () { };
    window.cmgGameEvent = function () { };
  </script>
@PACKS@
  <script src="awesome_tanks_2.js"></script>
</body>
</html>
"""


def say(msg):
    print(msg, flush=True)


def die(msg, code=1):
    say("")
    say("ОШИБКА: " + msg)
    sys.exit(code)


SKIP_DIRS = {".git", "node_modules", "__pycache__", "System Volume Information",
             "$RECYCLE.BIN", ".cache", ".local", "venv", ".venv", "mods", "tools"}


def looks_like_game(folder):
    return bool(folder) and os.path.isfile(os.path.join(folder, GAME_FILE))


def _children(folder, limit=80):
    try:
        names = sorted(os.listdir(folder))
    except OSError:
        return []
    out = []
    for name in names[:limit]:
        if name.startswith(".") or name in SKIP_DIRS:
            continue
        sub = os.path.join(folder, name)
        if os.path.isdir(sub):
            out.append(sub)
    return out


def scan_for_game(folder, depth=1):
    """Ищет копию игры в folder и её подпапках (bounded depth)."""
    if looks_like_game(folder):
        return folder
    if depth <= 0:
        return None
    for sub in _children(folder):
        if looks_like_game(sub):
            return sub
    for sub in _children(folder):
        for deep in _children(sub, 40):
            if looks_like_game(deep):
                return deep
    return None


def find_game(explicit=None):
    """Порядок поиска: --game, папка скрипта и её подпапки, соседи, «Загрузки»/рабочий стол."""
    if explicit:
        for cand in (explicit, os.path.join(explicit, "game")):
            if looks_like_game(cand):
                return os.path.abspath(cand)
        found = scan_for_game(os.path.abspath(explicit), 2)
        if found:
            return os.path.abspath(found)
        die("в %s нет файла %s — укажите папку, где лежит сама игра" % (explicit, GAME_FILE))

    here = scan_for_game(HERE, 2)
    if here:
        return here

    parent = os.path.dirname(HERE)
    if parent and parent != HERE:
        found = scan_for_game(parent, 2)
        if found:
            return found

    home = os.path.expanduser("~")
    for name in ("Downloads", "Desktop", "Загрузки", "Рабочий стол", "awesome-tanks-2", "tanks2"):
        cand = os.path.join(home, name)
        found = scan_for_game(cand, 2)
        if found:
            return found
    return None


def missing_assets(game_dir):
    return [d for d in ASSET_DIRS if not os.path.isdir(os.path.join(game_dir, d))]


def pack_block(prefix=""):
    lines = [BEGIN]
    lines.append("  <!-- Awesome Tanks 2.0: мод-кит. Игровых файлов не содержит. -->")
    for rel in PACKS:
        # "?v=" — чтобы браузер не отдал из кэша старую версию пака
        lines.append('  <script src="%s%s?v=%s"></script>' % (prefix, rel, MOD_BUILD))
    lines.append(END)
    return "\n".join(lines)


def install_mod(game_dir, quiet=False):
    """Копирует mods/ и правит index.html. Возвращает список сделанных шагов."""
    steps = []
    src_mods = os.path.join(HERE, "mods")
    dst_mods = os.path.join(game_dir, "mods")
    if not os.path.isdir(src_mods):
        die("нет папки mods/ рядом со start.py — распакуйте архив целиком")

    if os.path.abspath(src_mods) != os.path.abspath(dst_mods):
        if os.path.isdir(dst_mods):
            shutil.rmtree(dst_mods, ignore_errors=True)
        shutil.copytree(src_mods, dst_mods)
        steps.append("папка mods/ скопирована в игру")

    index = os.path.join(game_dir, "index.html")
    backup = index + ".at2mod.bak"
    template = os.path.join(dst_mods, "install", "index-template.html")

    # нет страницы запуска — берём шаблон кита и вставляем блок мода
    created = not os.path.isfile(index)
    if created:
        if os.path.isfile(template):
            shutil.copyfile(template, index)
            steps.append("создан index.html из шаблона кита")
        else:
            with open(index, "w", encoding="utf-8") as fh:
                fh.write(INDEX_TEMPLATE.replace("@PACKS@", pack_block()))
            steps.append("создан index.html со встроенным блоком мода")

    with open(index, "r", encoding="utf-8", errors="replace") as fh:
        html = fh.read()

    if BEGIN in html and END in html:
        html = re.sub(re.escape(BEGIN) + r".*?" + re.escape(END), pack_block(), html, flags=re.S)
        steps.append("блок мода в index.html обновлён")
    elif LOADER_TAG.search(html):
        steps.append("мод уже подключён в index.html (не трогаю, чтобы не грузить дважды)")
    else:
        if not created and not os.path.isfile(backup):
            shutil.copyfile(index, backup)
            steps.append("бэкап: index.html.at2mod.bak")
        block = pack_block()
        tag_re = r"([ \t]*)(<script[^>]*?)" + re.escape(GAME_FILE)
        if re.search(tag_re, html):
            html = re.sub(tag_re, block + r"\n\1\2" + GAME_FILE, html, count=1)
        else:
            html = html.replace("</body>", block + "\n</body>", 1)
        steps.append("мод подключён в index.html")

    with open(index, "w", encoding="utf-8") as fh:
        fh.write(html)

    if not quiet:
        for step in steps:
            say("  · " + step)
    return steps


def uninstall_mod(game_dir):
    index = os.path.join(game_dir, "index.html")
    backup = index + ".at2mod.bak"
    if os.path.isfile(index):
        with open(index, "r", encoding="utf-8", errors="replace") as fh:
            html = fh.read()
        html2 = re.sub(re.escape(BEGIN) + r".*?" + re.escape(END) + r"\n?", "", html, flags=re.S)
        if html2 != html:
            with open(index, "w", encoding="utf-8") as fh:
                fh.write(html2)
            say("  · блок мода убран из index.html")
    if os.path.isfile(backup):
        shutil.copyfile(backup, index)
        os.remove(backup)
        say("  · index.html восстановлен из бэкапа")
    mods = os.path.join(game_dir, "mods")
    if os.path.isdir(mods) and os.path.abspath(mods) != os.path.abspath(os.path.join(HERE, "mods")):
        shutil.rmtree(mods, ignore_errors=True)
        say("  · папка mods/ удалена")


def free_port(preferred, host="127.0.0.1"):
    for port in [preferred] + list(range(preferred + 1, preferred + 40)):
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
            try:
                s.bind((host, port))
                return port
            except OSError:
                continue
    return 0


class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, fmt, *args):        # не засоряем консоль
        pass

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()


def serve(game_dir, port, open_browser=True, host="127.0.0.1"):
    handler = functools.partial(QuietHandler, directory=game_dir)
    socketserver.TCPServer.allow_reuse_address = True
    try:
        httpd = socketserver.ThreadingTCPServer((host, port), handler)
    except OSError as exc:
        die("не удалось занять порт %s: %s" % (port, exc))

    shown = "127.0.0.1" if host in ("0.0.0.0", "") else host
    url = "http://%s:%d/index.html" % (shown, port)
    if host in ("0.0.0.0", ""):
        say("  · сервер слушает все интерфейсы (0.0.0.0) — доступен и с других устройств")
    say("")
    say("Игра запущена:  " + url)
    say("Мод: Awesome Tanks 2.0 (хаб, новые карты, стволы, модификаторы за ядра)")
    say("Остановить: Ctrl+C")
    say("")

    if open_browser:
        threading.Timer(0.7, lambda: webbrowser.open(url)).start()
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        say("")
        say("Остановлено. Пока!")
    finally:
        httpd.server_close()


def main():
    ap = argparse.ArgumentParser(description="Awesome Tanks 2.0 — запуск игры с модом")
    ap.add_argument("--game", help="папка с копией игры (где лежит " + GAME_FILE + ")")
    ap.add_argument("--port", type=int, default=8080, help="порт для локального сервера (по умолчанию 8080)")
    ap.add_argument("--host", default="127.0.0.1", help="адрес сервера (по умолчанию 127.0.0.1; 0.0.0.0 — для локальной сети)")
    ap.add_argument("--no-browser", action="store_true", help="не открывать браузер автоматически")
    ap.add_argument("--check", action="store_true", help="только установить мод и проверить файлы, без сервера")
    ap.add_argument("--uninstall", action="store_true", help="убрать мод из копии игры")
    args = ap.parse_args()

    say("Awesome Tanks 2.0 — мод-кит, сборка " + MOD_BUILD)
    say("=" * 46)

    game_dir = find_game(args.game)
    if not game_dir:
        say("")
        say("Не нашёл копию игры рядом со start.py.")
        say("")
        say("Что делать (любой вариант):")
        say("  1) положите рядом с start.py свои файлы игры:")
        say("     %s, а также папки images/ sounds/ styles/ fonts/ scripts/" % GAME_FILE)
        say("     (проще всего — в подпапку game/ рядом со start.py);")
        say("  2) либо укажите путь:  python3 start.py --game \"путь/к/копии/игры\"")
        say("")
        say("Файлы игры этот архив не содержит: они принадлежат правообладателям,")
        say("поэтому мод ставится в вашу собственную копию.")
        sys.exit(2)

    say("Папка игры: " + game_dir)
    lack = missing_assets(game_dir)
    if lack:
        say("  ! нет папок: " + ", ".join(lack) + " — игра может не загрузиться")
    else:
        say("  · графика/звуки/стили на месте")

    if args.uninstall:
        uninstall_mod(game_dir)
        say("")
        say("Мод удалён. Запускайте игру как обычно.")
        return

    say("Установка мода:")
    install_mod(game_dir)

    index = os.path.join(game_dir, "index.html")
    with open(index, "r", encoding="utf-8", errors="replace") as fh:
        html = fh.read()
    ok_block = all(os.path.exists(os.path.join(game_dir, p)) for p in PACKS)
    say("  · паки на месте: " + ("да" if ok_block else "НЕТ"))
    connected = (BEGIN in html) or bool(LOADER_TAG.search(html))
    say("  · мод подключён в index.html: " + ("да" if connected else "НЕТ"))
    if not ok_block or not connected:
        die("мод установился не полностью")

    if args.check:
        say("")
        say("Проверка пройдена. Сборка мода: " + MOD_BUILD)
        say("Запуск:  python3 start.py")
        return

    port = free_port(args.port, args.host)
    if not port:
        die("не нашёл свободный порт")
    if port != args.port:
        say("  · порт %d занят, беру %d" % (args.port, port))
    serve(game_dir, port, open_browser=not args.no_browser, host=args.host)


if __name__ == "__main__":
    main()
