/*!
 * Awesome Tanks 2 — Mod Kit / mod-loader v2
 * -----------------------------------------------------------------------------
 * Ядро мод-кита. Не содержит ни одного файла игры: только код, который
 * подключается к уже установленной у игрока копии.
 *
 * Подключение (одна строка в index.html игры, перед <script src="awesome_tanks_2.js">):
 *     <script src="mods/mod-loader.js"></script>
 *
 * Что делает: перехватывает данные игры (window.AT.SETTINGS, window.AT.LEVELS)
 * и даёт пакам и консоли API (window.MOD) для правки баланса, карт и прогресса.
 *
 * Лицензия: MIT (см. mods/LICENSE). Игра и её ассеты — собственность
 * правообладателей и в этот кит не входят.
 * ========================================================================== */
(function (global) {
    "use strict";

    var VERSION = "2.0.0";

    /* ============================== КОНФИГ =============================== */

    var CONFIG = {
        /* Пакеты — файлы вида mods/packs/*.js. Можно перечислить путями: */
        packs: [],

        /* Старая совместимость: одиночные хуки вместо паков */
        patchSettings: null,   // function (S) { ... }
        patchLevels: null,     // function (levels) { ... }

        blockAds: true,        // заглушить window.showBanner (реклама порталов)
        startMoney: 0,         // подарок при старте: денег
        unlockLevels: 0,       // 15 = открыть все уровни
        maxWeapons: false,     // все пушки 5 ур. + полный боезапас
        maxUpgrades: false,    // корпус/башня/обзор/скорость на максимум
        godMode: false,        // бессмертие
        difficulty: -1         // -1 спросить, 0 легко, 1 средне, 2 сложно
    };

    /* ===================== ПЕРЕХВАТ ДАННЫХ ИГРЫ ========================== */

    var settingsData = null, levelsData = null;
    var packs = [];
    var ready = false;

    function log() {
        var a = ["[modkit]"].concat(Array.prototype.slice.call(arguments));
        try { console.log.apply(console, a); } catch (e) { }
    }

    function hookData(target) {
        if (!target || target.__modkitHooked) return target;
        try { Object.defineProperty(target, "__modkitHooked", { value: true }); } catch (e) { }

        Object.defineProperty(target, "SETTINGS", {
            configurable: true,
            get: function () { return settingsData; },
            set: function (v) {
                settingsData = v;
                if (typeof CONFIG.patchSettings === "function") safe(CONFIG.patchSettings, v, "CONFIG.patchSettings");
                for (var i = 0; i < packs.length; i++) if (packs[i].patchSettings) safe(packs[i].patchSettings, v, packs[i].id);
            }
        });

        Object.defineProperty(target, "LEVELS", {
            configurable: true,
            get: function () { return levelsData; },
            set: function (v) {
                levelsData = v;
                if (typeof CONFIG.patchLevels === "function") safe(CONFIG.patchLevels, v, "CONFIG.patchLevels");
                for (var i = 0; i < packs.length; i++) if (packs[i].patchLevels) safe(packs[i].patchLevels, v, packs[i].id);
            }
        });

        // Повторно применить паки, зарегистрированные до появления данных
        for (var i = 0; i < packs.length; i++) {
            if (settingsData && packs[i].patchSettings) safe(packs[i].patchSettings, settingsData, packs[i].id);
            if (levelsData && packs[i].patchLevels) safe(packs[i].patchLevels, levelsData, packs[i].id);
        }
        return target;
    }

    function safe(fn, arg, who) {
        try { fn(arg); } catch (e) { console.error("[modkit] ошибка в паке " + who + ":", e); }
    }

    /* Случай A: страница уже создала window.AT (обычная локальная сборка). */
    if (global.AT) hookData(global.AT);
    /* Случай B: мы загрузились раньше страницы (userscript / document-start).
     * Тогда вешаем аксессор на window.AT и ловим присваивание */
    else {
        try {
            Object.defineProperty(global, "AT", {
                configurable: true,
                get: function () { return ATref; },
                set: function (v) { ATref = v; hookData(v); }
            });
        } catch (e) { log("не удалось перехватить window.AT:", e); }
    }
    var ATref = global.AT;

    /* Заглушка рекламы порталов: игра вызывает showBanner() как глобальную функцию.
     * Ставим сразу при загрузке ядра и переустанавливаем при старте игры. */
    function stubAds() {
        if (!CONFIG.blockAds) return;
        try { global.showBanner = function () { }; } catch (e) { }
    }
    stubAds();

    /* ========================= РЕГИСТРАЦИЯ ПАКОВ ========================= */

    function registerPack(pack) {
        if (!pack || !pack.id) { console.warn("[modkit] у пака нет id, пропускаю"); return; }
        for (var i = 0; i < packs.length; i++) if (packs[i].id === pack.id) {
            log("пак " + pack.id + " уже зарегистрирован"); return;
        }
        packs.push(pack);
        if (settingsData && pack.patchSettings) safe(pack.patchSettings, settingsData, pack.id);
        if (levelsData && pack.patchLevels) safe(pack.patchLevels, levelsData, pack.id);
        if (ready && pack.onReady) safe(pack.onReady, MOD, pack.id);
        log("пак подключён: " + pack.id + (pack.version ? " v" + pack.version : ""));
    }

    /* ========================= РАНТАЙМ-API ============================== */

    var WEAPONS = ["minigun", "shotgun", "ricochet", "flamethrower", "cannon",
                   "shock", "rockets", "laser", "railgun", "mines"];
    var AMMO = ["shotgun", "ricochet", "flamethrower", "cannon", "shock",
                "rockets", "laser", "railgun", "mines"];

    function profile() { return (global.AT && global.AT.profile) ? global.AT.profile.current : null; }
    function state() { try { return global.AT.game.state.getCurrentState(); } catch (e) { return null; } }
    function save() { try { global.AT.profile.save(); } catch (e) { } }

    var MOD = global.MOD = {
        version: VERSION,
        CONFIG: CONFIG,
        registerPack: registerPack,
        packs: function () { return packs.slice(); },
        profile: profile,
        state: state,
        settings: function () { return settingsData; },
        levels: function () { return levelsData; }
    };

    /* --- прогресс и деньги --- */
    MOD.money = function (n) { var p = profile(); if (p) { p.game.money = n; save(); } };
    MOD.addMoney = function (n) { var p = profile(); if (p) { p.game.money += n; save(); } };
    MOD.setLevels = function (n) { var p = profile(); if (p) { p.game.levels = n; save(); } };
    MOD.unlockAll = function () { MOD.setLevels(15); };
    MOD.setDifficulty = function (d) { var p = profile(); if (p) { p.game.difficulty = d; save(); } };
    MOD.points = function (level, value) {
        var p = profile();
        if (p && level >= 1 && level <= 15) { p.game.points[level - 1] = value; save(); }
    };

    /* --- оружие и апгрейды --- */
    MOD.refillAmmo = function () {
        var p = profile(); if (!p) return;
        var lim = (settingsData && settingsData.AMMO_LIMITS) || {};
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
    MOD.ammo = function (w, n) { var p = profile(); if (p && w) { p.game[w + "Ammo"] = n; save(); } };

    /* --- во время боя --- */
    MOD.god = function (on) {
        if (MOD._godTimer) { clearInterval(MOD._godTimer); MOD._godTimer = null; }
        if (on !== false) {
            MOD._godTimer = setInterval(function () {
                var s = state();
                if (s && s.player) s.player.invincible = true;
            }, 250);
        } else {
            var s = state();
            if (s && s.player) s.player.invincible = false;
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

    /* --- уровни --- */
    MOD.listLevels = function () {
        var l = levelsData || [];
        for (var i = 0; i < l.length; i++) {
            var rows = l[i].length - 2, cols = String(l[i][2] || "").length;
            log((i + 1) + ". " + l[i][0] + "  [" + l[i][1] + "] " + cols + "x" + rows);
        }
        return l.length;
    };
    /* Прыгнуть на любой уровень, включая служебные карты 16+.
     * MOD.playLevel(34) — «Bosses: Shotgun», MOD.playLevel(1) — кампания. */
    MOD.playLevel = function (n) {
        var g = global.AT.game;
        if (!g) return log("игра ещё не запущена");
        if (g.state.checkState("Level" + n)) { g.state.start("Level" + n); return true; }
        log("нет уровня " + n + " (см. MOD.listLevels())");
        return false;
    };
    MOD.toMenu = function () { if (global.AT.game) global.AT.game.state.start("MenuUpgrades"); };

    /* --- сброс --- */
    MOD.reset = function () {
        try { global.AT.profile.reset(); } catch (e) { }
        global.location.reload();
    };

    MOD.help = function () {
        log([
            "Mod Kit v" + VERSION + " — команды (window.MOD)",
            "  MOD.help()                — этот список",
            "  MOD.money(n) / MOD.addMoney(n)",
            "  MOD.unlockAll()           — открыть все 15 уровней",
            "  MOD.setLevels(n)          — открыть n уровней",
            "  MOD.setDifficulty(0|1|2)  — легко / средне / сложно",
            "  MOD.maxWeapons(5)         — все пушки на уровень n + патроны",
            "  MOD.maxUpgrades()         — корпус/башня/обзор/скорость на максимум",
            "  MOD.refillAmmo()          — полный боезапас",
            "  MOD.ammo('rockets', 45)",
            "  MOD.god(true|false)       — бессмертие",
            "  MOD.heal() / MOD.killAll()",
            "  MOD.listLevels()          — список всех 42 карт",
            "  MOD.playLevel(34)         — прыгнуть на уровень",
            "  MOD.toMenu()              — вернуться в меню",
            "  MOD.profile()             — объект сохранения",
            "  MOD.packs()               — подключённые паки",
            "  MOD.reset()               — стереть сохранение"
        ].join("\n"));
    };

    /* ===================== ЗАГРУЗКА ПАКОВ И СТАРТ ======================== */

    function injectPacks() {
        if (!CONFIG.packs || !CONFIG.packs.length || typeof document === "undefined") return;
        CONFIG.packs.forEach(function (url) {
            if (document.querySelector('script[data-modpack="' + url + '"]')) return;
            var s = document.createElement("script");
            s.src = url;
            s.setAttribute("data-modpack", url);
            s.onerror = function () { console.warn("[modkit] не удалось загрузить пак: " + url); };
            (document.head || document.documentElement).appendChild(s);
        });
    }
    if (typeof document !== "undefined") {
        if (document.head) injectPacks();
        else document.addEventListener("DOMContentLoaded", injectPacks);
    }

    function applyAuto() {
        stubAds();
        if (CONFIG.difficulty >= 0) MOD.setDifficulty(CONFIG.difficulty);
        if (CONFIG.startMoney) MOD.money(CONFIG.startMoney);
        if (CONFIG.unlockLevels) MOD.setLevels(CONFIG.unlockLevels);
        if (CONFIG.maxWeapons) MOD.maxWeapons(5);
        if (CONFIG.maxUpgrades) MOD.maxUpgrades();
        if (CONFIG.godMode) MOD.god(true);
        ready = true;
        packs.forEach(function (p) { if (p.onReady) safe(p.onReady, MOD, p.id); });
        log("готово. MOD.help() — список команд. Паков: " + packs.length);
    }

    var tries = 0;
    var wait = setInterval(function () {
        tries++;
        if (global.AT && global.AT.game && global.AT.profile && global.AT.profile.current) {
            clearInterval(wait);
            applyAuto();
        } else if (tries > 300) {          // ~30 секунд
            clearInterval(wait);
            console.warn("[modkit] игра так и не запустилась — автоправки не применены");
        }
    }, 100);
})(window);
