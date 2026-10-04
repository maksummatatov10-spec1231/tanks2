#!/usr/bin/env bash
# Проверка релизного архива: сборка, распаковка, установка в копию игры, откат.
#
#   bash tools/test-release.sh
#
# Скрипт ничего не публикует и не качает: берёт файлы игры из самого репозитория
# (они лежат локально) и проверяет, что архив мода ставится и снимается.
set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="${TMPDIR:-/tmp}/at2-release-test"
FAIL=0
PASS=0

ok()   { printf '  \033[32m✓\033[0m %s\n' "$1"; PASS=$((PASS+1)); }
bad()  { printf '  \033[31m✗\033[0m %s\n' "$1"; FAIL=$((FAIL+1)); }
check(){ if [ "$2" = "$3" ]; then ok "$1 ($2)"; else bad "$1: ожидалось $3, получено $2"; fi; }

echo "── 1. сборка архива ───────────────────────────────────────"
rm -rf "$OUT"; mkdir -p "$OUT"
if python3 "$ROOT/tools/make-release.py" --out "$OUT" >"$OUT/build.log" 2>&1; then
  ok "make-release.py отработал"
else
  bad "make-release.py упал:"; sed 's/^/      /' "$OUT/build.log"; exit 1
fi

ZIP="$OUT/awesome-tanks-2.0-mod.zip"
[ -f "$ZIP" ] && ok "архив создан" || { bad "нет $ZIP"; exit 1; }

echo "── 2. содержимое архива ───────────────────────────────────"
LIST="$(python3 -c "import zipfile,sys;print('\n'.join(zipfile.ZipFile('$ZIP').namelist()))")"
check "в архиве есть start.py" "$(echo "$LIST" | grep -c 'awesome-tanks-2.0/start.py$')" "1"
check "в архиве есть start.bat" "$(echo "$LIST" | grep -c 'start.bat$')" "1"
check "в архиве есть mods/mod-loader.js" "$(echo "$LIST" | grep -c 'mods/mod-loader.js$')" "1"
check "в архиве 5 паков 2.0" "$(echo "$LIST" | grep -c 'mods/packs/at2-.*\.js$')" "5"

GAME_INSIDE="$(echo "$LIST" | grep -Ec '(^|/)(images|sounds|styles|fonts|scripts)/|awesome_tanks_2\.js|game\.(png|json)|lock\.(png|json)')"
check "файлов игры внутри нет" "$GAME_INSIDE" "0"

echo "── 3. установка в копию игры ──────────────────────────────"
mkdir -p "$OUT/kit"
python3 -c "import zipfile;zipfile.ZipFile('$ZIP').extractall('$OUT/kit')"
KIT="$OUT/kit/awesome-tanks-2.0"
GAME="$KIT/game"
mkdir -p "$GAME"

missing=0
for f in awesome_tanks_2.js index.html sdk.js; do
  [ -f "$ROOT/$f" ] && cp "$ROOT/$f" "$GAME/" || missing=1
done
for d in images sounds styles fonts scripts; do
  if [ -d "$ROOT/$d" ]; then cp -r "$ROOT/$d" "$GAME/"; else missing=1; fi
done
[ "$missing" = "0" ] && ok "копия игры собрана из репозитория" || { bad "нет файлов игры в репозитории — проверьте зеркало ассетов"; exit 1; }

# уберём блок мода из index.html, чтобы проверить честную установку с нуля
python3 - "$GAME/index.html" <<'PY'
import re, sys
p = sys.argv[1]
s = open(p, encoding="utf-8").read()
s = re.sub(r"<!-- AT2MOD:BEGIN -->.*?<!-- AT2MOD:END -->\n?", "", s, flags=re.S)
s = re.sub(r'\n?[ \t]*<script src="mods/[^"]*"></script>', "", s)
open(p, "w", encoding="utf-8").write(s)
PY

if (cd "$KIT" && python3 start.py --check >"$OUT/install.log" 2>&1); then
  ok "start.py --check: мод установлен"
else
  bad "start.py --check упал:"; sed 's/^/      /' "$OUT/install.log"
fi
check "маркеры AT2MOD в index.html" "$(grep -c 'AT2MOD:BEGIN' "$GAME/index.html")" "1"
check "лоадер подключён ровно один раз" "$(grep -cE '<script[^>]+mods/mod-loader\.js' "$GAME/index.html")" "1"
check "бэкап index.html сделан" "$(ls "$GAME" | grep -c 'index.html.at2mod.bak')" "1"
check "папка mods/ скопирована" "$(ls "$GAME/mods/packs" 2>/dev/null | grep -c '^at2-')" "5"

echo "── 4. повторный запуск (идемпотентность) ──────────────────"
(cd "$KIT" && python3 start.py --check >"$OUT/install2.log" 2>&1) && ok "повторный --check прошёл" || bad "повторный --check упал"
check "лоадер всё ещё один" "$(grep -cE '<script[^>]+mods/mod-loader\.js' "$GAME/index.html")" "1"

echo "── 5. сервер отдаёт игру ──────────────────────────────────"
PORT=$(( (RANDOM % 2000) + 9000 ))
(cd "$KIT" && python3 start.py --no-browser --port "$PORT" --host 127.0.0.1 >"$OUT/serve.log" 2>&1) &
SRV=$!
sleep 2
CODE_HTML="$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:$PORT/index.html" || echo 000)"
CODE_PACK="$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:$PORT/mods/packs/at2-ui.js" || echo 000)"
CODE_GAME="$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:$PORT/awesome_tanks_2.js" || echo 000)"
kill "$SRV" 2>/dev/null; wait "$SRV" 2>/dev/null
check "index.html отдаётся" "$CODE_HTML" "200"
check "пак at2-ui.js отдаётся" "$CODE_PACK" "200"
check "файл игры отдаётся" "$CODE_GAME" "200"

echo "── 6. откат ───────────────────────────────────────────────"
(cd "$KIT" && python3 start.py --uninstall >"$OUT/uninstall.log" 2>&1) && ok "start.py --uninstall прошёл" || bad "start.py --uninstall упал"
check "блок мода убран" "$(grep -cE '<script[^>]+mods/mod-loader\.js' "$GAME/index.html")" "0"
check "папка mods/ удалена" "$([ -d "$GAME/mods" ] && echo 1 || echo 0)" "0"
check "бэкап убран" "$(ls "$GAME" | grep -c 'index.html.at2mod.bak')" "0"

echo
echo "──────────────"
printf 'Пройдено: %d   Провалено: %d\n' "$PASS" "$FAIL"
[ "$FAIL" = "0" ] || exit 1
