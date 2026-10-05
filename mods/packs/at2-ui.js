/*!
 * Awesome Tanks 2.0 — интерфейс (at2-ui.js), сборка 2.1
 * -----------------------------------------------------------------------------
 * ЧТО ЗДЕСЬ ЕСТЬ
 *   1) ХАБ 2.0 — отдельный экран между меню и боем: 30 карт кампании (15
 *      родных + 15 новых), арсенал, магазин модификаторов за ядра, помощь,
 *      сложность, звук/музыка. Кнопка «play» в родных меню ведёт сюда.
 *   2) В БОЮ — счётчик ядер, быстрый выбор стволов 2.0, панель мода (M).
 *
 * ВАЖНО (почему так): вся графика интерфейса рисуется кодом мода —
 * Phaser.Graphics и текст. Мод НЕ берёт ни одного кадра из атласов игры,
 * поэтому «все спрайты вместо картинки» невозможны в принципе, в любой
 * версии игры и при любом наборе кадров. Своих картинок мод тоже не тащит,
 * так что ничего чужого не распространяет.
 *
 * Шрифт Gunplay кириллицу не содержит — пишем стеком «Gunplay + системный
 * фолбэк»: латиница и цифры рисуются родным шрифтом игры, русские буквы —
 * системным (canvas умеет подставлять глифы по одному).
 *
 * Требует: mod-loader.js (+ at2-weapons / at2-modifiers по желанию).
 * Лицензия: MIT. Игровых файлов не содержит — только код.
 * ========================================================================== */
