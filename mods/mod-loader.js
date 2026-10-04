/* =============================================================================
 *  Awesome Tanks 2 — mod loader
 * -----------------------------------------------------------------------------
 *  Подключать В index.html в этом порядке:
 *
 *      <script> var AT = { SITE_LOCK_TARGET: '' }; </script>
 *      <script src="mods/mod-loader.js"></script>     <-- здесь
 *      <script src="awesome_tanks_2.js"></script>
 *
 *  Зачем именно так: игра обращается к window.AT, который создаётся в HTML.
 *  Мы вешаем на этот объект перехватчики присваиваний AT.SETTINGS и AT.LEVELS,
 *  поэтому наши правки применяются к настоящим данным игры, а не к копии.
 *
 *  Настройки мода — в объекте CONFIG ниже. Готовые рецепты — в mods/README.md.
 *  Рантайм-команды: MOD.help()
 * ========================================================================== */
(function (global) {
    "use strict";

    if (!global.AT) {
        console.warn("[MOD] window.AT не найден: mod-loader.js должен идти после <script> с var AT = {...}");
        global.AT = {};
    }
    var AT = global.AT;

    /* ======================= ЧТО МЕНЯЕМ (КОНФИГ) ========================= */

    var CONFIG = {
        /* Функция(S) { ... } или null.
         * S — настоящий объект AT.SETTINGS с ценами и лимитами боеприпасов.
         * Пример: S.PRICES.armor = [200, 400, 800, 1600, 3200];            */
        patchSettings: null,

        /* Функция(levels) { ... } или null.
         * levels — массив window.AT.LEVELS: [ "Имя", "terrain", "строка", ... ]
         * Можно переписать существующие карты или добавить свои (см. README). */
        patchLevels: null,

        /* Заглушить рекламные врезки (window.showBanner) */
        blockAds: true,

        /* Автоматические подарки при загрузке игры (0 / false — выключено) */
        startMoney: 0,      // например 250000
        unlockLevels: 0,    // 15 = открыть все
        maxWeapons: false,  // true = все пушки 5-го уровня + полный боезапас
        maxUpgrades: false, // true = корпус/башня/обзор/скорость на максимум
        godMode: false,     // true = бессмертие (обновляется каждый уровень)
        difficulty: -1      // -1 = спросить, 0 = легко, 1 = средне, 2 = сложно
    };

    /* ==================== ПЕРЕХВАТ ДАННЫХ ИГРЫ =========================== */

    var _settings = null, _levels = null;

    Object.defineProperty(AT, "SETTINGS", {
        configurable: true,
        get: function () { return _settings; },
        set: function (v) {
            _settings = v;
            if (typeof CONFIG.patchSettings === "function") {
                try { CONFIG.patchSettings(v); } catch (e) { console.error("[MOD] patchSettings:", e); }
            }
        }
    });

    Object.defineProperty(AT, "LEVELS", {
        configurable: true,
        get: function () { return _levels; },
        set: function (v) {
            _levels = v;
            if (typeof CONFIG.patchLevels === "function") {
                try { CONFIG.patchLevels(v); } catch (e) { console.error("[MOD] patchLevels:", e); }
            }
        }
    });

    /* ========================= РАНТАЙМ-API =============================== */

    var MOD = global.MOD = { CONFIG: CONFIG };

    var WEAPONS = ["minigun", "shotgun", "ricochet", "flamethrower", "cannon",
                   "shock", "rockets", "laser", "railgun", "mines"];
    var AMMO = ["shotgun", "ricochet", "flamethrower", "cannon", "shock",
                "rockets", "laser", "railgun", "mines"];

    function profile() {
        return (global.AT && global.AT.profile) ? global.AT.profile.current : null;
    }
    function state() {
        try { return global.AT.game.state.getCurrentState(); } catch (e) { return null; }
    }
    function save() {
        try { global.AT.profile.save(); } catch (e) { }
    }

    MOD.profile = profile;   // MOD.profile().game.money  и т.п.
    MOD.state = state;       // текущее состояние Phaser (уровень/меню)
    MOD.settings = function () { return _settings; };

    /* --- деньги / прогресс ------------------------------------------------ */
    MOD.money = function (n) { var p = profile(); if (p) { p.game.money = n; save(); } };
    MOD.addMoney = function (n) { var p = profile(); if (p) { p.game.money += n; save(); } };
    MOD.setLevels = function (n) { var p = profile(); if (p) { p.game.levels = n; save(); } };
    MOD.unlockAll = function () { MOD.setLevels(15); };
    MOD.setDifficulty = function (d) { var p = profile(); if (p) { p.game.difficulty = d; save(); } };
    MOD.points = function (level, value) {           // рекорд по уровню (1..15)
        var p = profile(); if (p && level >= 1 && level <= 15) { p.game.points[level - 1] = value; save(); }
    };

    /* --- оружие ----------------------------------------------------------- */
    MOD.refillAmmo = function () {
        var p = profile(); if (!p) return;
        var lim = (_settings && _settings.AMMO_LIMITS) || {};
        AMMO.forEach(function (w) { if (lim[w] != null) p.game[w + "Ammo"] = lim[w]; });
        save();
    };
    MOD.maxWeapons = function (lvl) {
        var p = profile(); if (!p) return;
        lvl = (lvl == null) ? 5 : Math.max(0, Math.min(5, lvl));
        WEAPONS.forEach(function (w) { p.game[w + "Level"] = lvl; });
        MOD.refillAmmo();
    };
    MOD.maxUpgrades = function () {
        var p = profile(); if (!p) return;
        ["speed", "turret", "sight", "armor"].forEach(function (k) { p.game[k] = 5; });
        save();
    };
    MOD.ammo = function (w, n) {                     // MOD.ammo("rockets", 45)
        var p = profile(); if (p && w) { p.game[w + "Ammo"] = n; save(); }
    };

    /* --- во время боя ----------------------------------------------------- */
    MOD.god = function (on) {
        if (MOD._godTimer) { clearInterval(MOD._godTimer); MOD._godTimer = null; }
        var s = state();
        if (s && s.player) s.player.invincible = (on !== false);
        if (on !== false) {
            MOD._godTimer = setInterval(function () {
                var st = state();
                if (st && st.player) st.player.invincible = true;
            }, 250);
        }
    };
    MOD.heal = function () {
        var s = state();
        if (s && s.player) s.player.health = s.player.maxHealth;
    };
    MOD.killAll = function () {
        var s = state();
        if (!s || !s.enemies) return;
        s.enemies.slice().forEach(function (e) {
            try { if (e && e.alive && e.kill) e.kill(); } catch (err) { }
        });
    };
    MOD.teleportEnd = MOD.killAll;                   // удобный алиас

    /* --- сброс ------------------------------------------------------------ */
    MOD.reset = function () {
        try { global.AT.profile.reset(); } catch (e) { }
        global.location.reload();
    };

    MOD.help = function () {
        console.log([
            "MOD API (Awesome Tanks 2)",
            "  MOD.money(n)            — поставить деньги",
            "  MOD.addMoney(n)         — добавить денег",
            "  MOD.unlockAll()         — открыть все 15 уровней",
            "  MOD.setLevels(n)        — открыть n уровней",
            "  MOD.setDifficulty(0|1|2)— легко / средне / сложно",
            "  MOD.maxWeapons(5)       — все пушки на уровень n + патроны",
            "  MOD.maxUpgrades()       — корпус/башня/обзор/скорость на максимум",
            "  MOD.refillAmmo()        — полный боезапас",
            "  MOD.ammo('rockets', 45) — патроны конкретной пушки",
            "  MOD.god(true|false)     — бессмертие",
            "  MOD.heal()              — вылечить танк",
            "  MOD.killAll()           — добить всех врагов на уровне",
            "  MOD.profile()           — объект сохранения",
            "  MOD.state()             — текущее состояние Phaser",
            "  MOD.reset()             — стереть сохранение"
        ].join("\n"));
    };

    /* ===================== АВТОПРИМЕНЕНИЕ ПРИ СТАРТЕ ====================== */

    function applyAuto() {
        if (CONFIG.blockAds) {
            global.showBanner = function () { };   // реклама вызывается как глобальная функция
        }
        if (CONFIG.difficulty >= 0) MOD.setDifficulty(CONFIG.difficulty);
        if (CONFIG.startMoney) MOD.money(CONFIG.startMoney);
        if (CONFIG.unlockLevels) MOD.setLevels(CONFIG.unlockLevels);
        if (CONFIG.maxWeapons) MOD.maxWeapons(5);
        if (CONFIG.maxUpgrades) MOD.maxUpgrades();
        if (CONFIG.godMode) MOD.god(true);
        console.log("[MOD] загружен. MOD.help() — список команд.");
    }

    var tries = 0;
    var wait = setInterval(function () {
        tries++;
        if (global.AT && global.AT.game && global.AT.profile && global.AT.profile.current) {
            clearInterval(wait);
            applyAuto();
        } else if (tries > 300) {                      // ~30 секунд
            clearInterval(wait);
            console.warn("[MOD] игра так и не запустилась — автоправки не применены");
        }
    }, 100);
})(window);
