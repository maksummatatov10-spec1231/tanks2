#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# Тесты установщика мод-кита (tools/at2-mod-installer.js) на «копии игры у игрока».
#
# Что проверяется:
#   1) установка в копию с index.html: блок мода вставлен перед игрой, mods/ скопированы;
#   2) повторная установка не дублирует блок;
#   3) --dry-run ничего не меняет;
#   4) --uninstall возвращает index.html байт-в-байт и удаляет mods/;
#   5) установка в копию без index.html: создаётся чистый шаблон, откат удаляет его;
#   6) установщик отказывается работать в папке без awesome_tanks_2.js.
#
# Запуск:  bash tools/test-installer.sh
# ---------------------------------------------------------------------------
set -u
cd "$(dirname "$0")/.."
ROOT="$PWD"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

pass=0; fail=0
ok()   { pass=$((pass+1)); echo "  ✓ $1"; }
bad()  { fail=$((fail+1)); echo "  ✗ $1${2:+  → $2}"; }

# --- копия игры у игрока: index.html + файл игры (символическая ссылка) ------
GAME="$WORK/game"
mkdir -p "$GAME"
ln -s "$ROOT/awesome_tanks_2.js" "$GAME/awesome_tanks_2.js"

cat > "$GAME/index.html" <<'HTML'
<!doctype html>
<html><head><meta charset="utf-8"><title>Awesome Tanks 2</title></head>
<body>
  <script>var AT = {};</script>
  <script src="awesome_tanks_2.js"></script>
</body></html>
HTML
cp "$GAME/index.html" "$WORK/index.original.html"

echo "1. Установка в копию с index.html"
node tools/at2-mod-installer.js --game "$GAME" --packs demo-pack >/dev/null 2>&1
grep -q 'AT2MOD:BEGIN' "$GAME/index.html" && ok "маркер начала блока есть" || bad "маркера начала нет"
grep -q 'mods/mod-loader.js' "$GAME/index.html" && ok "ядро подключено" || bad "ядро не подключено"
grep -q 'mods/packs/demo-pack.js' "$GAME/index.html" && ok "пак подключён" || bad "пак не подключён"
grep -q 'awesome_tanks_2.js' "$GAME/index.html" && ok "игра по-прежнему подключена" || bad "тег игры потерян"
[ -f "$GAME/mods/mod-loader.js" ] && [ -f "$GAME/mods/packs/demo-pack.js" ] \
  && ok "mods/ скопированы" || bad "mods/ не скопированы"
[ -f "$GAME/index.html.at2mod.bak" ] && ok "сделан бэкап" || bad "бэкапа нет"
python3 - "$GAME/index.html" <<'PY' && ok "блок стоит ДО тега игры" || bad "порядок тегов неправильный"
import sys
h = open(sys.argv[1], encoding="utf-8").read()
sys.exit(0 if h.index("AT2MOD:BEGIN") < h.index('src="awesome_tanks_2.js"') else 1)
PY

echo "2. Повторная установка"
node tools/at2-mod-installer.js --game "$GAME" --packs demo-pack >/dev/null 2>&1
n=$(grep -c 'AT2MOD:BEGIN' "$GAME/index.html")
[ "$n" = "1" ] && ok "блок не продублировался" || bad "блок продублирован" "раз: $n"

echo "3. --dry-run"
before=$(md5sum < "$GAME/index.html")
node tools/at2-mod-installer.js --game "$GAME" --dry-run >/dev/null 2>&1
after=$(md5sum < "$GAME/index.html")
[ "$before" = "$after" ] && ok "файл не изменён" || bad "dry-run изменил файл"

echo "4. Откат"
node tools/at2-mod-installer.js --game "$GAME" --uninstall >/dev/null 2>&1
if cmp -s "$GAME/index.html" "$WORK/index.original.html"; then ok "index.html восстановлен байт-в-байт"; else bad "index.html отличается от исходного"; fi
[ ! -d "$GAME/mods" ] && ok "mods/ удалены" || bad "mods/ остались"
[ ! -f "$GAME/index.html.at2mod.bak" ] && ok "бэкап убран" || bad "бэкап остался"

echo "5. Копия игры без index.html"
GAME2="$WORK/game2"
mkdir -p "$GAME2"
ln -s "$ROOT/awesome_tanks_2.js" "$GAME2/awesome_tanks_2.js"
node tools/at2-mod-installer.js --game "$GAME2" --packs demo-pack >/dev/null 2>&1
[ -f "$GAME2/index.html" ] && ok "index.html создан из шаблона" || bad "index.html не создан"
grep -q 'AT2MOD-GENERATED' "$GAME2/index.html" && ok "это шаблон кита (помечен)" || bad "шаблон не помечен"
grep -q 'mods/mod-loader.js' "$GAME2/index.html" && ok "ядро подключено" || bad "ядро не подключено"
node tools/at2-mod-installer.js --game "$GAME2" --uninstall >/dev/null 2>&1
[ ! -f "$GAME2/index.html" ] && ok "откат удалил созданный index.html" || bad "созданный index.html остался"

echo "6. Защита от неправильной папки"
GAME3="$WORK/empty"; mkdir -p "$GAME3"
node tools/at2-mod-installer.js --game "$GAME3" >/dev/null 2>&1
[ $? -ne 0 ] && ok "установщик отказался работать без файла игры" || bad "установщик не проверил папку"

echo
echo "──────────────"
echo "Пройдено: $pass   Провалено: $fail"
[ "$fail" -eq 0 ] || exit 1
