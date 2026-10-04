/*!
 * Awesome Tanks 2.0 — ядро геймплея (at2-core.js)
 * -----------------------------------------------------------------------------
 * Что делает:
 *   1) ФИЗИКА 2.0 — инерция разгона/торможения вместо мгновенной смены скорости,
 *      мягкий отскок от стен, аккуратный тряс камеры.
 *   2) ВТОРАЯ ВАЛЮТА — «ядра» (◈): падают за убийства, боссов и зачистку уровня.
 *   3) ЭКОНОМИКА 2.0 — щедрее патронные наборы, дешевле первые уровни пушек.
 *   4) QoL — частичное пополнение боезапаса после уровня, автосохранение.
 *
 * Требует: mods/mod-loader.js. Игровых файлов не содержит.
 * Лицензия: MIT.
 * ========================================================================== */
(function () {
    "use strict";

    var M = window.MOD;
    if (!M) { console.warn("[at2-core] нужен mod-loader.js"); return; }

    var C = M.CONFIG;
    C.cores = {
        killChance: 0.12,      // шанс ядра с обычного врага
        perKill: 1,            // ядер с врага (если повезло)
        perBoss: 3,            // ядер с босса (гарантированно)
        clearFirst: 5,         // первая зачистка уровня
        clearRepeat: 1,        // повторная зачистка
        newLevelBonus: 2       // бонус за уровень из нового набора карт
    };
    C.physics = {
        enabled: true,
        accel: 0.13,           // с — «постоянная времени» разгона (меньше = резче)
        brake: 0.09,           // с — торможение
        restitution: 0.06,     // лёгкий отскок от стен
        shakeScale: 0.8,       // масштаб тряски камеры
        ammoRefill: 0.3        // доля боезапаса, возвращаемая после уровня
    };

    /* ============ 1. ДАННЫЕ: аккуратные правки баланса (свои числа) ======== */

    function patchSettings(S) {
        var A = S.AMMO_LIMITS, P = S.PRICES, AP = S.AMMO_PRICES, AA = S.AMMO_AMOUNT, AC = S.ACHIEVEMENTS_LIMITS;

        // Боезапас: +25 % к потолкам, наборы патронов крупнее на 50 %.
        Object.keys(A).forEach(function (k) { A[k] = Math.round(A[k] * 1.25); });
        Object.keys(AA).forEach(function (k) { AA[k] = Math.round(AA[k] * 1.5); });
        // Патроны чуть дешевле — меньше простоя между боями.
        Object.keys(AP).forEach(function (k) { AP[k] = Math.round(AP[k] * 0.85); });

        // Пушки: вход подешевел, вершины остались как «цель на весь забег».
        ["ricochet", "flamethrower", "cannon", "shock", "rockets", "laser", "railgun", "mines"].forEach(function (k) {
            if (P[k]) P[k][0] = Math.round(P[k][0] * 0.8);
        });
        ["minigun", "shotgun"].forEach(function (k) {
            if (P[k]) P[k] = P[k].map(function (v, i) { return i === 0 ? v : Math.round(v * 0.9); });
        });
        // Броня: первый уровень заметно дешевле.
        if (P.armor) { P.armor[0] = 1500; }

        // Ачивки чуть лояльнее — 2.0 не про гринд.
        if (AC) { AC.hunter = 12; AC.treasurer = 30; }
    }

    /* ================= 2. ФИЗИКА: инерция и мягкий отскок ================== */

    var physProto = null;
    var tickEvent = null, lastTick = 0;

    /* Инерция 2.0 — с гарантией, что танк вообще ездит.
     *
     * Ваниль ставит скорость мгновенно: Level.update зовёт move() ТОЛЬКО когда
     * нажата клавиша. Поэтому «проглотить» move и надеяться на свой хук нельзя:
     * Phaser кэширует функцию update состояния в момент старта
     * (StateManager.onUpdateCallback = states[key].update), и хук, поставленный
     * позже, уже не вызывается — танк просто встаёт.
     *
     * Поэтому: скорость ведёт таймер игры (game.time.events.loop), который живёт
     * независимо от состояний, а move() только запоминает направление. Если
     * таймер по какой-то причине не тикал дольше 250 мс (пауза, смена сцены,
     * что угодно) — move() пропускается как в оригинале, и танк едет мгновенно.
     * То есть движение не может сломаться в принципе.
     */
    function installMotion(proto) {
        if (!proto || physProto === proto || !C.physics.enabled) return;
        physProto = proto;

        M.wrap(proto, "move", function (orig) {
            return function (vx, vy) {
                if (!C.physics.enabled || this.name !== "player" || !this.body || !isFinite(this.moveSpeed)) {
                    return orig.call(this, vx, vy);
                }
                armTicker();
                if (Date.now() - lastTick > 250) {
                    /* страховка: наш таймер не работает — пусть двигает сама игра */
                    this._at2dir = null;
                    return orig.call(this, vx, vy);
                }
                this._at2dir = { x: vx || 0, y: vy || 0 };
                this._at2moveAt = Date.now();
            };
        });
    }

    function game() { return (window.AT && window.AT.game) || null; }

    /* Текущее состояние уровня: и по M.state(), и напрямую из Phaser. */
    function currentLevel() {
        var s = M.state();
        if (s && s.player) return s;
        var g = game();
        if (!g || !g.state) return null;
        var st = g.state.states && g.state.states[g.state.current];
        return (st && st.player) ? st : null;
    }

    function armTicker() {
        var g = game();
        if (!g || !g.time || !g.time.events) return;
        if (tickEvent) {
            /* событие могло быть снято при смене сцены — пробуем его убрать */
            try { g.time.events.remove(tickEvent); } catch (e) { }
            tickEvent = null;
        }
        try {
            tickEvent = g.time.events.loop(16, function () { tickMotion(); }, null);
        } catch (e) { tickEvent = null; }
    }

    function tickMotion() {
        lastTick = Date.now();
        var lvl = currentLevel();
        if (!lvl || lvl.gamePaused) return;
        try { at2Motion(lvl); } catch (e) { }
    }

    /* Кадр игрока: ведём скорость к цели (разгон) или к нулю (торможение). */
    function at2Motion(lvl) {
        var t = lvl && lvl.player;
        if (!t || !t.body || t.name !== "player" || !t.alive) return;

        var cfg = C.physics;
        if (!cfg.enabled) return;

        var b = t.body;
        var dt = Math.min((t.game && t.game.time && t.game.time.physicsElapsed) || 1 / 60, 1 / 30);

        /* ввод считаем свежим ~4 кадра: move() зовётся только при нажатой клавише */
        var fresh = (Date.now() - (t._at2moveAt || 0)) <= 80;
        var dir = (fresh && t._at2dir) ? t._at2dir : { x: 0, y: 0 };
        var moving = !!(dir.x || dir.y);

        var mul = (M.cheats && typeof M.cheats.speedMul === "function") ? M.cheats.speedMul() : 1;
        var speed = t.moveSpeed * mul;
        var tx = dir.x * speed, ty = dir.y * speed;

        var tau = moving ? cfg.accel : cfg.brake;
        var k = 1 - Math.exp(-dt / Math.max(tau, 0.02));
        b.velocity.x += (tx - b.velocity.x) * k;
        b.velocity.y += (ty - b.velocity.y) * k;

        if (!moving && Math.abs(b.velocity.x) < 2 && Math.abs(b.velocity.y) < 2) {
            b.velocity.x = 0; b.velocity.y = 0;
        }
        t._at2speed = Math.sqrt(b.velocity.x * b.velocity.x + b.velocity.y * b.velocity.y);
    }

    function tunePlayerBody(player) {
        if (!player || !player.body) return;
        try {
            // Лёгкая упругость: касание стены на скорости даёт короткий отскок.
            player.body.restitution = C.physics.restitution;
            // Мгновенный «стоп» ванильного демпфирования заменяем своим
            // торможением (cfg.brake), иначе инерция не читалась бы совсем.
            if (C.physics.enabled) player.body.linearDamping = 0;
            // Немного демпфирования по углу — корпус не «звенит» после рывков.
            player.body.angularDamping = 4;
        } catch (e) { M.warn("не удалось настроить тело игрока:", e); }
        installMotion(Object.getPrototypeOf(player));
    }

    /* ============ 3. СОБЫТИЯ УРОВНЯ + ЯДРА + ДОХОД ======================== */

    var patched = {};
    var BOSSES = ["EnemyBoss", "ShotgunBoss", "CannonBoss", "RocketsBoss", "LaserBoss",
                  "RicochetBoss", "RailgunBoss", "FlamethrowerBoss"];

    function isBoss(e) {
        if (!e) return false;
        for (var i = 0; i < BOSSES.length; i++) {
            var cls = window.AT && window.AT.tanks && window.AT.tanks[BOSSES[i]];
            if (cls && e instanceof cls) return true;
        }
        return false;
    }

    function levelKey(state) {
        // Номер уровня: 1..15 — ванильные, 16+ — новые карты 2.0
        var n = state.number;
        return n ? "L" + n : "L?";
    }

    function coresForKill(state, enemy) {
        var cfg = C.cores, diff = 1 + 0.25 * (state.difficultyIndex || 0);
        var n;
        if (isBoss(enemy)) n = cfg.perBoss * diff;
        else n = Math.random() < cfg.killChance ? cfg.perKill * diff : 0;
        if (n > 0 && M.owns && M.owns("scavenger")) n *= 1.25;   // модификатор «Собиратель»
        return n >= 1 ? Math.round(n) : (Math.random() < n ? 1 : 0);
    }

    function grantLevelCores(state) {
        var d = M.data(), cfg = C.cores, key = levelKey(state);
        var first = !d.cleared[key];
        var base = first ? (cfg.clearFirst + Math.floor((state.number || 1) / 3)) : cfg.clearRepeat;
        var n = base;
        if (state.number > 15 && first) n += cfg.newLevelBonus;   // бонус за новые карты
        if (M.owns && M.owns("scavenger")) n = Math.round(n * 1.25);
        d.cleared[key] = (d.cleared[key] || 0) + 1;
        M.addCores(n);
        M.save();
        return { cores: n, first: first };
    }

    function installLevelPatches() {
        var g = window.AT && window.AT.game;
        if (!g || !g.state || !g.state.states) return;
        Object.keys(g.state.states).forEach(function (key) {
            var st = g.state.states[key];
            if (!st || patched[key] || !/^Level\d+$/.test(key)) return;
            patched[key] = true;

            M.wrap(st, "create", function (orig) {
                return function () {
                    var r = orig.apply(this, arguments);
                    try {
                        M.level = this; M.player = this.player;
                        tunePlayerBody(this.player);
                        armTicker();
                        M.emit("levelCreate", this);
                    } catch (e) { M.warn("levelCreate:", e); }
                    return r;
                };
            });

            M.wrap(st, "enemyKilled", function (orig) {
                return function (enemy) {
                    var got = 0;
                    try {
                        got = coresForKill(this, enemy);
                        if (got > 0) M.addCores(got);
                        M.emit("enemyKilled", { level: this, enemy: enemy, cores: got });
                    } catch (e) { }
                    var r = orig.apply(this, arguments);
                    return r;
                };
            });

            M.wrap(st, "successContinue", function (orig) {
                return function () {
                    var info = null;
                    try { info = grantLevelCores(this); M.emit("levelComplete", { level: this, cores: info.cores, first: info.first }); }
                    catch (e) { }
                    return orig.apply(this, arguments);
                };
            });

            M.wrap(st, "failContinue", function (orig) {
                return function () {
                    try { M.emit("levelFailed", this); } catch (e) { }
                    return orig.apply(this, arguments);
                };
            });

            M.wrap(st, "shakeCamera", function (orig) {
                return function (amount) {
                    return orig.call(this, amount * C.physics.shakeScale);
                };
            });
        });
    }

    /* ==================== 4. QoL: боезапас после боя ====================== */

    function ammoRefillOnClear(level) {
        try {
            var player = level && level.player;
            if (!player || !player.weapons) return;
            var S = M.settings() || {};
            var lim = S.AMMO_LIMITS || {};
            var names = ["", "shotgun", "ricochet", "flamethrower", "cannon", "shock", "rockets", "laser", "railgun"];
            for (var i = 1; i < names.length; i++) {
                var w = player.weapons[i], n = names[i];
                if (!w || lim[n] == null) continue;
                var add = Math.round((lim[n] - w.ammo) * C.physics.ammoRefill);
                if (add > 0) w.ammo += add;
            }
            if (player.mines && lim.mines != null) {
                var am = Math.round((lim.mines - player.mines.ammo) * C.physics.ammoRefill);
                if (am > 0) player.mines.ammo += am;
            }
        } catch (e) { }
    }

    /* =============== 5. ЭКРАННЫЕ УВЕДОМЛЕНИЯ (в стиле игры) ============== */
    /* Обычный HTML-баннер поверх страницы: раньше он рисовался спрайтами
       Phaser, и любая ошибка с кадром атласа показывала вместо плашки весь
       атлас игры. Теперь рисовать нечего — баннер не может ничего сломать. */
    var toastEl = null, toastTimer = null;

    function banner(text, color) {
        try {
            if (typeof document === "undefined" || !document.body) return;
            if (!toastEl) {
                toastEl = document.createElement("div");
                toastEl.id = "at2-toast";
                toastEl.style.cssText = [
                    "position:fixed", "left:50%", "top:14px", "transform:translateX(-50%)",
                    "z-index:2147482000", "pointer-events:none", "max-width:80vw",
                    "padding:8px 18px", "border-radius:10px",
                    "background:#11662f", "border:2px solid #ffb600",
                    "color:#ffb600", "text-align:center",
                    "font:20px Gunplay, 'Trebuchet MS', Arial, sans-serif",
                    "text-shadow:0 2px 0 #07230f",
                    "box-shadow:0 6px 22px rgba(0,0,0,.45)",
                    "opacity:0", "transition:opacity .15s linear"
                ].join(";");
                document.body.appendChild(toastEl);
            }
            toastEl.textContent = text;
            toastEl.style.color = color || "#ffb600";
            toastEl.style.opacity = "1";
            if (toastTimer) clearTimeout(toastTimer);
            toastTimer = setTimeout(function () { if (toastEl) toastEl.style.opacity = "0"; }, 1500);
        } catch (e) { }
    }

    /* ============================ ПАК =================================== */

    M.toast = function (text, color) { banner(text, color); };
    M.notifyCores = function (n) { banner("\u25C8 +" + n, "#7CE7FF"); };

    M.registerPack({
        id: "at2-core",
        name: "Awesome Tanks 2.0 — ядро",
        version: "3.1.0",

        patchSettings: patchSettings,

        onReady: function () {
            /* состояния уровней могли появиться не сразу — повторяем, функция идемпотентна */
            if (M.keepTrying) M.keepTrying(installLevelPatches, 60);
            /* Phaser снимает все таймеры при смене состояния — заводим снова */
            try {
                var g = window.AT && window.AT.game;
                if (g && g.state && g.state.onStateChange) {
                    g.state.onStateChange.add(function () { lastTick = Date.now(); armTicker(); });
                }
            } catch (e) { }
            installLevelPatches();
            M.on("levelComplete", function (info) {
                if (info && info.level) ammoRefillOnClear(info.level);
                if (info && info.cores) M.notifyCores(info.cores);
            });
            M.log("ядро 2.0 активно: физика с инерцией, ядра как вторая валюта");
        }
    });
})();
