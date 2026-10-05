/*!
 * Awesome Tanks 2.0 — чит-меню (at2-cheats.js)
 * -----------------------------------------------------------------------------
 * Простое окно поверх игры (обычный HTML, а не спрайты Phaser — поэтому оно
 * не смешивается с графикой игры и всегда читается):
 *
 *   · Бессмертие — вкл/выкл;
 *   · Деньги — точное число;
 *   · Ядра — точное число;
 *   · Скорость игрока — ползунок 0.2…5;
 *   · Скорость стрельбы — ползунок 0.1…10;
 *   · «Сбросить всё» и крестик у каждой строки.
 *
 * Открывается правым Shift, закрывается им же, Esc или кнопкой.
 * Пока окно открыто, игра ставится на паузу, а клавиатура игры отключается.
 * Значения хранятся в сохранении игры (раздел mod.cheats).
 *
 * Лицензия: MIT. Игровых файлов не содержит — только код.
 * ========================================================================== */
(function () {
    "use strict";

    var M = window.MOD;
    if (!M) { console.warn("[at2-cheats] нужен mod-loader.js"); return; }

    var VERSION = "2.0.5";
    var PREFIX = "at2-cheats";
    var FONT = "Gunplay, 'Trebuchet MS', Arial, sans-serif";

    var ROWS = [
        { key: "god",   kind: "bool", label: "\u0411\u0435\u0441\u0441\u043c\u0435\u0440\u0442\u0438\u0435" },
        { key: "money", kind: "int",  label: "\u0414\u0435\u043d\u044c\u0433\u0438",  step: 500, min: 0, max: 999999999 },
        { key: "cores", kind: "int",  label: "\u042f\u0434\u0440\u0430",    step: 10,  min: 0, max: 999999 },
        { key: "speed", kind: "mul",  label: "\u0421\u043a\u043e\u0440\u043e\u0441\u0442\u044c \u0438\u0433\u0440\u043e\u043a\u0430",   step: 0.1, min: 0.2, max: 5 },
        { key: "rate",  kind: "mul",  label: "\u0421\u043a\u043e\u0440\u043e\u0441\u0442\u044c \u0441\u0442\u0440\u0435\u043b\u044c\u0431\u044b", step: 0.1, min: 0.1, max: 10 }
    ];
    var DEFAULTS = { god: false, money: null, cores: null, speed: 1, rate: 1 };

    var isOpen = false;
    var root = null;             // корневой div
    var fieldEls = {};           // key -> { input, valueEl }
    var godTimer = null;
    var prevPaused = null;

    /* ============================== ДАННЫЕ ============================== */

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

    /* ======================= ПРИМЕНЕНИЕ ЧИТОВ =========================== */

    function applyGod() {
        var on = !!cheats().god;
        var s = M.state();
        if (s && s.player) s.player.invincible = on;
        if (godTimer) { clearInterval(godTimer); godTimer = null; }
        if (on) {
            /* Бессмертие: флаг invincible + «замок здоровья».
               Флаг закрывает попадания, но взрывы/огонь могут вычитать здоровье
               другим путём, поэтому пока бессмертие включено — возвращаем полное
               здоровье. Так урон действительно не проходит ни от чего. */
            godTimer = setInterval(function () {
                if (!cheats().god) { clearInterval(godTimer); godTimer = null; return; }
                var st = M.state();
                if (!st || !st.player) return;
                st.player.invincible = true;
                if (st.player.health < st.player.maxHealth) st.player.health = st.player.maxHealth;
            }, 150);
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

    /* Скорость игрока — через родную переменную moveSpeed: работает и на
       оригинальной физике, и с включённой механикой 2.0. Базовое значение
       запоминаем один раз, поэтому переключения уровня ничего не портят. */
    function applySpeed() {
        var mul = Number(cheats().speed) || 1;
        var s = M.state();
        var p = s && s.player;
        if (!p) return;
        if (p.__at2speedBase == null || !p.__at2speedBase) p.__at2speedBase = p.moveSpeed || 1;
        var base = p.__at2speedBase;
        if (mul === 1) {
            if (p.moveSpeed !== base) p.moveSpeed = base;
            return;
        }
        p.moveSpeed = base * mul;
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

    /* То же самое для щита из модификаторов: пока он активен, здоровье не должно
       падать — возвращаем его каждый кадр. */
    var shieldLock = null;
    function lockShield(on) {
        if (shieldLock) { clearInterval(shieldLock); shieldLock = null; }
        if (!on) return;
        shieldLock = setInterval(function () {
            var st = M.state();
            var p = st && st.player;
            if (!p || !p.__at2shield) { clearInterval(shieldLock); shieldLock = null; return; }
            p.invincible = true;
            if (p.health < p.maxHealth) p.health = p.maxHealth;
        }, 150);
    }
    M.lockShield = lockShield;

    function applyAll() {
        applyGod();
        applyMoney();
        applyCores();
        applyRate();
        applySpeed();
        syncFields();
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
        if (key === "speed") applySpeed();
        if (!silent) { syncFields(); M.emit("cheats", c); }
        return c[key];
    }

    function reset(key) {
        var c = cheats();
        if (key) {
            c[key] = DEFAULTS[key];
            M.save();
            if (key === "god") applyGod();
            if (key === "rate") applyRate();
        } else {
            Object.keys(DEFAULTS).forEach(function (k) { c[k] = DEFAULTS[k]; });
            M.save();
            applyGod();
            applyRate();
            syncFields();
        }
        syncFields();
        M.emit("cheats", cheats());
    }

    /* =============================== ОКНО =============================== */

    function css(el, obj) { Object.keys(obj).forEach(function (k) { el.style[k] = obj[k]; }); }

    function el(tag, style, text) {
        var e = document.createElement(tag);
        if (style) css(e, style);
        if (text != null) e.textContent = text;
        return e;
    }

    function build() {
        if (root) return;
        root = el("div", {
            position: "fixed", left: "0", top: "0", right: "0", bottom: "0",
            zIndex: "2147483000", display: "none",
            alignItems: "center", justifyContent: "center",
            /* фон непрозрачный: пока окно открыто, игры и её спрайтов не видно */
            background: "#07230f"
        });
        root.id = PREFIX;

        var card = el("div", {
            width: "380px", maxWidth: "92vw", boxSizing: "border-box",
            background: "#11662f", border: "3px solid #ffb600", borderRadius: "14px",
            padding: "16px 18px 18px", color: "#f2f7ee",
            fontFamily: FONT, boxShadow: "0 12px 40px rgba(0,0,0,.55)"
        });

        var head = el("div", { display: "flex", alignItems: "center", marginBottom: "2px" });
        head.appendChild(el("div", {
            flex: "1", fontSize: "21px", color: "#ffb600", letterSpacing: "1px"
        }, "\u0427\u0418\u0422-\u041c\u0415\u041d\u042e"));
        head.appendChild(el("div", { fontSize: "12px", color: "#a9c7a6", marginRight: "8px" },
            "\u043c\u043e\u0434 " + (window.AT2_VERSION || VERSION)));
        var closeX = el("button", {
            width: "30px", height: "30px", cursor: "pointer", borderRadius: "8px",
            border: "2px solid #ffb600", background: "#0a3d1c", color: "#ffb600",
            fontSize: "17px", lineHeight: "1", fontFamily: FONT
        }, "\u2715");
        closeX.title = "\u0417\u0430\u043a\u0440\u044b\u0442\u044c (Shift / Esc)";
        closeX.onclick = function () { close(); };
        head.appendChild(closeX);
        card.appendChild(head);
        card.appendChild(el("div", { fontSize: "12px", color: "#a9c7a6", marginBottom: "12px" },
            "\u043f\u0440\u0430\u0432\u044b\u0439 Shift \u2014 \u043e\u0442\u043a\u0440\u044b\u0442\u044c / \u0437\u0430\u043a\u0440\u044b\u0442\u044c"));

        ROWS.forEach(function (row) {
            card.appendChild(rowEl(row));
        });

        var foot = el("div", { display: "flex", gap: "10px", marginTop: "14px" });
        var resetAll = el("button", {
            flex: "1", padding: "10px", cursor: "pointer", borderRadius: "9px",
            border: "2px solid #ffb600", background: "#0a3d1c", color: "#ffb600",
            fontSize: "15px", fontFamily: FONT
        }, "\u0421\u0431\u0440\u043e\u0441\u0438\u0442\u044c \u0432\u0441\u0451");
        resetAll.onclick = function () {
            reset();
            flash(resetAll, "\u0421\u0431\u0440\u043e\u0448\u0435\u043d\u043e");
        };
        var closeBtn = el("button", {
            flex: "1", padding: "10px", cursor: "pointer", borderRadius: "9px",
            border: "2px solid #179037", background: "#179037", color: "#07230f",
            fontSize: "15px", fontWeight: "bold", fontFamily: FONT
        }, "\u0417\u0430\u043a\u0440\u044b\u0442\u044c");
        closeBtn.onclick = function () { close(); };
        foot.appendChild(resetAll);
        foot.appendChild(closeBtn);
        card.appendChild(foot);

        root.appendChild(card);
        document.body.appendChild(root);
        syncFields();
    }

    function rowEl(row) {
        var wrap = el("div", {
            marginTop: "10px", paddingTop: "9px", borderTop: "1px solid rgba(169,199,166,.25)"
        });

        var line = el("div", { display: "flex", alignItems: "center", gap: "8px" });
        line.appendChild(el("div", { flex: "1", fontSize: "15px" }, row.label));

        var resetX = el("button", {
            width: "24px", height: "24px", cursor: "pointer", borderRadius: "7px",
            border: "1px solid rgba(255,182,0,.6)", background: "transparent",
            color: "#a9c7a6", fontSize: "13px", lineHeight: "1", fontFamily: FONT
        }, "\u21ba");
        resetX.title = "\u0421\u0431\u0440\u043e\u0441\u0438\u0442\u044c \u044d\u0442\u043e \u0437\u043d\u0430\u0447\u0435\u043d\u0438\u0435";
        resetX.onclick = function () { reset(row.key); };
        line.appendChild(resetX);
        wrap.appendChild(line);

        if (row.kind === "bool") {
            var sw = el("label", {
                display: "flex", alignItems: "center", gap: "8px",
                marginTop: "7px", cursor: "pointer", fontSize: "14px"
            });
            var cb = el("input", {
                width: "18px", height: "18px", cursor: "pointer", accentColor: "#ffb600"
            });
            cb.type = "checkbox";
            cb.onchange = function () { setValue("god", cb.checked); };
            var swText = el("span", { color: "#a9c7a6" }, "\u0432\u044b\u043a\u043b");
            sw.appendChild(cb);
            sw.appendChild(swText);
            wrap.appendChild(sw);
            fieldEls[row.key] = { input: cb, valueEl: swText, row: row };
            return wrap;
        }

        var ctrls = el("div", { display: "flex", alignItems: "center", gap: "8px", marginTop: "7px" });

        if (row.kind === "int") {
            var minus = stepBtn("\u2212", function () { bump(row, -1); });
            var inp = el("input", {
                flex: "1", minWidth: "0", padding: "8px", borderRadius: "8px",
                border: "2px solid #179037", background: "#0a3d1c", color: "#ffb600",
                fontSize: "16px", textAlign: "center", fontFamily: FONT
            });
            inp.type = "number";
            inp.min = String(row.min); inp.max = String(row.max); inp.step = "1";
            inp.onchange = function () {
                var v = inp.value === "" ? 0 : inp.value;
                setValue(row.key, v);
                if (row.key === "money") M.toast && M.toast("\u0414\u0435\u043d\u044c\u0433\u0438: $" + M.money(), "#ffb600");
                else M.toast && M.toast("\u042f\u0434\u0440\u0430: " + M.cores(), "#ffb600");
            };
            var plus = stepBtn("+", function () { bump(row, 1); });
            ctrls.appendChild(minus);
            ctrls.appendChild(inp);
            ctrls.appendChild(plus);
            fieldEls[row.key] = { input: inp, row: row };
        } else {
            var rng = el("input", { flex: "1", minWidth: "0", cursor: "pointer", accentColor: "#ffb600" });
            rng.type = "range";
            rng.min = String(row.min); rng.max = String(row.max); rng.step = String(row.step);
            var valEl = el("div", {
                width: "52px", textAlign: "right", color: "#ffb600", fontSize: "18px"
            }, "x1");
            rng.oninput = function () { setValue(row.key, rng.value); };
            ctrls.appendChild(rng);
            ctrls.appendChild(valEl);
            fieldEls[row.key] = { input: rng, valueEl: valEl, row: row };
        }

        wrap.appendChild(ctrls);
        return wrap;
    }

    function stepBtn(text, cb) {
        var b = el("button", {
            width: "34px", height: "34px", cursor: "pointer", borderRadius: "9px",
            border: "2px solid #179037", background: "#0a3d1c", color: "#ffb600",
            fontSize: "19px", lineHeight: "1", fontFamily: FONT
        }, text);
        b.onclick = cb;
        return b;
    }

    function bump(row, sign) {
        var cur = cheats()[row.key];
        if (cur == null) {
            cur = (row.key === "money") ? M.money()
                : (row.key === "cores") ? M.cores()
                    : (DEFAULTS[row.key] || 0);
        }
        setValue(row.key, Number(cur) + sign * row.step);
    }

    function flash(btn, text) {
        if (!btn) return;
        var old = btn.textContent;
        btn.textContent = text;
        setTimeout(function () { if (btn) btn.textContent = old; }, 900);
    }

    /* подтянуть значения в поля (после сброса/правок извне) */
    function syncFields() {
        if (!root) return;
        var c = cheats();
        ROWS.forEach(function (row) {
            var f = fieldEls[row.key];
            if (!f || !f.input) return;
            if (row.kind === "bool") {
                f.input.checked = !!c[row.key];
                if (f.valueEl) f.valueEl.textContent = c[row.key]
                    ? "\u0432\u043a\u043b" : "\u0432\u044b\u043a\u043b";
                return;
            }
            if (row.kind === "int") {
                var v = c[row.key];
                if (v == null) v = (row.key === "money") ? M.money() : M.cores();
                if (document.activeElement !== f.input) f.input.value = String(v);
                return;
            }
            var mv = Number(c[row.key]);
            if (!isFinite(mv)) mv = DEFAULTS[row.key];
            f.input.value = String(mv);
            if (f.valueEl) f.valueEl.textContent = "x" + (Math.round(mv * 100) / 100);
        });
    }

    /* ====================== ПАУЗА И КЛАВИАТУРА ========================== */

    function game() { return window.AT && window.AT.game; }

    var prevInputEnabled = null;

    function blockGameInput(on) {
        var g = game();
        if (!g) return;
        try {
            if (g.input && g.input.keyboard) {
                g.input.keyboard.enabled = !on;
                if (g.input.keyboard._keys) {
                    g.input.keyboard._keys.forEach(function (k) { if (k && k.reset) k.reset(); });
                }
            }
            /* главное: пока окно открыто, игра не должна получать клики —
               иначе нажатие «применить/бессмертие» проваливается в меню игры,
               и она открывает свои экраны (все спрайты) */
            if (g.input) {
                if (on) {
                    if (prevInputEnabled == null) prevInputEnabled = g.input.enabled !== false;
                    g.input.enabled = false;
                } else {
                    g.input.enabled = (prevInputEnabled === null) ? true : prevInputEnabled;
                    prevInputEnabled = null;
                }
            }
        } catch (e) { }
        try {
            if (on) {
                prevPaused = (prevPaused == null) ? !!g.paused : prevPaused;
                g.paused = true;
            } else {
                g.paused = prevPaused === true;
                prevPaused = null;
            }
        } catch (e) { }
    }

    /* ============================ ОТКРЫТИЕ ============================= */

    function open() {
        if (isOpen) return;
        build();
        isOpen = true;
        root.style.display = "flex";
        blockGameInput(true);
        syncFields();
        M.emit("cheatsOpen", cheats());
    }

    function close() {
        if (!isOpen) return;
        isOpen = false;
        if (root) root.style.display = "none";
        blockGameInput(false);
        M.emit("cheatsClose", null);
    }

    function toggle() { if (isOpen) close(); else open(); }

    /* правый Shift (code ShiftRight или keyCode 16 + location 2) — в фазе
       перехвата, чтобы игра не успела обработать нажатие */
    window.addEventListener("keydown", function (e) {
        var isRightShift = (e.code === "ShiftRight") || (e.keyCode === 16 && e.location === 2);
        if (isRightShift) {
            e.preventDefault();
            e.stopPropagation();
            toggle();
            return;
        }
        if (e.key === "Escape" && isOpen) {
            e.preventDefault();
            e.stopPropagation();
            close();
        }
    }, true);

    /* клики по окну не должны попадать в игру */
    function swallow(e) {
        if (isOpen && root && (e.target === root || root.contains(e.target))) {
            e.stopPropagation();
            e.stopImmediatePropagation && e.stopImmediatePropagation();
        }
    }
    ["mousedown", "mouseup", "click", "dblclick", "contextmenu", "wheel", "touchstart", "touchend"].forEach(function (t) {
        window.addEventListener(t, swallow, true);
    });

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

    /* следим за уровнем: скорость и темп огня переживают рестарт карты */
    var watch = setInterval(function () {
        try { applySpeed(); } catch (e) { }
    }, 500);

    M.on("levelCreate", function () {
        applyGod();
        applyRate();
        applySpeed();
        lockShield(true);      /* если щит ещё активен после перезапуска карты */
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
        isGod: function () { return !!cheats().god; },
        rows: function () { return ROWS.slice(); }
    };

    M.registerPack({
        id: "at2-cheats",
        name: "Awesome Tanks 2.0 — чит-меню",
        version: VERSION,
        onReady: function () {
            applyGod();
            applyRate();
            window.AT2_VERSION = VERSION;
            M.log("чит-меню готово: правый Shift (мод " + VERSION + ")");
        }
    });
})();
