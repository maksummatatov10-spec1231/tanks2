#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# Рисует заглушки для отсутствующих картинок помощи (клавиатура).
#
# Зачем: в исходной сборке файлы images/menu/help/keyboard*.png не сохранились,
# а игра грузит их на десктопе (в тач-версии есть свои touch*.png).
# Без них Phaser покажет «missing texture» на экране помощи.
#
# Скрипт создаёт простые, но читаемые схемы клавиш. Требуется ImageMagick (convert).
# Запуск из корня репозитория:  bash tools/make-help-placeholders.sh
# ---------------------------------------------------------------------------
set -e
cd "$(dirname "$0")/.."

FONT="DejaVu-Sans-Bold"
BG="#14181dE6"      # тёмная подложка
FG="#FFB600"        # игровой оранжевый
KEY="#2b3540"
OUT="images/menu/help"

mkdir -p "$OUT"

panel() { # panel W H "заголовок" FILE
  convert -size "$1x$2" xc:none \
    -fill "$BG" -stroke "$FG" -strokewidth 3 \
    -draw "roundrectangle 8,8 $(( $1-8 )),$(( $2-8 )) 20,20" \
    -stroke none -fill "$FG" -font "$FONT" -pointsize 30 \
    -annotate +$(( $1/2 - 130 ))+50 "$3" "$4"
}

# keycap: рисует клавишу и подпись
keycap() { # keycap FILE x y w h "label" [fontsize]
  local f=$1 x=$2 y=$3 w=$4 h=$5 l=$6 s=${7:-28}
  convert "$f" \
    -fill "$KEY" -stroke "#55636f" -strokewidth 2 \
    -draw "roundrectangle $x,$y $(( x+w )),$(( y+h )) 8,8" \
    -stroke none -fill "#e8eef5" -font "$FONT" -pointsize "$s" \
    -annotate +$(( x + w/2 - ${#l}*s*3/10 ))+$(( y + h/2 + s/3 )) "$l" \
    "$f"
}

text() { # text FILE x y "строка" [size] [color]
  convert "$1" -stroke none -fill "${6:-#FFB600}" -font "$FONT" -pointsize "${5:-22}" \
    -annotate "+$2+$3" "$4" "$1"
}

# --- общая справка ---------------------------------------------------------
panel 522 508 "УПРАВЛЕНИЕ" "$OUT/keyboard.png"
F="$OUT/keyboard.png"
keycap "$F"  60  95 60 60 W 28
keycap "$F"  10 155 60 60 A 28
keycap "$F"  60 155 60 60 S 28
keycap "$F" 110 155 60 60 D 28
text   "$F"  10 265 "движение — WASD или стрелки" 22
keycap "$F" 320  95 170 80 "" 22
text   "$F" 355 145 "ЛКМ" 26 "#e8eef5"
text   "$F" 305 218 "мышь — прицел," 16
text   "$F" 305 240 "ЛКМ — огонь" 16
keycap "$F"  60 305 60 60 "1-9" 20
text   "$F" 140 345 "выбор оружия" 22
keycap "$F"  60 385 60 60 R 28
text   "$F" 140 425 "мина" 22
keycap "$F" 330 305 60 60 P 28
text   "$F" 410 345 "пауза" 22

# --- движение --------------------------------------------------------------
panel 522 463 "ДВИЖЕНИЕ" "$OUT/keyboard_moving.png"
F="$OUT/keyboard_moving.png"
keycap "$F" 150 120 70 70 W 32
keycap "$F"  90 200 70 70 A 32
keycap "$F" 150 200 70 70 S 32
keycap "$F" 210 200 70 70 D 32
keycap "$F" 310 120 70 70 "^" 32
keycap "$F" 250 200 70 70 "<" 32
keycap "$F" 310 200 70 70 "v" 32
keycap "$F" 370 200 70 70 ">" 32
text   "$F" 100 350 "WASD или стрелки —" 22
text   "$F" 100 385 "танк едет в выбранную сторону" 20 "#aebbc9"

# --- оружие ----------------------------------------------------------------
panel 289 243 "ОРУЖИЕ" "$OUT/keyboard_weapons.png"
F="$OUT/keyboard_weapons.png"
keycap "$F"  20  85 50 50 Q 22
keycap "$F"  80  85 130 50 "1 2 3 4 5" 20
keycap "$F" 220  85 50 50 E 22
text   "$F"  20 180 "Q / E или колесо мыши —" 18
text   "$F"  20 205 "переключение оружия" 18

# --- мины ------------------------------------------------------------------
panel 288 212 "МИНЫ" "$OUT/keyboard_mines.png"
F="$OUT/keyboard_mines.png"
keycap "$F"  20  80 70 70 R 32
text   "$F" 110 125 "поставить мину" 19

# --- оружие + мины ---------------------------------------------------------
panel 289 335 "ОРУЖИЕ И МИНЫ" "$OUT/keyboard_weapons_mines.png"
F="$OUT/keyboard_weapons_mines.png"
keycap "$F"  20  85 50 50 Q 22
keycap "$F"  80  85 130 50 "1 2 3 4 5" 20
keycap "$F" 220  85 50 50 E 22
text   "$F"  20 165 "Q / E или колесо —" 18
text   "$F"  20 190 "переключение оружия" 18
keycap "$F"  20 225 70 70 R 32
text   "$F" 105 265 "поставить мину" 18

echo "Готово: $OUT/keyboard*.png"
