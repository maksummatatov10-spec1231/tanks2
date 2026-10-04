/*!
 * Awesome Tanks 2.0 — чит-меню (at2-cheats.js)
 * -----------------------------------------------------------------------------
 * Открывается правым Shift (или MOD.cheats.toggle()) в любом месте игры.
 *
 * Что можно:
 *   · Бессмертие — вкл/выкл;
 *   · Деньги и ядра — вписать точное число, кнопки «−/+», сброс каждого пункта;
 *   · Скорость игрока — множитель 0.2…5 (инерция 2.0 учитывает его сразу);
 *   · Скорость стрельбы — множитель 0.1…10;
 *   · «СБРОСИТЬ ВСЁ» — вернуть значения по умолчанию.
 *
 * Всё сохраняется в обычном сохранении игры (раздел mod.cheats), поэтому
 * держится между заходами. Панель собрана из родной графики игры
 * (alerts/overlay.png, alerts/abandon.png, кнопки yes/no/x, галочки on/off).
 *
 * Лицензия: MIT. Игровых файлов не содержит — только код.
 * ========================================================================== */
(function () {
    "use strict";

    var M = window.MOD;
    if (!M) { console.warn("[at2-cheats] нужен mod-loader.js"); return; }

    var VERSION = "1.0.0";

    var FONT = "Gunplay, Arial, Helvetica, sans-serif";
    var COL = { gold: "#ffb600", white: "#f2f7ee", dim: "#a9c7a6", ok: "#9be08f", bad: "#ff9f9f" };
    var N = { accent: 0xffb600, dim: 0x2f7a46, plate: 0x11662f, deep: 0x07230f };

    var ART = "menu/upgrades/parts.png";
    var BTN = "menu/upgrades/parts/buttons/";
    var OVERLAY = "game/alerts/overlay.png";
    var PANEL = "game/alerts/abandon.png";

    var ROWS = [
        { key: "god",   name: "\u0411\u0415\u0421\u0421\u041c\u0415\u0420\u0422\u0418\u0415", kind: "bool" },
        { key: "money", name: "\u0414\u0415\u041d\u042c\u0413\u0418", kind: "int", step: 500, min: 0, max: 999999999 },
        { key: "cores", name: "\u042f\u0414\u0420\u0410", kind: "int", step: 10, min: 0, max: 999999 },
        { key: "speed", name: "\u0421\u041a\u041e\u0420\u041e\u0421\u0422\u042c \u0418\u0413\u0420\u041e\u041a\u0410", kind: "mul", step: 0.1, min: 0.2, max: 5 },
        { key: "rate",  name: "\u0421\u041a\u041e\u0420\u041e\u0421\u0422\u042c \u0421\u0422\u0420\u0415\u041b\u042c\u0411\u042b", kind: "mul", step: 0.1, min: 0.1, max: 10 }
    ];
    var DEFAULTS = { god: false, money: null, cores: null, speed: 1, rate: 1 };

    var isOpen = false;
    var game = null, root = null, layer = null, panel = null, overlay = null;
    var valueLabels = {}, toggleIcons = {};
    var godTimer = null;
    var input = null;          // всплывающее поле ввода числа
    var stateSignal = null;

    /* ============================ ДАННЫЕ =============================== */

    function cheats() {
        var d = M.data();
        if (!d.cheats || typeof d.cheats !== "object") d.cheats = {};
        var c = d.cheats;
        Object.keys(DEFAULTS).forEach(function (k) { if (c[k] === undefined) c[k] = DEFAULTS[k]; });
        return c;
    }

    function clampRow(row, v) {
        v = Number(v);
        if (!isFinite(v)) return null;
        if (row.kind === "int") v = Math.round(v);
        else v = Math.round(v * 100) / 100;
        if (row.min != null) v = Math.max(row.min, v);
        if (row.max != null) v = Math.min(row.max, v);
        return v;
    }

    function setCores(n) {
        if (typeof M.setCores === "function") return M.setCores(n);
        var d = M.data();
        var delta = n - (d.cores || 0);
        if (delta > 0) M.addCores(delta);
        else if (delta < 0) M.spendCores(-delta);
        return M.cores();
    }

    /* ======================= ПРИМЕНЕНИЕ ЧИТОВ ========================== */

    function applyGod() {
        var on = !!cheats().god;
        var s = M.state();
        if (s && s.player) s.player.invincible = on;
        if (godTimer) { clearInterval(godTimer); godTimer = null; }
        if (on) {
            /* бессмертие должно переживать рестарт уровня и появление игрока */
            godTimer = setInterval(function () {
                if (!cheats().god) { clearInterval(godTimer); godTimer = null; return; }
                var st = M.state();
                if (st && st.player) st.player.invincible = true;
            }, 300);
        }
    }

    function applyRate() {
        var mul = Number(cheats().rate) || 1;
        var s = M.state();
        var p = s && s.player;
        if (!p || !p.weapons) return;
        p.weapons.forEach(function (w) {
            if (!w) return;
            if (w.__at2rateBase == null) w.__at2rateBase = w.rate;
            w.rate = w.__at2rateBase * mul;
        });
    }

    function applyMoney() {
        var v = cheats().money;
        if (v == null) return;
        M.money(Math.max(0, Math.round(v)));
    }

    function applyCores() {
        var v = cheats().cores;
        if (v == null) return;
        setCores(Math.max(0, Math.round(v)));
    }

    function applyAll() {
        applyGod();
        applyMoney();
        applyCores();
        applyRate();
        refresh();
    }

    function setValue(key, value, silent) {
        var row = ROWS.filter(function (r) { return r.key === key; })[0];
        if (!row) return;
        var c = cheats();
        c[key] = (row.kind === "bool") ? !!value : clampRow(row, value);
        M.save();
        if (key === "god") applyGod();
        if (key === "money") applyMoney();
        if (key === "cores") applyCores();
        if (key === "rate") applyRate();
        if (!silent) { refresh(); M.emit("cheats", c); }
        return c[key];
    }

    function reset(key) {
        if (key) {
            setValue(key, DEFAULTS[key], true);
            if (key === "speed") setValue("speed", DEFAULTS.speed, true);
            if (key === "money") { var c = cheats(); c.money = null; M.save(); }
            if (key === "cores") { var c2 = cheats(); c2.cores = null; M.save(); }
        } else {
            var c = cheats();
            Object.keys(DEFAULTS).forEach(function (k) { c[k] = DEFAULTS[k]; });
            M.save();
            applyGod();
            applyRate();
        }
        refresh();
        M.emit("cheats", cheats());
    }

    /* ============================== ВЁРСТКА ============================= */

    function txt(x, y, str, size, color) {
        var t = game.make.text(x, y, str);
        t.font = FONT;
        t.fontWeight = "400";
        t.fontSize = size || 14;
        t.fill = color || COL.white;
        t.stroke = "#0a2a12";
        t.strokeThickness = 3;
        return t;
    }

    function add(obj) { if (layer) layer.add(obj); return obj; }

    function artButton(x, y, base, cb, opt) {
        opt = opt || {};
        var b = null;
        try {
            b = game.make.button(x, y, ART, function () { cb(); }, null,
                base + "_hover.png", base + "_normal.png", base + "_down.png", base + "_normal.png");
        } catch (e) { b = null; }
        if (!b) return null;
        b.anchor.set(.5, .5);
        var sc = opt.scale == null ? .5 : opt.scale;
        b.scale.set(sc, sc);
        try {
            var au = window.AT && window.AT.audio;
            if (au && au.playButtonDown) b.onInputDown.add(au.playButtonDown);
            if (au && au.playButtonUp) b.onInputUp.add(au.playButtonUp);
        } catch (e) { }
        add(b);
        return b;
    }

    function smallButton(x, y, label, cb, color) {
        var g = game.make.sprite(x - 18, y - 16, ART, "menu/upgrades/parts/frame.png");
        g.anchor.set(0, 0);
        g.scale.set(36 / 93, 32 / 79);
        add(g);
        var t = txt(x, y - 10, label, 17, color || COL.gold);
        t.anchor.set(.5, 0);
        t.strokeThickness = 3;
        add(t);
        var hit = game.make.sprite(x - 18, y - 16, game.make.bitmapData(2, 2));
        hit.width = 36; hit.height = 32;
        hit.inputEnabled = true;
        hit.input.useHandCursor = true;
        hit.hitArea = new Phaser.Rectangle(0, 0, 36, 32);
        hit.events.onInputOver.add(function () { g.alpha = .75; });
        hit.events.onInputOut.add(function () { g.alpha = 1; });
        hit.events.onInputDown.add(cb);
        add(hit);
        return hit;
    }

    function valueText(row) {
        var c = cheats();
        var v = c[row.key];
        if (row.kind === "bool") return v ? "ВКЛ" : "ВЫКЛ";
        if (row.kind === "mul") return "x" + (Math.round(v * 100) / 100);
        if (v == null) return row.key === "money" ? "$ " + M.money() : "Я " + M.cores();
        return row.key === "money" ? "$ " + v : "Я " + v;
    }

    function refresh() {
        if (!layer) return;
        ROWS.forEach(function (row) {
            var t = valueLabels[row.key];
            if (t) {
                t.text = valueText(row);
                t.fill = (row.kind !== "bool" && cheats()[row.key] != null) ? COL.gold : COL.white;
            }
            if (row.kind === "bool") {
                var ic = toggleIcons[row.key];
                if (ic) ic.loadTexture(ART, BTN + (cheats()[row.key] ? "on.png" : "off.png"));
            }
        });
    }

    function openInput(row, x, y) {
        if (input) { closeInput(true); }
        var canvas = game.canvas;
        var rect = canvas.getBoundingClientRect();
        var scale = rect.width / game.width;
        input = document.createElement("input");
        input.type = "text";
        input.inputMode = "numeric";
        input.value = cheats()[row.key] == null ? "" : String(cheats()[row.key]);
        input.placeholder = row.kind === "mul" ? "1.0" : "0";
        input.style.cssText = "position:fixed;z-index:99999;width:" + Math.round(110 * scale) + "px;" +
            "height:" + Math.round(26 * scale) + "px;font:" + Math.round(16 * scale) + "px " + FONT + ";" +
            "color:#07230f;background:#ffb600;border:2px solid #0a2a12;border-radius:6px;" +
            "text-align:center;left:" + Math.round(rect.left + x * scale - 55 * scale) + "px;" +
            "top:" + Math.round(rect.top + y * scale - 13 * scale) + "px;";
        document.body.appendChild(input);
        input.focus();
        input.select();
        input.addEventListener("keydown", function (e) {
            if (e.key === "Enter") { submitInput(row); }
            else if (e.key === "Escape") { closeInput(false); }
            e.stopPropagation();
        });
        input.addEventListener("blur", function () { submitInput(row); });
    }

    function submitInput(row) {
        if (!input) return;
        var v = input.value.replace(/[^\d.,\-]/g, "").replace(",", ".");
        closeInput(false);
        if (v === "" || v === "-") { return; }
        setValue(row.key, v);
        M.toast && M.toast(row.name + ": " + valueText(row), COL.ok);
    }

    function closeInput(keep) {
        if (!input) return;
        var el = input;
        input = null;
        el.removeEventListener("blur", submitInput);
        if (el.parentNode) el.parentNode.removeChild(el);
    }

    /* ============================== ПАНЕЛЬ ============================= */

    function build() {
        destroy();
        game = window.AT && window.AT.game;
        if (!game || !game.add) return;

        var w = game.width, h = game.height;
        var scale = Math.max(.7, Math.min(w / 600, h / 600));

        root = game.add.group();
        root.fixedToCamera = false;
        root.scale.set(scale);
        root.position.set(w / 2 - 300 * scale, h / 2 - 300 * scale);
        try { game.stage.addChild(root); } catch (e) { }

        overlay = game.add.image(300, 300, "game.png", OVERLAY);
        overlay.anchor.set(.5, .5);
        overlay.scale.set(Math.max(3, 1400 / overlay.width), Math.max(3, 1400 / overlay.height));
        overlay.inputEnabled = true;      // перехватывает клики по сцене
        overlay.hitArea = new Phaser.Rectangle(0, 0, 1400, 1400);
        root.add(overlay);

        var PW = 320 * 1.6, PH = 252 * 1.6;
        var px = 300 - PW / 2, py = 300 - PH / 2;

        panel = game.add.image(300, 300, "game.png", PANEL);
        panel.anchor.set(.5, .5);
        panel.scale.set(1.6, 1.6);
        root.add(panel);

        layer = game.add.group();
        layer.position.set(px, py);
        root.add(layer);

        var cx = PW / 2;

        var title = txt(cx, 16, "\u0427\u0418\u0422-\u041c\u0415\u041d\u042e 2.0", 25, COL.gold);
        title.anchor.set(.5, 0);
        title.strokeThickness = 4;
        add(title);

        var hint = txt(cx, 50, "\u043f\u0440\u0430\u0432\u044b\u0439 Shift \u2014 \u0437\u0430\u043a\u0440\u044b\u0442\u044c", 12, COL.dim);
        hint.anchor.set(.5, 0);
        add(hint);

        var top = 92, step = 46;
        ROWS.forEach(function (row, i) {
            var y = top + i * step;

            add(txt(30, y - 9, row.name, 14, COL.white));

            if (row.kind === "bool") {
                var box = game.make.sprite(cx + 66, y - 1, ART, BTN + (cheats()[row.key] ? "on.png" : "off.png"));
                box.inputEnabled = true;
                box.input.useHandCursor = true;
                box.hitArea = new Phaser.Rectangle(-15, -15, 46, 46);
                box.events.onInputDown.add(function () { setValue("god", !cheats().god); });
                add(box);
                toggleIcons[row.key] = box;

                var lt = txt(cx + 6, y - 9, valueText(row), 15, COL.white);
                lt.anchor.set(.5, 0);
                valueLabels[row.key] = lt;
                add(lt);
                return;
            }

            var mv = function (sign) {
                var v = cheats()[row.key];
                if (v == null) v = (row.key === "money") ? M.money() : (row.key === "cores") ? M.cores() : DEFAULTS[row.key];
                setValue(row.key, Number(v) + sign * row.step);
            };
            smallButton(cx - 44, y, "\u2212", function () { mv(-1); });
            smallButton(cx, y, "+", function () { mv(1); });

            var vt = txt(cx + 78, y - 11, valueText(row), 17, COL.gold);
            vt.anchor.set(.5, 0);
            valueLabels[row.key] = vt;
            add(vt);

            var hit = game.make.sprite(cx + 78, y, game.make.bitmapData(2, 2));
            hit.anchor.set(.5, .5);
            hit.width = 92; hit.height = 28;
            hit.inputEnabled = true;
            hit.input.useHandCursor = true;
            hit.hitArea = new Phaser.Rectangle(0, 0, 92, 28);
            hit.events.onInputDown.add(function () { openInput(row, cx + 78 - 46, y); });
            add(hit);

            var x = game.make.button(cx + 148, y, ART, function () { reset(row.key); }, null,
                BTN + "x_hover.png", BTN + "x_normal.png", BTN + "x_normal.png", BTN + "x_hover.png");
            x.anchor.set(.5, .5);
            x.scale.set(.34, .34);
            add(x);
        });

        artButton(cx - 96, 340, BTN + "no", function () {
            reset();
            M.toast && M.toast("\u0427\u0438\u0442\u044b \u0441\u0431\u0440\u043e\u0448\u0435\u043d\u044b", COL.ok);
        }, { scale: .5 });

        artButton(cx + 96, 340, BTN + "yes", function () { close(); }, { scale: .5 });

        var foot = txt(cx, 368, "\u043a\u043b\u0438\u043a \u043f\u043e \u0447\u0438\u0441\u043b\u0443 \u2014 \u0432\u043f\u0438\u0448\u0438 \u0441\u0432\u043e\u0451 \u0438 Enter", 11, COL.dim);
        foot.anchor.set(.5, 0);
        add(foot);

        refresh();
    }

    function destroy() {
        closeInput(false);
        if (root) {
            try { if (root.parent) root.parent.removeChild(root); } catch (e) { }
            try { root.destroy(true); } catch (e) { }
        }
        root = null; layer = null; panel = null; overlay = null;
        valueLabels = {}; toggleIcons = {};
    }

    /* ====================== ВКЛЮЧЕНИЕ И ВЫКЛЮЧЕНИЕ ====================== */

    function blockGameKeys(on) {
        var g = window.AT && window.AT.game;
        if (!g || !g.input || !g.input.keyboard) return;
        try {
            g.input.keyboard.enabled = !on;
            if (g.input.keyboard._keys) {
                g.input.keyboard._keys.forEach(function (k) { if (k && k.reset) k.reset(); });
            }
        } catch (e) { }
    }

    function open() {
        if (isOpen) return;
        isOpen = true;
        build();
        blockGameKeys(true);
        if (stateSignal) stateSignal.detach(close);
        game = window.AT.game;
        stateSignal = game.state.onStateChange.add(close);
        M.emit("cheatsOpen", cheats());
    }

    function close() {
        if (!isOpen) return;
        isOpen = false;
        destroy();
        blockGameKeys(false);
        if (stateSignal) { try { stateSignal.detach(close); } catch (e) { } stateSignal = null; }
        M.emit("cheatsClose", null);
    }

    function toggle() { if (isOpen) close(); else open(); }

    /* правый Shift (keyCode 16 + location 2) — ловим в фазе перехвата,
       чтобы игра не успела обработать нажатие */
    window.addEventListener("keydown", function (e) {
        var isRightShift = (e.code === "ShiftRight") || (e.keyCode === 16 && e.location === 2);
        if (!isRightShift) return;
        e.preventDefault();
        e.stopPropagation();
        toggle();
    }, true);

    /* клики мышью не должны стрелять, пока открыто меню */
    M.on("ready", function () {
        var proto = window.AT && window.AT.Tank && window.AT.Tank.prototype;
        if (proto) {
            M.wrap(proto, "startFire", function (orig) {
                return function () {
                    if (isOpen) return;
                    return orig.apply(this, arguments);
                };
            });
        }
    });

    M.on("levelCreate", function () {
        applyGod();
        applyRate();
    });

    /* ============================== ЭКСПОРТ ============================= */

    M.cheats = {
        version: VERSION,
        get: cheats,
        set: setValue,
        reset: reset,
        apply: applyAll,
        speedMul: function () { return Math.max(0.05, Number(cheats().speed) || 1); },
        rateMul: function () { return Math.max(0.05, Number(cheats().rate) || 1); },
        open: open,
        close: close,
        toggle: toggle,
        isOpen: function () { return isOpen; },
        rows: function () { return ROWS.slice(); }
    };

    M.registerPack({
        id: "at2-cheats",
        name: "Awesome Tanks 2.0 — чит-меню",
        version: VERSION,
        onReady: function () {
            applyGod();
            applyRate();
            M.log("чит-меню готово: правый Shift");
        }
    });
})();