(function () {
    "use strict";

    var M = window.MOD;
    if (!M) { console.warn("[at2-ui] нужен mod-loader.js"); return; }

    var FONT = 'Gunplay, Arial, Helvetica, sans-serif';
    /* Номер сборки виден в шапке хаба и в разделе «Помощь» — по нему игрок
       сверяет, что скачал именно ту версию мода. */
    var BUILD = "2.0.5";

    /* ---------------------------- палитра ------------------------------ */
    /* Взята из родной графики игры: зелёные таблички, золото кнопок. */
    var P = {
        bg: 0x061c0f, bgLine: 0x0b2f1a,
        bar: 0x0a2c18, barLine: 0x1d6b3a,
        panel: 0x0d3a20, panelIn: 0x10482a, panelLine: 0x1f7d43,
        tile: 0x17903a, tileDark: 0x0e6a29, tileEdge: 0x08371a, tileTop: 0x35b862,
        gold: 0xffb600, goldDark: 0xc98600, goldSoft: 0xffd76a,
        bad: 0xc0392b, ok: 0x62c468, lock: 0x2b3a30, lockIn: 0x4b5f52
    };
    var T = {
        white: "#f4f9f0", dim: "#a8c6a4", gold: "#ffb600", dark: "#123d1c",
        ok: "#9be08f", bad: "#ff9f9f", core: "#7ce7ff"
    };

    /* ---------------------------- утилиты ------------------------------ */

    var GLYPHS = {
        '0':'01110/10001/10011/10101/11001/10001/01110',
        '1':'00100/01100/00100/00100/00100/00100/01110',
        '2':'01110/10001/00001/00010/00100/01000/11111',
        '3':'11111/00010/00100/00010/00001/10001/01110',
        '4':'00010/00110/01010/10010/11111/00010/00010',
        '5':'11111/10000/11110/00001/00001/10001/01110',
        '6':'00110/01000/10000/11110/10001/10001/01110',
        '7':'11111/00001/00010/00100/01000/01000/01000',
        '8':'01110/10001/10001/01110/10001/10001/01110',
        '9':'01110/10001/10001/01111/00001/00010/01100',
        'A':'01110/10001/10001/11111/10001/10001/10001',
        'B':'11110/10001/10001/11110/10001/10001/11110',
        'C':'01110/10001/10000/10000/10000/10001/01110',
        'D':'11110/10001/10001/10001/10001/10001/11110',
        'E':'11111/10000/10000/11110/10000/10000/11111',
        'F':'11111/10000/10000/11110/10000/10000/10000',
        'G':'01110/10001/10000/10111/10001/10001/01111',
        'H':'10001/10001/10001/11111/10001/10001/10001',
        'I':'01110/00100/00100/00100/00100/00100/01110',
        'J':'00111/00010/00010/00010/00010/10010/01100',
        'K':'10001/10010/10100/11000/10100/10010/10001',
        'L':'10000/10000/10000/10000/10000/10000/11111',
        'M':'10001/11011/10101/10101/10001/10001/10001',
        'N':'10001/11001/10101/10011/10001/10001/10001',
        'O':'01110/10001/10001/10001/10001/10001/01110',
        'P':'11110/10001/10001/11110/10000/10000/10000',
        'Q':'01110/10001/10001/10001/10101/10010/01101',
        'R':'11110/10001/10001/11110/10100/10010/10001',
        'S':'01111/10000/10000/01110/00001/00001/11110',
        'T':'11111/00100/00100/00100/00100/00100/00100',
        'U':'10001/10001/10001/10001/10001/10001/01110',
        'V':'10001/10001/10001/10001/10001/01010/00100',
        'W':'10001/10001/10001/10101/10101/11011/10001',
        'X':'10001/10001/01010/00100/01010/10001/10001',
        'Y':'10001/10001/01010/00100/00100/00100/00100',
        'Z':'11111/00001/00010/00100/01000/10000/11111',
        'А':'01110/10001/10001/11111/10001/10001/10001',
        'Б':'11111/10000/10000/11110/10001/10001/11110',
        'В':'11110/10001/10001/11110/10001/10001/11110',
        'Г':'11111/10000/10000/10000/10000/10000/10000',
        'Д':'00111/00101/01001/01001/10001/11111/10001',
        'Е':'11111/10000/10000/11110/10000/10000/11111',
        'Ё':'01010/11111/10000/11110/10000/10000/11111',
        'Ж':'10101/10101/10101/01110/10101/10101/10101',
        'З':'01110/10001/00001/00110/00001/10001/01110',
        'И':'10001/10001/10011/10101/11001/10001/10001',
        'Й':'01010/00100/10001/10011/10101/11001/10001',
        'К':'10001/10010/10100/11000/10100/10010/10001',
        'Л':'00111/01001/01001/01001/01001/01001/10001',
        'М':'10001/11011/10101/10101/10001/10001/10001',
        'Н':'10001/10001/10001/11111/10001/10001/10001',
        'О':'01110/10001/10001/10001/10001/10001/01110',
        'П':'11111/10001/10001/10001/10001/10001/10001',
        'Р':'11110/10001/10001/11110/10000/10000/10000',
        'С':'01110/10001/10000/10000/10000/10001/01110',
        'Т':'11111/00100/00100/00100/00100/00100/00100',
        'У':'10001/10001/10001/01111/00001/10001/01110',
        'Ф':'00100/01110/10101/10101/10101/01110/00100',
        'Х':'10001/10001/01010/00100/01010/10001/10001',
        'Ц':'10001/10001/10001/10001/10001/11111/00001',
        'Ч':'10001/10001/10001/01111/00001/00001/00001',
        'Ш':'10101/10101/10101/10101/10101/10101/11111',
        'Щ':'10101/10101/10101/10101/10101/11111/00001',
        'Ъ':'11000/01000/01000/01110/01001/01001/01110',
        'Ы':'10001/10001/10001/11101/10011/10011/11101',
        'Ь':'10000/10000/10000/11110/10001/10001/11110',
        'Э':'01110/10001/00001/00111/00001/10001/01110',
        'Ю':'10010/10101/10101/11101/10101/10101/10010',
        'Я':'01111/10001/10001/01111/00101/01001/10001',
        ' ':'00000/00000/00000/00000/00000/00000/00000',
        '.':'00000/00000/00000/00000/00000/01100/01100',
        ',':'00000/00000/00000/00000/01100/01100/11000',
        ':':'00000/01100/01100/00000/01100/01100/00000',
        ';':'00000/01100/01100/00000/01100/01100/11000',
        '!':'00100/00100/00100/00100/00100/00000/00100',
        '?':'01110/10001/00001/00110/00100/00000/00100',
        '-':'00000/00000/00000/11111/00000/00000/00000',
        '∞':'00000/11011/10101/10101/11011/00000/00000',
        '+':'00000/00100/00100/11111/00100/00100/00000',
        '=':'00000/00000/11111/00000/11111/00000/00000',
        '/':'00001/00010/00010/00100/01000/01000/10000',
        '\\':'10000/01000/01000/00100/00010/00010/00001',
        '—':'00000/00000/00000/00000/11111/11111/00000',
        '–':'00000/00000/00000/00000/11111/11111/00000',
        '…':'00000/00000/00000/00000/00000/11011/11011',
        '«':'00110/01100/11000/11000/11000/01100/00110',
        '»':'11000/01100/00110/00110/00110/01100/11000',
        '‘':'00110/00100/01000/00000/00000/00000/00000',
        '’':'01100/00100/00010/00000/00000/00000/00000',
        '×':'00000/10001/01010/00100/01010/10001/00000',
        '↑':'00100/01110/10101/00100/00100/00100/00100',
        '↓':'00100/00100/00100/00100/10101/01110/00100',
        '%':'11001/11010/00010/00100/01000/01011/10011',
        '(':'00010/00100/01000/01000/01000/00100/00010',
        ')':'01000/00100/00010/00010/00010/00100/01000',
        '[':'01110/01000/01000/01000/01000/01000/01110',
        ']':'01110/00010/00010/00010/00010/00010/01110',
        '$':'00100/01111/10100/01110/00101/11110/00100',
        '#':'01010/11111/01010/01010/11111/01010/00000',
        '*':'00000/10101/01110/11111/01110/10101/00000',
        '•':'00000/01100/11110/11110/11110/01100/00000',
        '◈':'00100/01110/11111/11111/11111/01110/00100',
        '✓':'00000/00001/00010/10100/01000/00000/00000',
        '✕':'10001/01010/00100/00100/01010/10001/00000',
        '→':'00000/00100/00010/11111/00010/00100/00000',
        '←':'00000/00100/01000/11111/01000/00100/00000',
        '©':'01110/10001/10111/10101/10111/10001/01110',
        '"':'01010/01010/00000/00000/00000/00000/00000',
        '\'':'00100/00100/00000/00000/00000/00000/00000'
    };


    /* ПИКСЕЛЬНЫЙ ШРИФТ.
       В этой сборке игры Phaser.Text не отображается: текстовые объекты
       создаются невидимыми, а canvas-текстуры не доходят до рендера.
       Поэтому буквы рисуются прямоугольниками на Graphics — работает на
       любом рендерере и не зависит от атласов игры. */
    var GW = 5, GH = 7, GAP = 1;

    function glyphRows(ch) {
        var gl = GLYPHS[ch];
        if (!gl && ch !== ch.toUpperCase()) gl = GLYPHS[ch.toUpperCase()];
        if (!gl) gl = GLYPHS['?'];
        return gl.split('/');
    }

    function textW(str, u) {
        var rows = String(str == null ? '' : str).split('\n'), w = 0, i;
        for (i = 0; i < rows.length; i++) {
            if (rows[i].length) w = Math.max(w, (rows[i].length * (GW + GAP) - GAP) * u);
        }
        return w;
    }

    /* Рисует строку в график g, начиная с локальной точки (x0, y0). */
    function drawLine(g, str, x0, y0, u, color, alpha) {
        var x = x0;
        for (var i = 0; i < str.length; i++) {
            var rows = glyphRows(str.charAt(i));
            for (var r = 0; r < GH; r++) {
                var line = rows[r], begin = -1, col;
                for (col = 0; col <= GW; col++) {
                    var on = (col < GW) && line.charAt(col) === '1';
                    if (on && begin < 0) begin = col;
                    if (!on && begin >= 0) {
                        rect(g, x + begin * u, y0 + r * u, (col - begin) * u, u, color, alpha);
                        begin = -1;
                    }
                }
            }
            x += (GW + GAP) * u;
        }
    }

    /* Текст-объект: обычный Phaser.Graphics (его можно класть в группы,
       двигать, менять alpha и scale), но с API текста. (0,0) — якорь. */
    function txt(game, x, y, str, size, color, anchor) {
        var g = game.make.graphics(0, 0);
        g.__text = String(str == null ? '' : str);
        g.__color = color || T.white;
        g.__u = unitOf(size);
        g.__ax = anchor ? anchor[0] : 0;
        g.__ay = anchor ? anchor[1] : 0;
        g.__wrapOn = false;
        g.__wrap = 0;
        g.__w = 0;
        g.__h = 0;

        g.__redraw = function () {
            g.clear();
            var u = g.__u;
            var lines = String(g.__text).split('\n'), i, out = [];
            if (g.__wrapOn && g.__wrap > 0) {
                var maxCh = Math.max(1, Math.floor((g.__wrap + GAP * u) / ((GW + GAP) * u)));
                for (i = 0; i < lines.length; i++) {
                    var words = lines[i].split(' '), cur = '';
                    for (var k = 0; k < words.length; k++) {
                        var cand = cur ? (cur + ' ' + words[k]) : words[k];
                        if (cand.length <= maxCh) cur = cand;
                        else { if (cur) out.push(cur); cur = words[k]; }
                    }
                    out.push(cur);
                }
                lines = out;
            }
            var w = 0;
            for (i = 0; i < lines.length; i++) {
                if (lines[i].length) w = Math.max(w, (lines[i].length * (GW + GAP) - GAP) * u);
            }
            var h = lines.length * GH * u + (lines.length - 1) * 2 * u;
            g.__w = w;
            g.__h = h;
            var ox = -g.__ax * w, oy = -g.__ay * h;
            for (i = 0; i < lines.length; i++) {                 /* тень */
                drawLine(g, lines[i], ox + u, oy + i * (GH + 2) * u + u, u, 0x06180d, 1);
            }
            for (i = 0; i < lines.length; i++) {                 /* сам текст */
                drawLine(g, lines[i], ox, oy + i * (GH + 2) * u, u, g.__color, 1);
            }
        };

        Object.defineProperty(g, 'text', {
            get: function () { return g.__text; },
            set: function (v) { g.__text = String(v == null ? '' : v); g.__redraw(); }
        });
        Object.defineProperty(g, 'fill', {
            get: function () { return g.__color; },
            set: function (v) { g.__color = v; g.__redraw(); }
        });
        Object.defineProperty(g, 'fontSize', {
            get: function () { return g.__u * 8; },
            set: function (v) { g.__u = unitOf(v); g.__redraw(); }
        });
        Object.defineProperty(g, 'wordWrap', {
            get: function () { return g.__wrapOn; },
            set: function (v) { g.__wrapOn = !!v; g.__redraw(); }
        });
        Object.defineProperty(g, 'wordWrapWidth', {
            get: function () { return g.__wrap; },
            set: function (v) { g.__wrap = v || 0; g.__redraw(); }
        });
        g.setText = function (v, c) { g.__text = String(v == null ? '' : v); if (c) g.__color = c; g.__redraw(); return g; };
        g.measure = function () { return { w: g.__w, h: g.__h }; };

        g.__redraw();
        g.position.set(x, y);
        return g;
    }

    function rect(g, x, y, w, h, fill, alpha) {
        g.beginFill(fill, alpha == null ? 1 : alpha);
        g.drawRect(x, y, w, h);
        g.endFill();
    }

    function rrect(g, x, y, w, h, r, fill, alpha) {
        g.beginFill(fill, alpha == null ? 1 : alpha);
        g.drawRoundedRect(x, y, w, h, r);
        g.endFill();
    }

    function line(g, x, y, w, h, color, alpha, thick) {
        g.lineStyle(thick || 2, color, alpha == null ? 1 : alpha);
        g.drawRoundedRect(x, y, w, h, 8);
        g.lineStyle(0, 0, 0);
    }

    /* Выпуклая «плитка» в стиле игры, но нарисованная кодом. */
    function plate(g, x, y, w, h, opt) {
        opt = opt || {};
        var r = opt.radius == null ? Math.min(10, Math.max(4, Math.round(Math.min(w, h) / 5))) : opt.radius;
        var edge = opt.edge == null ? P.tileEdge : opt.edge;
        var dark = opt.dark == null ? P.tileDark : opt.dark;
        var face = opt.fill == null ? P.tile : opt.fill;
        rrect(g, x, y, w, h, r, edge, opt.alpha == null ? 1 : opt.alpha);
        rrect(g, x + 2, y + 2, w - 4, h - 4, Math.max(3, r - 1), dark, opt.alpha == null ? 1 : opt.alpha);
        rrect(g, x + 3, y + 3, w - 6, h - 6, Math.max(3, r - 1), face, opt.alpha == null ? 1 : opt.alpha);
        if (!opt.flat) {
            rrect(g, x + 6, y + 4, w - 12, Math.max(3, h * .2), 4, opt.top == null ? P.tileTop : opt.top,
                (opt.alpha == null ? 1 : opt.alpha) * .45);
        }
        return g;
    }

    function panel(g, x, y, w, h, opt) {
        opt = opt || {};
        rrect(g, x, y, w, h, opt.radius == null ? 12 : opt.radius, opt.line == null ? P.panelLine : opt.line, 1);
        rrect(g, x + 2, y + 2, w - 4, h - 4, opt.radius == null ? 10 : opt.radius - 2,
            opt.fill == null ? P.panel : opt.fill, opt.alpha == null ? .98 : opt.alpha);
        return g;
    }

    /* Прозрачная текстура для областей ввода: своих файлов мод не тащит. */
    var _blank = null;
    function blank(game) {
        if (_blank) return _blank;
        _blank = game.make.bitmapData(2, 2);
        _blank.clear(0, 0, 2, 2);
        return _blank;
    }

    /* Область ввода. ВАЖНО (лекарство от «кнопки не работают»):
       спрайт растягивается через width/height (это масштаб к текстуре 2×2),
       а Phaser сравнивает точку указателя с hitArea В ТЕКСТУРНЫХ единицах.
       Если положить в hitArea размеры в пикселях (w×h), то область становится
       бесконечно широкой полосой и клик по одной кнопке срабатывает на совсем
       другой. Поэтому hitArea = размер самой текстуры (2×2), а видимая
       геометрия задаётся масштабом. */
    function hit(game, group, x, y, w, h, cb, ctx) {
        var s = game.make.sprite(x, y, blank(game));
        s.width = w; s.height = h;
        s.inputEnabled = true;
        s.input.useHandCursor = true;
        var fw = (s.texture && s.texture.frame) ? s.texture.frame.width : 2;
        var fh = (s.texture && s.texture.frame) ? s.texture.frame.height : 2;
        s.hitArea = new Phaser.Rectangle(0, 0, fw, fh);
        if (cb) s.events.onInputUp.add(function () { cb.call(ctx || null); });
        group.add(s);
        return s;
    }

    /* ---------------------------- кнопка ------------------------------- */
    /* Своя кнопка: плитка + подпись + прозрачная область ввода.
       Никаких кадров игры, поэтому она существует в любой версии. */
    function button(game, group, x, y, w, h, label, cb, ctx, opt) {
        opt = opt || {};
        var g = game.make.graphics(0, 0);
        var face = opt.fill == null ? P.tile : opt.fill;
        plate(g, 0, 0, w, h, {
            fill: face, dark: opt.dark == null ? P.tileDark : opt.dark,
            edge: opt.edge == null ? P.tileEdge : opt.edge, top: opt.top, radius: opt.radius
        });
        g.position.set(x, y);
        group.add(g);

        var t = txt(game, x + w / 2, y + h / 2, label, opt.size || 14,
            opt.color || T.white, [.5, .5]);
        group.add(t);

        var wdg = {
            gfx: g, label: t, x: x, y: y, w: w, h: h, base: label,
            enabled: opt.enabled !== false,
            setText: function (s, color) {
                t.text = s == null ? "" : String(s);
                if (color) t.fill = color;
                return wdg;
            },
            setEnabled: function (on) { wdg.enabled = !!on; hitObj.input.useHandCursor = !!on; return wdg; },
            setAlpha: function (a) { g.alpha = a; t.alpha = a; return wdg; },
            setVisible: function (v) { g.visible = v; t.visible = v; hitObj.visible = v; return wdg; },
            destroy: function () { try { g.destroy(); t.destroy(); hitObj.destroy(); } catch (e) { } }
        };

        var hitObj = hit(game, group, x, y, w, h, function () {
            if (!wdg.enabled) return;
            press(false);
            if (cb) cb.call(ctx || null);
        });
        hitObj.events.onInputDown.add(function () { if (wdg.enabled) press(true); });
        hitObj.events.onInputOut.add(function () { press(false); });
        function press(on) {
            g.y = y + (on ? 2 : 0);
            t.y = y + h / 2 + (on ? 2 : 0);
            g.alpha = on ? .82 : 1;
            t.alpha = g.alpha;
        }
        wdg.hit = hitObj;
        return wdg;
    }

    /* --------------------------- иконки -------------------------------- */
    /* Все иконки — фигуры средствами Graphics: монета, ядро (ромб),
       замок, звезда, галочка, динамик, нота. */
    function poly(g, pts, fill, alpha) {
        if (!pts || pts.length < 3) return;
        g.beginFill(fill, alpha == null ? 1 : alpha);
        g.moveTo(pts[0][0], pts[0][1]);
        for (var i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]);
        g.lineTo(pts[0][0], pts[0][1]);
        g.endFill();
    }

    function icon(game, group, kind, x, y, s, color) {
        var g = game.make.graphics(0, 0);
        var c = color == null ? P.gold : color;
        if (kind === "coin") {
            g.beginFill(0x7a4b00, 1); g.drawCircle(x, y, s); g.endFill();
            g.beginFill(c, 1); g.drawCircle(x, y, s * .82); g.endFill();
            g.beginFill(0xffe9a8, .9); g.drawCircle(x - s * .25, y - s * .25, s * .22); g.endFill();
        } else if (kind === "core") {
            g.beginFill(0x08343d, 1); g.drawCircle(x, y, s); g.endFill();
            poly(g, [[x, y - s * .68], [x + s * .62, y], [x, y + s * .68], [x - s * .62, y]], c, 1);
        } else if (kind === "lock") {
            g.lineStyle(Math.max(2, s * .3), c, 1);
            g.moveTo(x - s * .42, y - s * .1);
            g.lineTo(x - s * .42, y - s * .5);
            g.arc(x, y - s * .5, s * .42, Math.PI, 0, false);
            g.lineTo(x + s * .42, y - s * .1);
            g.lineStyle(0, 0, 0);
            g.beginFill(c, 1); g.drawRoundedRect(x - s * .62, y - s * .18, s * 1.24, s * .98, s * .18); g.endFill();
        } else if (kind === "star") {
            var pts = [], n = 5, R = s, r = s * .45;
            for (var i = 0; i < n * 2; i++) {
                var a = -Math.PI / 2 + i * Math.PI / n, rr = (i % 2 ? r : R);
                pts.push([x + Math.cos(a) * rr, y + Math.sin(a) * rr]);
            }
            poly(g, pts, c, 1);
        } else if (kind === "check") {
            g.lineStyle(Math.max(2.5, s * .36), c, 1);
            g.moveTo(x - s * .6, y + s * .05);
            g.lineTo(x - s * .12, y + s * .5);
            g.lineTo(x + s * .7, y - s * .5);
            g.lineStyle(0, 0, 0);
        } else if (kind === "sound" || kind === "music") {
            g.beginFill(c, 1);
            g.drawRect(x - s * .55, y - s * .22, s * .3, s * .44);
            g.endFill();
            poly(g, [[x - s * .25, y - s * .22], [x + s * .12, y - s * .62],
                     [x + s * .12, y + s * .62], [x - s * .25, y + s * .22]], c, 1);
            if (kind === "music") {
                g.beginFill(c, 1);
                g.drawCircle(x + s * .42, y + s * .42, s * .22);
                g.endFill();
            }
        }
        g.__icon = kind;
        group.add(g);
        return g;
    }

    function moneyFmt(n) {
        n = Math.round(n || 0);
        var s = String(n), out = "";
        while (s.length > 3) { out = " " + s.slice(-3) + out; s = s.slice(0, -3); }
        return s + out;
    }

    /* --------------------------- состояние ----------------------------- */

    function money() { try { return window.AT.profile.current.game.money || 0; } catch (e) { return 0; } }
    function unlockedCount() { try { return window.AT.profile.current.game.levels || 0; } catch (e) { return 0; } }
    function bestPoints(n) { try { return window.AT.profile.current.game.points[n - 1] || 0; } catch (e) { return 0; } }
    function diffIndex() {
        try {
            var d = Number(window.AT.profile.current.game.difficulty);
            if (!isFinite(d)) d = 0;
            return Math.max(0, Math.min(2, Math.round(d)));
        } catch (e) { return 0; }
    }
    function soundOn() { try { return !!window.AT.profile.current.game.sound; } catch (e) { return true; } }
    function musicOn() { try { return !!window.AT.profile.current.game.music; } catch (e) { return true; } }
    function cores() { return M.cores ? M.cores() : 0; }
    function ownedMods() { return M.ownedModifierDefs ? M.ownedModifierDefs() : []; }

    var DIFF = ["ЛЕГКО", "СРЕДНЕ", "ТЯЖЕЛО"];
    var TOTAL_MAPS = 30;            /* 15 родных + 15 новых */
    var VANILLA_MAPS = 15;

    function terrainName(n) {
        try {
            var m = window.AT.LEVELS[n - 1];
            return (m && m[1]) || "";
        } catch (e) { return ""; }
    }
    function mapName(n) {
        try {
            var m = window.AT.LEVELS[n - 1];
            return (m && m[0]) || ("Уровень " + n);
        } catch (e) { return "Уровень " + n; }
    }
    function isOpen(n) { return n <= unlockedCount() + 1 && n >= 1 && n <= TOTAL_MAPS; }

    /* ============================== ХАБ 2.0 ============================= */
    /* Виртуальное поле 960×600, масштабируется под окно (как в родных меню). */

    var VW = 960, VH = 600;
    var TILE_W = 104, TILE_H = 60, TGX = 10, TGY = 6;
    var GRID_X = 30, GRID_Y = 146, COLS = 6;
    var SIDE_X = 716, SIDE_W = 228;

    function unitOf(size) { return size >= 26 ? 4 : size >= 17 ? 3 : size >= 11 ? 2 : 1; }

    /* Наибольший размер из списка, при котором строка влезает в maxPx. */
    function bestSize(str, sizes, maxPx) {
        for (var i = 0; i < sizes.length; i++) {
            if (textW(str, unitOf(sizes[i])) <= maxPx) return sizes[i];
        }
        return sizes[sizes.length - 1];
    }

    /* Обрезать строку так, чтобы она влезла в maxPx. */
    function fit(str, size, maxPx) {
        str = String(str == null ? "" : str);
        var per = (GW + GAP) * unitOf(size);
        var max = Math.max(1, Math.floor(maxPx / per));
        if (str.length <= max) return str;
        return str.slice(0, Math.max(1, max - 2)) + "..";
    }

    function Hub() {
        this.tab = 0;
        this.page = 0;
        this.sel = 1;
        this._w = 0;
        this._h = 0;
    }

    Hub.prototype.create = function () {
        var g = this.game, self = this;
        try { g.input.enabled = true; } catch (e) { }
        this.stage.backgroundColor = 0x04150b;

        this.root = g.add.group();
        this.back = g.make.graphics(0, 0);
        this.root.add(this.back);
        this._paintBack();

        this.topG = g.make.graphics(0, 0);
        this.root.add(this.topG);
        this._paintTop();

        this.title = txt(g, 22, 10, "AWESOME TANKS 2.0", 15, T.gold);
        this.root.add(this.title);
        this.subtitle = txt(g, 22, 32, "\u043C\u043E\u0434 2.0 \u2014 30 \u043A\u0430\u0440\u0442, 6 \u0441\u0442\u0432\u043E\u043B\u043E\u0432, 20 \u043C\u043E\u0434\u043E\u0432 \u00B7 \u0421\u0411\u041E\u0420\u041A\u0410 " + BUILD, 10, T.dim);
        this.root.add(this.subtitle);

        this.moneyT = txt(g, 566, 29, "", 10, T.gold, [0, .5]);
        this.coresT = txt(g, 714, 29, "", 10, T.core, [0, .5]);
        this.root.add(this.moneyT);
        this.root.add(this.coresT);

        this.menuBtn = button(g, this.root, 838, 13, 102, 32, "\u041C\u0415\u041D\u042E", function () {
            self.go("MenuUpgrades");
        }, this, { size: 10, fill: P.tileEdge, dark: 0x05230f, edge: 0x05230f });

        /* — вкладки — */
        this.tabs = [];
        var tabNames = ["\u041A\u0410\u0420\u0422\u0410", "\u0410\u0420\u0421\u0415\u041D\u0410\u041B", "\u041C\u041E\u0414\u0418\u0424\u0418\u041A\u0410\u0422\u041E\u0420\u042B", "\u041F\u041E\u041C\u041E\u0429\u042C"];
        tabNames.forEach(function (name, i) {
            var b = button(g, self.root, 20 + i * 222, 64, 216, 38, name, function () {
                self.tab = i; self.page = 0; self.refresh();
            }, self, { size: 10 });
            b.__i = i;
            b.__base = name;
            self.tabs.push(b);
        });

        this.contentG = g.make.graphics(0, 0);
        this.root.add(this.contentG);
        this.content = g.add.group();
        this.root.add(this.content);

        this.msgT = txt(g, 26, 118, "", 10, T.dim);
        this.root.add(this.msgT);
        this.hintT = txt(g, 26, 570, "", 9, T.dim);
        this.root.add(this.hintT);

        this.diffBtns = [];
        ["\u041B\u0415\u0413\u041A\u041E", "\u0421\u0420\u0415\u0414\u041D\u0415", "\u0422\u042F\u0416\u0415\u041B\u041E"].forEach(function (d, i) {
            var b = button(g, self.root, 470 + i * 92, 498, 86, 30, d, function () {
                self.setDifficulty(i);
            }, self, { size: 10 });
            self.diffBtns.push(b);
        });

        this.soundBtn = button(g, self.root, 760, 498, 88, 30, "\u0417\u0412\u0423\u041A", function () { self.toggleSound(); }, self, { size: 10 });
        this.musicBtn = button(g, this.root, 852, 498, 88, 30, "\u041C\u0423\u0417\u042B\u041A\u0410", function () { self.toggleMusic(); }, self, { size: 9 });

        this.overlay = g.add.group();
        this.root.add(this.overlay);
        this.overlay.visible = false;

        this.layout(g.width, g.height);
        this.refresh();
        this.fade();
    };

    Hub.prototype._paintBack = function () {
        var g = this.back;
        g.clear();
        rect(g, 0, 0, VW, VH, P.bg, 1);
        for (var i = 0; i < 12; i++) rect(g, 0, i * 50, VW, 25, P.bgLine, .3);
        rect(g, 0, 0, VW, 3, P.barLine, .5);
        rect(g, 0, VH - 3, VW, 3, P.barLine, .5);
    };

    Hub.prototype._paintTop = function () {
        var g = this.topG;
        g.clear();
        rect(g, 0, 0, VW, 56, P.bar, .98);
        rect(g, 0, 54, VW, 2, P.gold, .8);
        rrect(g, 540, 13, 138, 32, 8, P.panelIn, 1);
        line(g, 540, 13, 138, 32, P.panelLine, 1, 2);
        rrect(g, 688, 13, 138, 32, 8, P.panelIn, 1);
        line(g, 688, 13, 138, 32, P.panelLine, 1, 2);
        this._coins = null;
    };

    Hub.prototype.shutdown = function () {
        if (this.root) { try { this.root.destroy(true); } catch (e) { } }
        this.root = null; this.content = null; this.overlay = null; this.tabs = [];
    };

    Hub.prototype.layout = function (w, h) {
        if (!this.root) return;
        var s = Math.min(w / VW, h / VH);
        this.root.scale.set(s);
        this.root.position.set(Math.round((w - VW * s) / 2), Math.round((h - VH * s) / 2));
        this._w = w; this._h = h;
        try { this.camera.bounds = null; this.camera.setSize(w, h); } catch (e) { }
    };
    Hub.prototype.resize = function (w, h) { this.layout(w, h); };

    Hub.prototype.update = function () {
        if (!this.root) return;
        if (this.game.width !== this._w || this.game.height !== this._h) this.layout(this.game.width, this.game.height);
    };

    Hub.prototype.fade = function () {
        try {
            this.root.alpha = 0;
            this.game.add.tween(this.root).to({ alpha: 1 }, 180, Phaser.Easing.Linear.None, true);
        } catch (e) { this.root.alpha = 1; }
    };

    Hub.prototype.go = function (state) {
        try { this.game.state.start(state); }
        catch (e) { M.warn("переход в " + state + " не удался:", e); }
    };

    Hub.prototype.msg = function (s, color) {
        if (this.msgT) { this.msgT.setText(s || "", color || T.dim); }
    };
    Hub.prototype.hint = function (s, color) {
        if (this.hintT) { this.hintT.setText(s || "", color || T.dim); }
    };

    Hub.prototype.updateTop = function () {
        if (!this.root) return;
        if (!this._coins) {
            this._coins = [
                icon(this.game, this.root, "coin", 554, 29, 10),
                icon(this.game, this.root, "core", 702, 29, 10)
            ];
        }
        this.moneyT.setText(moneyFmt(money()), T.gold);
        this.moneyT.position.set(568, 29);
        this.coresT.setText(String(cores()), T.core);
        this.coresT.position.set(716, 29);

        var d = diffIndex();
        (this.diffBtns || []).forEach(function (b, i) {
            var on = i === d;
            b.gfx.alpha = on ? 1 : .5;
            b.label.alpha = on ? 1 : .6;
            b.setText(b.base || "", on ? T.white : T.dim);
        });
        if (this.soundBtn) this.soundBtn.setText(soundOn() ? "\u0417\u0412\u0423\u041A \u2713" : "\u0417\u0412\u0423\u041A \u2715", soundOn() ? T.white : T.dim);
        if (this.musicBtn) this.musicBtn.setText(musicOn() ? "\u041C\u0423\u0417\u042B\u041A\u0410 \u2713" : "\u041C\u0423\u0417\u042B\u041A\u0410 \u2715", musicOn() ? T.white : T.dim);
    };

    Hub.prototype.setDifficulty = function (i) {
        try {
            window.AT.profile.current.game.difficulty = i;
            window.AT.profile.save();
            this.msg("\u0421\u043B\u043E\u0436\u043D\u043E\u0441\u0442\u044C: " + DIFF[i], T.ok);
        } catch (e) { this.msg("\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u0441\u043E\u0445\u0440\u0430\u043D\u0438\u0442\u044C", T.bad); }
        this.updateTop();
    };

    Hub.prototype.toggleSound = function () {
        var on = !soundOn();
        try {
            window.AT.profile.current.game.sound = on;
            if (window.AT.audio && window.AT.audio.toggleSound) window.AT.audio.toggleSound(on);
            window.AT.profile.save();
        } catch (e) { }
        this.msg(on ? "\u0417\u0432\u0443\u043A \u0432\u043A\u043B\u044E\u0447\u0451\u043D" : "\u0417\u0432\u0443\u043A \u0432\u044B\u043A\u043B\u044E\u0447\u0435\u043D");
        this.updateTop();
    };

    Hub.prototype.toggleMusic = function () {
        var on = !musicOn();
        try {
            window.AT.profile.current.game.music = on;
            if (window.AT.audio && window.AT.audio.toggleMusic) window.AT.audio.toggleMusic(on);
            window.AT.profile.save();
        } catch (e) { }
        this.msg(on ? "\u041C\u0443\u0437\u044B\u043A\u0430 \u0432\u043A\u043B\u044E\u0447\u0435\u043D\u0430" : "\u041C\u0443\u0437\u044B\u043A\u0430 \u0432\u044B\u043A\u043B\u044E\u0447\u0435\u043D\u0430");
        this.updateTop();
    };

    Hub.prototype.refresh = function () {
        var g = this.game, self = this;
        if (!this.root) return;
        this.content.removeAll(true);
        this.overlay.visible = false;
        this.overlay.removeAll(true);

        var cg = this.contentG;
        cg.clear();
        panel(cg, 16, 110, 928, 382, { radius: 14 });

        (this.tabs || []).forEach(function (b, i) {
            var on = (i === self.tab);
            b.gfx.alpha = on ? 1 : .6;
            b.label.alpha = on ? 1 : .72;
            b.setText(b.__base, on ? T.white : T.dim);
            if (on) {
                var mark = g.make.graphics(0, 0);
                line(mark, 0, 0, 216, 38, P.gold, 1, 3);
                mark.position.set(20 + i * 222, 64);
                self.content.add(mark);
            }
        });

        this.updateTop();

        if (this.tab === 0) { this.hint("\u041A\u043B\u0438\u043A \u043F\u043E \u043A\u0430\u0440\u0442\u0435 \u2014 \u0432\u044B\u0431\u0440\u0430\u0442\u044C, \u00AB\u0418\u0413\u0420\u0410\u0422\u042C\u00BB \u2014 \u0432 \u0431\u043E\u0439"); this.buildMap(); }
        else if (this.tab === 1) { this.hint("\u0421\u0442\u0432\u043E\u043B\u044B 2.0 \u043F\u043E\u043A\u0443\u043F\u0430\u044E\u0442\u0441\u044F \u0437\u0434\u0435\u0441\u044C; \u0432 \u0431\u043E\u044E \u043A\u043B\u0430\u0432\u0438\u0448\u0438 Z X C V B N"); this.buildArsenal(); }
        else if (this.tab === 2) { this.hint("\u041C\u043E\u0434\u0438\u0444\u0438\u043A\u0430\u0442\u043E\u0440\u044B \u043F\u043E\u043A\u0443\u043F\u0430\u044E\u0442\u0441\u044F \u0437\u0430 \u044F\u0434\u0440\u0430 \u25C8"); this.buildMods(); }
        else { this.hint("\u041A\u043B\u0430\u0432\u0438\u0448\u0438, \u044F\u0434\u0440\u0430 \u0438 \u0447\u0438\u0442-\u043C\u0435\u043D\u044E \u2014 \u043F\u0440\u0430\u0432\u044B\u0439 Shift"); this.buildHelp(); }
    };

    /* ------------------------------ КАРТА ------------------------------ */
    /* По 15 карт на страницу: 1.0 (1-15) и 2.0 (16-30). Крупные карточки,
       название подбирается под ширину, справа — панель выбранной карты. */

    var CARD_W = 220, CARD_H = 64, CGX = 11, CGY = 4;
    var MAP_X = 30, MAP_Y = 146, MAP_COLS = 3;
    var SIDE_X = 716, SIDE_W = 228;

    Hub.prototype.pageCount = function () { return Math.ceil(TOTAL_MAPS / 15); };

    Hub.prototype.buildMap = function () {
        var g = this.game, self = this;
        var first = this.page * 15 + 1, last = Math.min(TOTAL_MAPS, first + 14);

        for (var n = first; n <= last; n++) {
            (function (num) {
                var k = num - first;
                var col = k % MAP_COLS, row = Math.floor(k / MAP_COLS);
                var x = MAP_X + col * (CARD_W + CGX);
                var y = MAP_Y + row * (CARD_H + CGY);
                var open = isOpen(num);
                var done = bestPoints(num) > 0;
                var sel = (self.sel === num);

                var gg = g.make.graphics(0, 0);
                plate(gg, x, y, CARD_W, CARD_H, {
                    fill: !open ? P.lock : (done ? 0x0f7a2e : P.tile),
                    dark: !open ? 0x1d281f : P.tileDark,
                    edge: !open ? 0x101a13 : P.tileEdge,
                    top: open ? P.tileTop : 0x53604f
                });
                if (sel) line(gg, x - 2, y - 2, CARD_W + 4, CARD_H + 4, P.gold, 1, 3);
                self.content.add(gg);

                var nb = g.make.graphics(0, 0);
                rrect(nb, x + 10, y + 14, num >= 10 ? 40 : 32, 34, 7, open ? 0x08371a : 0x1a241b, 1);
                self.content.add(nb);
                self.content.add(txt(g, x + (num >= 10 ? 30 : 26), y + 31, String(num), 15, open ? T.gold : T.dim, [.5, .5]));
                self.content.add(txt(g, x + (num >= 10 ? 58 : 50), y + 12, mapName(num), bestSize(mapName(num), [11, 10], num >= 10 ? 138 : 146), open ? T.white : T.dim));
                self.content.add(txt(g, x + (num >= 10 ? 58 : 50), y + 34, open ? (num <= VANILLA_MAPS ? "\u041A\u0410\u041C\u041F\u0410\u041D\u0418\u042F 1.0" : "\u041A\u0410\u041C\u041F\u0410\u041D\u0418\u042F 2.0") : "\u0417\u0410\u041A\u0420\u042B\u0422\u0410", 10, T.dim));

                if (done) icon(g, self.content, "check", x + CARD_W - 16, y + 16, 8, 0x62c468);
                else if (!open) icon(g, self.content, "lock", x + CARD_W - 16, y + 16, 9, 0x8fa08d);

                hit(g, self.content, x, y, CARD_W, CARD_H, function () {
                    self.sel = num;
                    self.msg(open ? ("\u0412\u044B\u0431\u0440\u0430\u043D\u0430 \u043A\u0430\u0440\u0442\u0430 " + num + ": " + mapName(num))
                        : ("\u041A\u0430\u0440\u0442\u0430 " + num + " \u0437\u0430\u043A\u0440\u044B\u0442\u0430 \u2014 \u043F\u0440\u043E\u0439\u0434\u0438\u0442\u0435 \u0443\u0440\u043E\u0432\u0435\u043D\u044C " + (num - 1)), open ? T.white : T.bad);
                    self.refresh();
                });
            })(n);
        }

        /* — панель выбранной карты — */
        var n = Math.min(Math.max(this.sel, 1), TOTAL_MAPS);
        var open = isOpen(n);

        var pg = g.make.graphics(0, 0);
        panel(pg, SIDE_X, MAP_Y, SIDE_W, 346, { radius: 12, fill: P.panelIn });
        this.content.add(pg);

        this.content.add(txt(g, SIDE_X + SIDE_W / 2, MAP_Y + 12, "\u041A\u0410\u0420\u0422\u0410 " + n, 17, T.gold, [.5, 0]));
        this.content.add(txt(g, SIDE_X + SIDE_W / 2, MAP_Y + 42, mapName(n), 11, T.white, [.5, 0]));
        this.content.add(txt(g, SIDE_X + SIDE_W / 2, MAP_Y + 62, (n <= VANILLA_MAPS ? "\u043A\u0430\u043C\u043F\u0430\u043D\u0438\u044F 1.0" : "\u043A\u0430\u043C\u043F\u0430\u043D\u0438\u044F 2.0"), 10, T.dim, [.5, 0]));

        var best = bestPoints(n);
        this.content.add(txt(g, SIDE_X + SIDE_W / 2, MAP_Y + 84,
            open ? (best > 0 ? ("\u0441\u0447\u0451\u0442: " + best) : "\u0435\u0449\u0451 \u043D\u0435 \u043F\u0440\u043E\u0439\u0434\u0435\u043D\u0430")
                 : ("\u043D\u0443\u0436\u0435\u043D \u0443\u0440\u043E\u0432\u0435\u043D\u044C " + (n - 1)),
            10, open ? (best > 0 ? T.ok : T.dim) : T.bad, [.5, 0]));

        this.content.add(txt(g, SIDE_X + SIDE_W / 2, MAP_Y + 110, "\u0441\u043B\u043E\u0436\u043D\u043E\u0441\u0442\u044C: " + DIFF[diffIndex()], 10, T.white, [.5, 0]));
        this.content.add(txt(g, SIDE_X + SIDE_W / 2, MAP_Y + 130, "\u043F\u0440\u043E\u0448\u043B\u0438: " + Math.min(unlockedCount(), TOTAL_MAPS) + " \u0438\u0437 " + TOTAL_MAPS, 10, T.dim, [.5, 0]));
        this.content.add(txt(g, SIDE_X + SIDE_W / 2, MAP_Y + 150, "\u044F\u0434\u0440\u0430: \u25C8 " + cores(), 11, T.core, [.5, 0]));

        var play = button(g, this.content, SIDE_X + 16, MAP_Y + 176, SIDE_W - 32, 50,
            open ? "\u0418\u0413\u0420\u0410\u0422\u042C" : "\u0417\u0410\u041A\u0420\u042B\u0422\u041E",
            function () {
                if (!open) { self.msg("\u0421\u043D\u0430\u0447\u0430\u043B\u0430 \u043F\u0440\u043E\u0439\u0434\u0438\u0442\u0435 \u0443\u0440\u043E\u0432\u0435\u043D\u044C " + (n - 1), T.bad); return; }
                self.play(n);
            }, this, { size: 17 });
        if (!open) play.setAlpha(.6);

        var pages = this.pageCount();
        button(g, this.content, SIDE_X + 16, MAP_Y + 236, 44, 26, "<", function () {
            self.page = (self.page + pages - 1) % pages; self.sel = self.page * 15 + 1; self.refresh();
        }, this, { size: 11 });
        button(g, this.content, SIDE_X + SIDE_W - 60, MAP_Y + 236, 44, 26, ">", function () {
            self.page = (self.page + 1) % pages; self.sel = self.page * 15 + 1; self.refresh();
        }, this, { size: 11 });
        this.content.add(txt(g, SIDE_X + SIDE_W / 2, MAP_Y + 249, "\u043A\u0430\u043C\u043F\u0430\u043D\u0438\u044F " + (this.page + 1) + " / " + pages, 10, T.dim, [.5, .5]));

        this.content.add(txt(g, SIDE_X + 16, MAP_Y + 274, "WASD \u0438\u043B\u0438 \u0441\u0442\u0440\u0435\u043B\u043A\u0438 \u2014 \u0445\u043E\u0434", 10, T.dim));
        this.content.add(txt(g, SIDE_X + 16, MAP_Y + 292, "\u043C\u044B\u0448\u044C \u2014 \u043E\u0433\u043E\u043D\u044C", 10, T.dim));
        this.content.add(txt(g, SIDE_X + 16, MAP_Y + 310, "M \u2014 \u043F\u0430\u043D\u0435\u043B\u044C \u043C\u043E\u0434\u0430", 10, T.dim));
        this.content.add(txt(g, SIDE_X + 16, MAP_Y + 328, "\u043F\u0440\u0430\u0432\u044B\u0439 Shift \u2014 \u0447\u0438\u0442\u044B", 10, T.dim));
    };

    Hub.prototype.play = function (n) {
        this.msg("\u0411\u043E\u0439: \u043A\u0430\u0440\u0442\u0430 " + n + " \u2014 " + mapName(n), T.ok);
        if (M.playLevel && M.playLevel(n)) return;
        this.msg("\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u0437\u0430\u043F\u0443\u0441\u0442\u0438\u0442\u044C \u043A\u0430\u0440\u0442\u0443 " + n, T.bad);
    };

    /* ----------------------------- АРСЕНАЛ ----------------------------- */

    Hub.prototype.buildArsenal = function () {
        var g = this.game, self = this;
        var list = (M.arsenal && M.arsenal.list()) || [];
        if (!list.length) {
            this.content.add(txt(g, VW / 2, 280, "\u0410\u0440\u0441\u0435\u043D\u0430\u043B \u043D\u0435 \u043F\u043E\u0434\u043A\u043B\u044E\u0447\u0451\u043D", 17, T.bad, [.5, 0]));
            return;
        }
        var perCol = 3, rowH = 100;
        list.forEach(function (a, i) {
            var col = Math.floor(i / perCol), row = i % perCol;
            var x = 32 + col * 460, y = 146 + row * (rowH + 6);
            self.rowWeapon(a, x, y, 444, rowH);
        });
    };

    Hub.prototype.rowWeapon = function (a, x, y, w, h) {
        var g = this.game, self = this;
        var gg = g.make.graphics(0, 0);
        plate(gg, x, y, w, h, { fill: a.owned ? P.panelIn : 0x123a22, dark: 0x0a2f1a, edge: 0x08240f, flat: true });
        this.content.add(gg);

        var bg = g.make.graphics(0, 0);
        rrect(bg, x + 10, y + 10, 34, 34, 7, a.owned ? P.gold : 0x25402c, 1);
        this.content.add(bg);
        this.content.add(txt(g, x + 27, y + 27, a.key || "?", 17, a.owned ? T.dark : T.dim, [.5, .5]));

        this.content.add(txt(g, x + 56, y + 12, a.name, 17, a.owned ? T.white : T.gold));
        this.content.add(txt(g, x + 56, y + 40, a.owned
            ? ("\u0443\u0440\u043E\u0432\u0435\u043D\u044C " + (a.level + 1) + " \u0438\u0437 4")
            : a.desc, 10, T.dim));

        var line3 = a.owned
            ? (a.maxAmmo !== Infinity ? ("\u043F\u0430\u0442\u0440\u043E\u043D\u044B: " + a.ammo + " / " + a.maxAmmo) : "\u043F\u0430\u0442\u0440\u043E\u043D\u044B \u0431\u0435\u0441\u043A\u043E\u043D\u0435\u0447\u043D\u044B")
            : ("\u0446\u0435\u043D\u0430: $ " + moneyFmt(a.price));
        this.content.add(txt(g, x + 56, y + 60, line3, 10, a.owned ? T.dim : T.gold));
        this.content.add(txt(g, x + 56, y + 78, a.owned
            ? (a.price != null ? ("\u0443\u043B\u0443\u0447\u0448\u0435\u043D\u0438\u0435: $ " + moneyFmt(a.price)) : "\u043C\u0430\u043A\u0441\u0438\u043C\u0443\u043C")
            : "\u043A\u043B\u0430\u0432\u0438\u0448\u0430 " + a.key + " \u0432 \u0431\u043E\u044E", 10, T.dim));

        var gold = { fill: P.gold, color: T.dark, dark: P.goldDark, edge: 0x6b4b00, top: P.goldSoft, size: 11 };
        var grey = { fill: 0x4c5a4c, color: T.dim, dark: 0x334033, edge: 0x223022, top: 0x6a7a6a, size: 11 };

        if (a.owned && a.ammoPrice) {
            var canAmmo = money() >= a.ammoPrice;
            button(g, this.content, x + w - 130, y + h - 40, 118, 30, "\u041F\u0410\u0422\u0420\u041E\u041D\u042B", function () {
                var r = M.arsenal.buyAmmo(a.id);
                self.msg(r && r.ok ? ("\u041F\u0430\u0442\u0440\u043E\u043D\u044B: " + r.ammo + " / " + r.max) : ("\u041D\u0435 \u0432\u044B\u0448\u043B\u043E: " + ((r && r.reason) || "?")),
                    r && r.ok ? T.ok : T.bad);
                self.refresh();
            }, this, Object.assign({}, canAmmo ? gold : grey));
        }

        if (!a.owned) {
            var afford = money() >= a.price;
            button(g, this.content, x + w - 130, y + 12, 118, 34, "\u041A\u0423\u041F\u0418\u0422\u042C", function () {
                var r = M.arsenal.buy(a.id);
                self.msg(r && r.ok ? ("\u041A\u0443\u043F\u043B\u0435\u043D\u043E: " + a.name) : ("\u041D\u0435 \u0432\u044B\u0448\u043B\u043E: " + ((r && r.reason) || "?")),
                    r && r.ok ? T.ok : T.bad);
                self.refresh();
            }, this, Object.assign({}, afford ? gold : grey));
        } else if (a.price != null) {
            var afford2 = money() >= a.price;
            button(g, this.content, x + w - 130, y + 12, 118, 34, "\u0423\u041B\u0423\u0427\u0428\u0418\u0422\u042C", function () {
                var r = M.arsenal.upgrade(a.id);
                self.msg(r && r.ok ? (a.name + ": \u0443\u0440\u043E\u0432\u0435\u043D\u044C " + (r.level + 1)) : ("\u041D\u0435 \u0432\u044B\u0448\u043B\u043E: " + ((r && r.reason) || "?")),
                    r && r.ok ? T.ok : T.bad);
                self.refresh();
            }, this, Object.assign({}, afford2 ? gold : grey));
        } else {
            this.content.add(txt(g, x + w - 71, y + 29, "\u041C\u0410\u041A\u0421\u0418\u041C\u0423\u041C", 11, T.ok, [.5, .5]));
        }
    };

    /* -------------------------- МОДИФИКАТОРЫ --------------------------- */

    Hub.prototype.buildMods = function () {
        var g = this.game, self = this;
        var list = (M.mods && M.mods.list()) || [];
        if (!list.length) {
            this.content.add(txt(g, VW / 2, 280, "\u041C\u043E\u0434\u0438\u0444\u0438\u043A\u0430\u0442\u043E\u0440\u044B \u043D\u0435 \u043F\u043E\u0434\u043A\u043B\u044E\u0447\u0451\u043D\u044B", 17, T.bad, [.5, 0]));
            return;
        }
        var perCol = 10, rowH = 30;
        list.forEach(function (m, i) {
            var col = Math.floor(i / perCol), row = i % perCol;
            var x = 32 + col * 460, y = 136 + row * (rowH + 2);
            self.rowMod(m, x, y, 444, rowH);
        });
        this.content.add(txt(g, VW / 2, 472, "\u0410\u043A\u0442\u0438\u0432\u043D\u044B\u0435 \u2014 \u043D\u0430 \u043A\u043B\u0430\u0432\u0438\u0448\u0443 \u0432 \u0431\u043E\u044E, \u043F\u0430\u0441\u0441\u0438\u0432\u043D\u044B\u0435 \u0440\u0430\u0431\u043E\u0442\u0430\u044E\u0442 \u0432\u0441\u0435\u0433\u0434\u0430.", 10, T.dim, [.5, 0]));
    };

    Hub.prototype.rowMod = function (m, x, y, w, h) {
        var g = this.game, self = this;
        var active = m.kind === "active";
        /* область «показать описание» кладём первым слоем: кнопка покупки
           добавляется позже и оказывается выше, иначе она не получит клик */
        hit(g, this.content, x + 4, y + 2, w - 100, h - 4, function () {
            self.msg(m.name + ": " + (m.desc || "") + (active ? ("   клавиша " + (m.key || "-") + ", перезарядка " + (m.cd || 0) + " с") : "   пассивный"), T.white);
        });
        var gg = g.make.graphics(0, 0);
        plate(gg, x, y, w, h, { fill: m.owned ? P.panelIn : 0x123a22, dark: 0x0a2f1a, edge: 0x08240f, flat: true, radius: 7 });
        this.content.add(gg);

        var bg = g.make.graphics(0, 0);
        rrect(bg, x + 6, y + 5, 24, 24, 5, m.owned ? (active ? P.gold : 0x3fb85f) : 0x25402c, 1);
        this.content.add(bg);
        this.content.add(txt(g, x + 18, y + 17, active ? (m.key || "\u2022") : "\u221E", 11, m.owned ? T.dark : T.dim, [.5, .5]));

        this.content.add(txt(g, x + 38, y + 10, m.name, bestSize(m.name, [11, 10], 240), m.owned ? T.white : T.gold));

        if (m.owned) {
            icon(g, self.content, "check", x + w - 96, y + h / 2, 8, 0x62c468);
            this.content.add(txt(g, x + w - 82, y + h / 2, "\u041A\u0423\u041F\u041B\u0415\u041D\u041E", 10, T.ok, [0, .5]));
        } else {
            var afford = cores() >= m.price;
            button(g, this.content, x + w - 96, y + 4, 90, 26, "\u25C8 " + m.price, function () {
                var r = M.mods.buy(m.id);
                self.msg(r && r.ok ? ("\u041A\u0443\u043F\u043B\u0435\u043D\u043E: " + m.name) : ("\u041D\u0435 \u0432\u044B\u0448\u043B\u043E: " + ((r && r.reason) || "?")),
                    r && r.ok ? T.ok : T.bad);
                self.refresh();
            }, this, {
                size: 11, enabled: afford,
                fill: afford ? P.gold : 0x4c5a4c, color: afford ? T.dark : T.dim,
                dark: P.goldDark, edge: 0x6b4b00, top: P.goldSoft
            });
        }

    };

    /* ----------------------------- ПОМОЩЬ ------------------------------ */

    Hub.prototype.buildHelp = function () {
        var g = this.game;
        var gold = T.gold, white = T.white, dim = T.dim;
        function head(x, y, text) { this.content.add(txt(g, x, y, text, 12, gold)); }
        head.call(this, 44, 148, "\u0423\u041F\u0420\u0410\u0412\u041B\u0415\u041D\u0418\u0415 \u0412 \u0411\u041E\u042E");
        head.call(this, 366, 148, "\u041C\u041E\u0414\u0418\u0424\u0418\u041A\u0410\u0422\u041E\u0420\u042B");
        head.call(this, 690, 148, "\u0427\u0422\u041E \u041D\u041E\u0412\u041E\u0413\u041E");

        var move = [
            "WASD \u0438\u043B\u0438 \u0441\u0442\u0440\u0435\u043B\u043A\u0438 \u2014 \u0434\u0432\u0438\u0436\u0435\u043D\u0438\u0435 \u0442\u0430\u043D\u043A\u0430",
            "\u043C\u044B\u0448\u044C \u2014 \u0431\u0430\u0448\u043D\u044F, \u043B\u0435\u0432\u0430\u044F \u043A\u043D\u043E\u043F\u043A\u0430 \u2014 \u043E\u0433\u043E\u043D\u044C",
            "1 \u2026 0 \u2014 \u0440\u043E\u0434\u043D\u044B\u0435 \u0441\u0442\u0432\u043E\u043B\u044B,  Q/E \u2014 \u043F\u0435\u0440\u0435\u0431\u043E\u0440",
            "Z X C V B N \u2014 \u0448\u0435\u0441\u0442\u044C \u0441\u0442\u0432\u043E\u043B\u043E\u0432 2.0",
            "M \u2014 \u043F\u0430\u043D\u0435\u043B\u044C \u043C\u043E\u0434\u0430 (\u0441\u0442\u0430\u0432\u0438\u0442 \u0431\u043E\u0439 \u043D\u0430 \u043F\u0430\u0443\u0437\u0443)",
            "\u043F\u0440\u0430\u0432\u044B\u0439 Shift \u2014 \u0447\u0438\u0442-\u043C\u0435\u043D\u044E, Esc \u2014 \u0437\u0430\u043A\u0440\u044B\u0442\u044C",
            "",
            "\u0421\u041E\u0412\u0415\u0422\u042B",
            "\u0421\u043D\u0430\u0447\u0430\u043B\u0430 \u043A\u0443\u043F\u0438\u0442\u0435 \u0433\u0443\u0441\u0435\u043D\u0438\u0446\u044B \u0438 \u0431\u0440\u043E\u043D\u044E \u2014 \u0436\u0438\u0442\u044C",
            "\u0441\u0442\u0430\u043D\u0435\u0442 \u043F\u0440\u043E\u0449\u0435. \u042F\u0434\u0440\u0430 \u043A\u043E\u043F\u044F\u0442\u0441\u044F \u0437\u0430 \u0437\u0430\u0447\u0438\u0441\u0442\u043A\u0443 \u043A\u0430\u0440\u0442.",
            "\u041F\u043E\u0432\u0442\u043E\u0440\u043D\u043E\u0435 \u043F\u0440\u043E\u0445\u043E\u0436\u0434\u0435\u043D\u0438\u0435 \u0434\u0430\u0451\u0442 \u0431\u043E\u043B\u044C\u0448\u0435 \u0430\u043B\u043C\u0430\u0437\u043E\u0432,",
            "\u0441\u043B\u043E\u0436\u043D\u043E\u0441\u0442\u044C \u043C\u0435\u043D\u044F\u0435\u0442\u0441\u044F \u043A\u043D\u043E\u043F\u043A\u0430\u043C\u0438 \u0432\u043D\u0438\u0437\u0443."
        ];
        var mods = [
            "H \u043D\u043E\u0443\u043A\u043B\u0438\u043F 5 \u0441   G \u0440\u044B\u0432\u043E\u043A",
            "J \u0449\u0438\u0442 6 \u0441      K \u0445\u0440\u043E\u043D\u043E\u043C\u0435\u0442\u0440",
            "L \u044F\u0434\u0435\u0440\u043D\u044B\u0439 \u0437\u0430\u043B\u043F U \u0431\u043B\u0438\u043D\u043A",
            "I \u0443\u0434\u0430\u0440\u043D\u0430\u044F \u0432\u043E\u043B\u043D\u0430 O \u0444\u043E\u0440\u0441\u0430\u0436",
            "Y \u0431\u0435\u0440\u0441\u0435\u0440\u043A",
            "",
            "\u041F\u0410\u0421\u0421\u0418\u0412\u041D\u042B\u0415 (\u0440\u0430\u0431\u043E\u0442\u0430\u044E\u0442 \u0432\u0441\u0435\u0433\u0434\u0430):",
            "\u0433\u0443\u0441\u0435\u043D\u0438\u0446\u044B, \u0448\u0438\u043F\u044B, \u0431\u0430\u0448\u043D\u044F, \u0441\u043E\u0431\u0438\u0440\u0430\u0442\u0435\u043B\u044C,",
            "\u0432\u0430\u043C\u043F\u0438\u0440\u0438\u0437\u043C, \u0431\u0440\u043E\u043D\u044F, \u0431\u043E\u0435\u0437\u0430\u043F\u0430\u0441, \u0441\u043A\u0430\u043D\u0435\u0440,",
            "\u043C\u0430\u0433\u043D\u0438\u0442, \u043F\u0440\u0438\u0437\u0440\u0430\u043A, \u0434\u0435\u0442\u043E\u043D\u0430\u0442\u043E\u0440",
            "",
            "\u0410\u043A\u0442\u0438\u0432\u043D\u044B\u0435 \u043C\u043E\u0434\u044B \u043F\u043E\u043A\u0443\u043F\u0430\u044E\u0442\u0441\u044F \u0437\u0430 \u044F\u0434\u0440\u0430 \u25C8 \u0432",
            "\u0440\u0430\u0437\u0434\u0435\u043B\u0435 \u00AB\u041C\u041E\u0414\u0418\u0424\u0418\u041A\u0410\u0422\u041E\u0420\u042B\u00BB, \u0430 \u043A\u0430\u0436\u0434\u044B\u0439 \u0441\u0442\u0432\u043E\u043B",
            "2.0 \u2014 \u0437\u0430 \u0434\u0435\u043D\u044C\u0433\u0438 \u0432 \u0440\u0430\u0437\u0434\u0435\u043B\u0435 \u00AB\u0410\u0420\u0421\u0415\u041D\u0410\u041B\u00BB."
        ];
        var info = [
            "\u2022 15 \u043D\u043E\u0432\u044B\u0445 \u043A\u0430\u0440\u0442 \u2014 \u0443\u0440\u043E\u0432\u043D\u0438 16 \u2026 30",
            "\u2022 6 \u043D\u043E\u0432\u044B\u0445 \u0441\u0442\u0432\u043E\u043B\u043E\u0432 \u0437\u0430 \u0434\u0435\u043D\u044C\u0433\u0438",
            "\u2022 20 \u043C\u043E\u0434\u0438\u0444\u0438\u043A\u0430\u0442\u043E\u0440\u043E\u0432 \u0437\u0430 \u044F\u0434\u0440\u0430 \u25C8",
            "\u2022 \u0447\u0438\u0442-\u043C\u0435\u043D\u044E: \u0441\u043A\u043E\u0440\u043E\u0441\u0442\u044C, \u0431\u0435\u0441\u0441\u043C\u0435\u0440\u0442\u0438\u0435,",
            "  \u0434\u0435\u043D\u044C\u0433\u0438 \u0438 \u044F\u0434\u0440\u0430",
            "",
            "\u042F\u0434\u0440\u0430 \u25C8 \u043F\u0430\u0434\u0430\u044E\u0442 \u0437\u0430 \u0443\u0431\u0438\u0439\u0441\u0442\u0432\u0430 \u0438 \u0437\u0430",
            "\u043F\u043E\u043B\u043D\u0443\u044E \u0437\u0430\u0447\u0438\u0441\u0442\u043A\u0443 \u043A\u0430\u0440\u0442\u044B.",
            "",
            "\u041F\u0440\u043E\u0433\u0440\u0435\u0441\u0441 \u0445\u0440\u0430\u043D\u0438\u0442\u0441\u044F \u0432 \u0441\u043E\u0445\u0440\u0430\u043D\u0435\u043D\u0438\u0438",
            "\u0438\u0433\u0440\u044B: \u0434\u0435\u043D\u044C\u0433\u0438, \u044F\u0434\u0440\u0430, \u043A\u0443\u043F\u043B\u0435\u043D\u043D\u043E\u0435,",
            "\u043E\u0442\u043A\u0440\u044B\u0442\u044B\u0435 \u043A\u0430\u0440\u0442\u044B. \u0420\u043E\u0434\u043D\u0430\u044F \u0438\u0433\u0440\u0430 \u0438 \u0435\u0451",
            "\u0431\u0430\u043B\u0430\u043D\u0441 \u043D\u0435 \u0438\u0437\u043C\u0435\u043D\u0435\u043D\u044B.",
            "",
            "\u041C\u043E\u0434 \u0431\u0435\u0441\u043F\u043B\u0430\u0442\u043D\u044B\u0439, \u043D\u0435 \u0441\u0432\u044F\u0437\u0430\u043D \u0441",
            "\u0430\u0432\u0442\u043E\u0440\u0430\u043C\u0438 \u0438\u0433\u0440\u044B \u0438 \u043D\u0435 \u0441\u043E\u0434\u0435\u0440\u0436\u0438\u0442 \u043D\u0438",
            "\u043E\u0434\u043D\u043E\u0433\u043E \u0435\u0451 \u0444\u0430\u0439\u043B\u0430 \u2014 \u0442\u043E\u043B\u044C\u043A\u043E \u043A\u043E\u0434.",
            "",
            "\u0421\u0431\u043E\u0440\u043A\u0430: " + BUILD
        ];
        this.content.add(txt(g, 44, 176, move.join("\n"), 10, white));
        this.content.add(txt(g, 366, 176, mods.join("\n"), 10, white));
        this.content.add(txt(g, 690, 176, info.join("\n"), 10, white));
    };

    /* ===================== ПАТЧ РОДНЫХ МЕНЮ =========================== */

    /* Кнопка «play» в родных меню ведёт в хаб 2.0. */
    function hookMenu(state) {
        if (!state || state.__at2hub || typeof state.next !== "function") return;
        state.__at2hub = true;
        var orig = state.next;
        state.next = function () {
            var g = window.AT && window.AT.game;
            if (g && g.state && g.state.checkState && g.state.checkState("AT2Hub")) {
                try { g.state.start("AT2Hub"); return; } catch (e) { }
            }
            return orig.apply(this, arguments);
        };
    }

    function hookMenus() {
        var g = window.AT && window.AT.game;
        if (!g || !g.state || !g.state.states) return;
        var st = g.state.states;

        hookMenu(st.MenuTitle);
        hookMenu(st.MenuUpgrades);
        Object.keys(st).forEach(function (key) {
            var s = st[key];
            if (!s || s.__at2uiHook || !/^Level\d+$/.test(key)) return;
            s.__at2uiHook = true;
            M.wrap(s, "create", function (orig) {
                return function () {
                    var r = orig.apply(this, arguments);
                    try { installBattle(this); } catch (e) { M.warn("бой-интерфейс 2.0:", e); }
                    return r;
                };
            });
            M.wrap(s, "update", function (orig) {
                return function () {
                    try { tickBattle(this); } catch (e) { }
                    return orig.apply(this, arguments);
                };
            });
            M.wrap(s, "shutdown", function (orig) {
                return function () {
                    try { dropBattle(this); } catch (e) { }
                    return orig.apply(this, arguments);
                };
            });
        });
    }

    /* ====================== БОЙ: HUD И ПАНЕЛЬ ========================= */

    /* Панель 2.0: жёсткая раскладка, содержимое меняется — геометрия нет.
       Шрифт пиксельный моноширинный: 1 знак = 12 px при размере 12,
       поэтому колонки выравниваются пробелами. */
    var PANEL_W = 600, PANEL_PAD = 22, PANEL_COL = 271, PANEL_LINE = 12;
    var PANEL_STEP = 20;
    var PANEL_PLAN = (function () {
        var rows = [], divs = [], secs = [];
        function add(y, role, col, sec, slot, text) {
            rows.push({ y: y, role: role, col: col, x: PANEL_PAD + (col ? PANEL_COL : 0),
                        sec: sec || "", slot: slot == null ? -1 : slot, text: text || "" });
        }
        function items(sec, first, count) {
            for (var i = 0; i < count; i++) {
                add(first + i * PANEL_STEP, "item", 0, sec, i);
                add(first + i * PANEL_STEP, "item", 1, sec, count + i);
            }
            return first + count * PANEL_STEP;
        }
        var y;
        add(46, "money", 0, "money", 0);
        add(46, "money", 1, "money", 1);
        divs.push(74);
        secs.push({ y: 82, text: "АКТИВНЫЕ — КЛАВИША И СОСТОЯНИЕ" });
        y = items("act", 104, 5);
        divs.push(y + 8);
        secs.push({ y: y + 16, text: "ПАССИВНЫЕ МОДИФИКАТОРЫ" });
        y = items("pas", y + 38, 6);
        divs.push(y + 8);
        secs.push({ y: y + 16, text: "НОВЫЕ СТВОЛЫ 2.0" });
        y = items("gun", y + 38, 3);
        divs.push(y + 8);
        rows.push({ y: y + 16, role: "note", col: 0, x: PANEL_PAD, sec: "", slot: -1,
                    text: "ПОКУПКИ — В ХАБЕ 2.0. ЗДЕСЬ ТОЛЬКО СПРАВКА." });
        return { rows: rows, divs: divs, secs: secs, h: y + 46 };
    })();

    function installBattle(lvl) {
        if (!lvl || lvl.__at2ui) return;
        var g = lvl.game;
        if (!g || !g.add || !g.make) return;

        var ui = lvl.__at2ui = { slots: [], items: [], w: 0, h: 0 };
        var layer = g.add.group(g.stage);
        lvl.__at2layer = layer;

        /* счётчик ядер */
        var coreG = g.make.graphics(0, 0);
        plate(coreG, 0, 0, 152, 34, { fill: P.tileDark, dark: 0x0a2f1a, edge: P.tileEdge, top: P.tileTop });
        layer.add(coreG);
        icon(g, layer, "core", 24, 17, 10, 0x7ce7ff);
        ui.coreT = txt(g, 44, 17, String(cores()), 16, T.white, [0, .5]);
        layer.add(ui.coreT);
        ui.coreG = coreG;

        /* кнопки стволов 2.0 */
        var ars = (M.arsenal && M.arsenal.list()) || [];
        ars.forEach(function (a) {
            var b = button(g, layer, 0, 0, 38, 32, a.key, function () {
                var d = M.data().weapons[a.id];
                if (!d || d.level < 0) { if (M.toast) M.toast("Ствол не куплен: " + a.name, T.bad); return; }
                var idx = (M.arsenal.indexOf ? M.arsenal.indexOf(a.id) : (M.arsenal.firstIndex + 0));
                if (lvl.changeWeapon) { try { lvl.changeWeapon(idx); } catch (e) { } }
                else { var p = lvl.player; if (p && p.changeWeapon) p.changeWeapon(idx); }
            }, null, { size: 15 });
            b.__id = a.id;
            ui.slots.push(b);
            ui.items.push(b);
        });

        /* кнопка панели */
        var pb = button(g, layer, 0, 0, 38, 32, "M", function () { togglePanel(lvl); }, null, {
            size: 15, fill: P.gold, dark: P.goldDark, edge: 0x6b4b00, top: P.goldSoft, color: T.dark
        });
        ui.panelBtn = pb;
        ui.items.push(pb);

        /* сама панель */
        var pw = PANEL_W, ph = PANEL_PLAN.h;
        ui.panG = g.make.graphics(0, 0);
        panel(ui.panG, 0, 0, pw, ph, { radius: 14 });
        rect(ui.panG, PANEL_PAD - 4, 40, pw - 2 * (PANEL_PAD - 4), 2, P.panelLine, 1);
        PANEL_PLAN.divs.forEach(function (y) {
            rect(ui.panG, PANEL_PAD - 4, y, pw - 2 * (PANEL_PAD - 4), 1, P.panelLine, .55);
        });
        ui.panG.visible = false;
        layer.add(ui.panG);
        /* строки панели: создаём один раз, дальше только меняем текст и цвет */
        ui.panRows = PANEL_PLAN.rows.map(function (r) {
            var t = txt(g, r.x, r.y, r.text, PANEL_LINE, T.white);
            t.visible = false;
            layer.add(t);
            return t;
        });
        ui.panSecs = PANEL_PLAN.secs.map(function (sec) {
            var t = txt(g, PANEL_PAD, sec.y, sec.text, 12, T.gold);
            t.visible = false;
            layer.add(t);
            return t;
        });
        /* скрытая «сводка» — на случай отладки и автотестов */
        ui.panT = txt(g, PANEL_PAD, 54, "", 13, T.white);
        ui.panT.visible = false;
        layer.add(ui.panT);
        ui.panTitle = txt(g, pw / 2, 14, "ПАНЕЛЬ 2.0", 18, T.gold, [.5, 0]);
        ui.panTitle.visible = false;
        layer.add(ui.panTitle);

        ui.close = button(g, layer, pw - 40, 12, 28, 24, "✕", function () { togglePanel(lvl); }, null, { size: 14 });
        ui.close.setVisible(false);
        ui.items.push(ui.close);

        ui.panel = ui.panG;

        /* подсказка снизу */
        ui.tip = txt(g, 14, 0, "M — панель мода   ·   правый Shift — чит-меню", 11, T.dim);
        layer.add(ui.tip);

        layoutBattle(lvl);
        try { g.add.tween(layer).from({ alpha: 0 }, 220, Phaser.Easing.Linear.None, true); } catch (e) { }

        /* клики по нашим кнопкам не должны стрелять */
        if (lvl.hud && lvl.hud.pointerOver) {
            ["pointerOver", "pointerDown"].forEach(function (name) {
                M.wrap(lvl.hud, name, function (orig) {
                    return function (id) {
                        if (orig.call(this, id)) return true;
                        return hitMine(lvl, id);
                    };
                });
            });
        }

        try { lvl.addKey("M", function () { togglePanel(lvl); }, lvl, []); } catch (e) { }

        M.on("cores", function () {
            if (lvl.__at2ui !== ui || !ui.coreT) return;
            ui.coreT.text = String(cores());
            try { g.add.tween(ui.coreT.scale).from({ x: 1.3, y: 1.3 }, 160, Phaser.Easing.Quadratic.Out, true); } catch (e) { }
        });
        M.on("enemyKilled", function (e) {
            if (!e || !(e.cores > 0) || e.level !== lvl || lvl.__at2ui !== ui) return;
            flash(lvl, "◈ +" + e.cores);
        });
        M.on("levelComplete", function (e) {
            if (!e || e.level !== lvl || lvl.__at2ui !== ui) return;
            flash(lvl, "ЗАЧИСТКА: ◈ +" + e.cores, T.ok);
        });
    }

    function layoutBattle(lvl) {
        var ui = lvl.__at2ui;
        if (!ui) return;
        var w = lvl.game.width, h = lvl.game.height;
        ui.w = w; ui.h = h;

        if (ui.coreG) ui.coreG.position.set(12, 10);
        if (ui.coreT) ui.coreT.position.set(56, 27);

        var n = ui.slots.length + 1;
        var span = 42, x0 = Math.max(12, w - 14 - n * span);
        ui.slots.forEach(function (b, i) {
            var x = x0 + i * span;
            b.gfx.position.set(x, 10); b.label.position.set(x + 19, 26); b.hit.position.set(x, 10);
        });
        var px = x0 + ui.slots.length * span;
        if (ui.panelBtn) {
            ui.panelBtn.gfx.position.set(px, 10);
            ui.panelBtn.label.position.set(px + 19, 26);
            ui.panelBtn.hit.position.set(px, 10);
        }

        var pw = Math.min(PANEL_W, w - 20);
        var ph = Math.min(PANEL_PLAN.h, h - 90);
        var px0 = Math.round((w - pw) / 2), py0 = 46;
        if (ui.panG) ui.panG.position.set(px0, py0);
        if (ui.panTitle) ui.panTitle.position.set(w / 2, py0 + 14);
        if (ui.panT) ui.panT.position.set(px0 + PANEL_PAD, py0 + 54);
        if (ui.panRows) {
            PANEL_PLAN.rows.forEach(function (spec, i) {
                var t = ui.panRows[i];
                if (t) t.position.set(px0 + spec.x, py0 + spec.y);
            });
        }
        if (ui.panSecs) {
            PANEL_PLAN.secs.forEach(function (sec, i) {
                var t = ui.panSecs[i];
                if (t) t.position.set(px0 + PANEL_PAD, py0 + sec.y);
            });
        }
        if (ui.close) {
            ui.close.gfx.position.set(px0 + pw - 40, py0 + 10);
            ui.close.label.position.set(px0 + pw - 26, py0 + 22);
            ui.close.hit.position.set(px0 + pw - 40, py0 + 10);
        }
        if (ui.tip) ui.tip.position.set(14, h - 22);
    }

    function tickBattle(lvl) {
        var ui = lvl.__at2ui;
        if (!ui) return;
        var g = lvl.game;
        if (ui.w !== g.width || ui.h !== g.height) layoutBattle(lvl);

        var p = lvl.player;
        if (p && ui.slots.length) {
            var cur = -1;
            for (var i = 0; i < ui.slots.length; i++) {
                var id = ui.slots[i].__id;
                var idx = M.arsenal && M.arsenal.indexOf ? M.arsenal.indexOf(id) : -1;
                if (idx >= 0 && p.weaponIndex === idx) cur = i;
            }
            if (cur !== ui._cur) {
                ui._cur = cur;
                ui.slots.forEach(function (b, j) {
                    var owned = (M.data().weapons[b.__id] || {}).level >= 0;
                    var on = (j === cur);
                    b.gfx.alpha = on ? 1 : (owned ? .92 : .55);
                    b.label.alpha = b.gfx.alpha;
                });
            }
        }
        if (ui.panel && ui.panel.visible) {
            ui._t = (ui._t || 0) + (g.time.physicsElapsed || 0);
            if (ui._t >= .25) { ui._t = 0; refreshPanel(lvl); }
        }
    }

    function hitMine(lvl, id) {
        var ui = lvl.__at2ui;
        if (!ui) return false;
        for (var i = 0; i < ui.items.length; i++) {
            var it = ui.items[i];
            if (!it || !it.hit) continue;
            if (it.hit.visible === false) continue;
            if (it.hit.input && it.hit.input.pointerOver && it.hit.input.pointerOver(id)) return true;
        }
        return false;
    }

    /* Панель ещё и ставит бой на паузу: читать справку под обстрелом нельзя.
       Пауза своя, состояние уровня (gamePaused) — родное, поэтому танк
       останавливается, а клавиши мода (они проверяют gamePaused) не срабатывают. */
    function togglePanel(lvl) {
        var ui = lvl.__at2ui;
        if (!ui || !ui.panG) return;
        var on = !ui.panG.visible;
        ui.panG.visible = on;
        ui.panTitle.visible = on;
        ui.close.setVisible(on);
        if (ui.panRows) ui.panRows.forEach(function (t) { t.visible = on; });
        if (ui.panSecs) ui.panSecs.forEach(function (t) { t.visible = on; });
        if (on) {
            ui._wasPaused = !!lvl.gamePaused;
            lvl.gamePaused = true;
            refreshPanel(lvl);
        } else {
            lvl.gamePaused = !!ui._wasPaused;
            ui._wasPaused = false;
        }
    }

    /* Дополняет строку пробелами до нужной ширины (шрифт моноширинный). */
    function padTo(str, chars) {
        str = String(str == null ? "" : str);
        while (str.length < chars) str += " ";
        return str.slice(0, chars);
    }

    function refreshPanel(lvl) {
        var ui = lvl.__at2ui;
        if (!ui || !ui.panRows) return;
        var mods = (M.mods && M.mods.list()) || [];
        var ars = (M.arsenal && M.arsenal.list()) || [];

        var feed = {
            money: [padTo("ЯДРА \u25c8 " + cores(), 22), padTo("ДЕНЬГИ $ " + moneyFmt(money()), 22)],
            act: [], pas: [], gun: []
        };
        mods.forEach(function (m) {
            if (!m.owned) return;
            if (m.kind === "active") {
                var ready = !m.cooldown;
                var st = ready ? "ГОТОВ" : "КД " + m.cooldown + " С";
                feed.act.push({ text: padTo((m.key || "-") + " " + m.name, 22 - st.length) + st,
                                colour: ready ? T.white : T.dim });
            } else {
                feed.pas.push({ text: padTo(m.name, 22), colour: T.white });
            }
        });
        ars.forEach(function (a) {
            if (!a.owned) return;
            feed.gun.push({ text: padTo(a.key + " " + a.name, 22), colour: T.white });
        });

        var lines = [];
        PANEL_PLAN.rows.forEach(function (spec, i) {
            var t = ui.panRows[i];
            if (!t) return;
            if (spec.role === "money") { t.setText(feed.money[spec.slot], T.white); lines.push(feed.money[spec.slot]); return; }
            if (spec.role === "note") { t.setText(spec.text, T.dim); lines.push(spec.text); return; }
            var arr = feed[spec.sec] || [];
            var it = arr[spec.slot];
            if (it) { t.setText(it.text, it.colour); lines.push(it.text); }
            else { t.setText("", T.dim); }
        });
        PANEL_PLAN.secs.forEach(function (sec, i) {
            var t = ui.panSecs[i];
            if (t) t.setText(sec.text, T.gold);
            lines.push(sec.text);
        });
        ui.panT.setText(lines.join("\n"), T.white);
    }

    function dropBattle(lvl) {
        var layer = lvl.__at2layer;
        if (layer) { try { layer.destroy(true); } catch (e) { } }
        lvl.__at2layer = null;
        lvl.__at2ui = null;
    }

    function flash(lvl, str, color) {
        try {
            var g = lvl.game;
            var t = txt(g, 22, 52, str, 17, color || T.gold);
            lvl.__at2layer.add(t);
            var tw = g.add.tween(t.position).to({ y: 84 }, 900, Phaser.Easing.Cubic.Out, true);
            tw.onComplete.add(function () { try { t.destroy(); } catch (e) { } });
        } catch (e) { }
    }

    /* ============================== ПАК =============================== */

    M.registerPack({
        id: "at2-ui",
        name: "Awesome Tanks 2.0 — интерфейс",
        version: "4.1.0",
        onReady: function () {
            var done = false;
            var setup = function () {
                var g = window.AT && window.AT.game;
                if (!g || !g.state) return;
                if (!done) {
                    var there = false;
                    try { there = !!(g.state.checkState && g.state.checkState("AT2Hub")); } catch (e) { }
                    if (!there) {
                        try { g.state.add("AT2Hub", new Hub()); M.log("хаб 2.0 зарегистрирован"); }
                        catch (e) { M.warn("не удалось зарегистрировать хаб:", e); }
                    }
                    done = true;
                }
                hookMenus();
            };
            setup();
            if (M.keepTrying) M.keepTrying(setup, 90, 1000);
        }
    });

    M.on("levelCreate", function (lvl) {
        try { installBattle(lvl); } catch (e) { M.warn("бой-интерфейс 2.0:", e); }
    });

    M.ui = {
        hub: function () { try { window.AT.game.state.start("AT2Hub"); } catch (e) { M.warn("хаб:", e); } },
        panel: function () { var l = M.state(); if (l && l.__at2ui) togglePanel(l); },
        layout: function (l) { if (l && l.__at2ui) layoutBattle(l); }
    };
    M.Hub = Hub;
})();
