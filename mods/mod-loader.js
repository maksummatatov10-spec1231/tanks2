/*!
 * Awesome Tanks 2.0 — Mod Kit / mod-loader v3
 * -----------------------------------------------------------------------------
 * Ядро мод-кита. Не содержит ни одного файла игры: только код, который
 * подключается к уже установленной у игрока копии.
 *
 * Подключение (перед <script src="awesome_tanks_2.js">):
 *     <script src="mods/mod-loader.js"></script>
 *     <script src="mods/packs/at2-core.js"></script>       <!-- геймплей 2.0 -->
 *     <script src="mods/packs/at2-campaign.js"></script>   <!-- 15 новых карт -->
 *     <script src="mods/packs/at2-weapons.js"></script>    <!-- новые пушки -->
 *     <script src="mods/packs/at2-modifiers.js"></script>  <!-- 20 модификаторов -->
 *     <script src="mods/packs/at2-ui.js"></script>         <!-- новый хаб-экран -->
 *     <script src="mods/packs/at2-cheats.js"></script>     <!-- чит-меню (правый Shift) -->
 *
 * Что даёт ядро:
 *   * перехват AT.SETTINGS / AT.LEVELS (правки применяются к настоящим данным);
 *   * реестры: оружие, модификаторы, экраны;
 *   * вторая валюта (ядра), хранилище в сохранении игры;
 *   * безопасные обёртки методов (MOD.wrap) и события (MOD.on/emit);
 *   * консольные команды MOD.* (см. MOD.help()).
 *
 * Лицензия: MIT (mods/LICENSE). Игра и её ассеты — собственность правообладателей.
 * ========================================================================== */
(function (global) {
    "use strict";

    var VERSION = "3.0.0";

    /* ============================== КОНФИГ =============================== */

    var CONFIG = {
        packs: [],             // пути к пакам для автозагрузки (необязательно)
        patchSettings: null,   // одиночный хук вместо пака
        patchLevels: null,
        blockAds: true,
        startMoney: 0,
        unlockLevels: 0,
        maxWeapons: false,
        maxUpgrades: false,
        godMode: false,
        difficulty: -1,
        debug: false           // подробный лог мода
    };

    /* ============================ БАЗА =================================== */

    function log() {
        var a = Array.prototype.slice.call(arguments);
        a.unshift("[at2]");
        try { console.log.apply(console, a); } catch (e) { }
    }
    function warn() {
        var a = Array.prototype.slice.call(arguments);
        a.unshift("[at2]");
        try { console.warn.apply(console, a); } catch (e) { }
    }
    function safe(fn, who, a, b, c, d) {
        try { return fn(a, b, c, d); }
        catch (e) { console.error("[at2] ошибка в " + who + ":", e); }
    }

    /* ===================== ПЕРЕХВАТ ДАННЫХ ИГРЫ ========================== */

    var settingsData = null, levelsData = null, packs = [], ready = false;

    function hookData(target) {
        if (!target || target.__at2Hooked) return target;
        try { Object.defineProperty(target, "__at2Hooked", { value: true }); } catch (e) { }

        Object.defineProperty(target, "SETTINGS", {
            configurable: true,
            get: function () { return settingsData; },
            set: function (v) {
                settingsData = v;
                if (typeof CONFIG.patchSettings === "function") safe(CONFIG.patchSettings, "CONFIG.patchSettings", v);
                packs.forEach(function (p) { if (p.patchSettings) safe(p.patchSettings, p.id, v); });
            }
        });

        Object.defineProperty(target, "LEVELS", {
            configurable: true,
            get: function () { return levelsData; },
            set: function (v) {
                levelsData = v;
                if (typeof CONFIG.patchLevels === "function") safe(CONFIG.patchLevels, "CONFIG.patchLevels", v);
                packs.forEach(function (p) { if (p.patchLevels) safe(p.patchLevels, p.id, v); });
            }
        });

        packs.forEach(function (p) {
            if (settingsData && p.patchSettings) safe(p.patchSettings, p.id, settingsData);
            if (levelsData && p.patchLevels) safe(p.patchLevels, p.id, levelsData);
        });
        return target;
    }

    var ATref = global.AT;
    if (global.AT) hookData(global.AT);
    else try {
        Object.defineProperty(global, "AT", {
            configurable: true,
            get: function () { return ATref; },
            set: function (v) { ATref = v; hookData(v); }
        });
    } catch (e) { warn("не удалось перехватить window.AT:", e); }

    function stubAds() {
        if (!CONFIG.blockAds) return;
        try { global.showBanner = function () { }; } catch (e) { }
    }
    stubAds();

    /* ========================= РЕГИСТРАЦИЯ ПАКОВ ========================= */

    function registerPack(pack) {
        if (!pack || !pack.id) { warn("у пака нет id, пропускаю"); return; }
        if (packs.some(function (p) { return p.id === pack.id; })) { log("пак " + pack.id + " уже подключён"); return; }
        packs.push(pack);
        if (settingsData && pack.patchSettings) safe(pack.patchSettings, pack.id, settingsData);
        if (levelsData && pack.patchLevels) safe(pack.patchLevels, pack.id, levelsData);
        if (ready && pack.onReady) safe(pack.onReady, pack.id, MOD);
        log("пак подключён: " + pack.id + (pack.version ? " v" + pack.version : ""));
        emit("pack", pack);
    }

    /* ========================= РЕЕСТРЫ КОНТЕНТА ========================== */

    var REG = { weapons: [], modifiers: [], screens: [] };

    function registerIn(list, def, kind) {
        if (!def || !def.id) { warn(kind + ": нет id"); return null; }
        var i = list.findIndex(function (x) { return x.id === def.id; });
        if (i >= 0) { list[i] = def; return def; }
        list.push(def);
        return def;
    }

    /* ========================= СОХРАНЕНИЕ МОДА =========================== */

    function profile() { return (global.AT && global.AT.profile) ? global.AT.profile.current : null; }
    function save() { try { global.AT.profile.save(); } catch (e) { } }

    var DEFAULT_MOD = {
        cores: 0,
        cheats: null,
        ownedModifiers: [],
        cleared: {},
        campaignCleared: 0,
        weapons: {},          // id -> { level, ammo }
        stats: { coresEarned: 0, modsUsed: 0, newLevels: 0 }
    };

    function modData() {
        var p = profile();
        if (!p) return JSON.parse(JSON.stringify(DEFAULT_MOD));
        if (!p.mod) p.mod = JSON.parse(JSON.stringify(DEFAULT_MOD));
        var d = p.mod;
        Object.keys(DEFAULT_MOD).forEach(function (k) { if (!(k in d)) d[k] = JSON.parse(JSON.stringify(DEFAULT_MOD[k])); });
        return d;
    }

    /* ============================ СЛУЖЕБНОЕ ============================== */

    var listeners = {};
    function on(evt, fn) { (listeners[evt] = listeners[evt] || []).push(fn); return fn; }
    function emit(evt, data) {
        (listeners[evt] || []).forEach(function (fn) { safe(fn, "listener:" + evt, data); });
    }

    /* Обёртка метода: MOD.wrap(AT.Level.prototype, "create", function (orig) { return function(){...} }) */
    function wrap(obj, method, fn) {
        if (!obj || typeof obj[method] !== "function") { warn("нет метода для обёртки: " + method); return false; }
        var orig = obj[method];
        var wrapper = fn(orig);
        if (typeof wrapper !== "function") { warn("обёртка " + method + " вернула не функцию"); return false; }
        wrapper.__at2orig = orig;
        obj[method] = wrapper;
        return true;
    }

    /* ============================ ПУБЛИЧНЫЙ API ========================== */

    var WEAPONS = ["minigun", "shotgun", "ricochet", "flamethrower", "cannon",
                   "shock", "rockets", "laser", "railgun", "mines"];
    var AMMO = ["shotgun", "ricochet", "flamethrower", "cannon", "shock",
                "rockets", "laser", "railgun", "mines"];

    var MOD = global.MOD = {
        version: VERSION,
        CONFIG: CONFIG,
        log: log,
        warn: warn,

        /* пакеты и реестры */
        registerPack: registerPack,
        packs: function () { return packs.slice(); },
        registerWeapon: function (d) { return registerIn(REG.weapons, d, "оружие"); },
        registerModifier: function (d) { return registerIn(REG.modifiers, d, "модификатор"); },
        registerScreen: function (d) { return registerIn(REG.screens, d, "экран"); },
        weapons: function () { return REG.weapons.slice(); },
        modifiers: function () { return REG.modifiers.slice(); },
        screens: function () { return REG.screens.slice(); },

        /* состояние */
        profile: profile,
        data: modData,
        save: save,
        state: function () { try { return global.AT.game.state.getCurrentState(); } catch (e) { return null; } },
        settings: function () { return settingsData; },
        levels: function () { return levelsData; },
        wrap: wrap,
        on: on,
        emit: emit,

        /**
         * Выполнять fn() сразу и потом ещё tries раз в секунду.
         * Нужно для патчей, которые зависят от объектов, появляющихся позже
         * (состояния уровней, профиль, меню). fn обязана быть идемпотентной.
         */
        keepTrying: function (fn, tries, everyMs) {
            if (typeof fn !== "function") return;
            var left = tries == null ? 90 : tries;
            safe(fn, "keepTrying");
            var t = setInterval(function () {
                left--;
                if (left <= 0) { clearInterval(t); return; }
                safe(fn, "keepTrying");
            }, everyMs || 1000);
            return t;
        },

        /* событийная шина и полезные ссылки */
        level: null,
        player: null
    };

    /* --- вторая валюта: ядра --- */
    MOD.cores = function () { var d = modData(); return d.cores || 0; };
    MOD.addCores = function (n) {
        var d = modData(); n = Math.max(0, Math.round(n || 0));
        d.cores += n; d.stats.coresEarned += n; save(); emit("cores", d.cores);
        return d.cores;
    };
    MOD.setCores = function (n) {
        var d = modData();
        d.cores = Math.max(0, Math.round(n || 0)); save(); emit("cores", d.cores);
        return d.cores;
    };
    MOD.spendCores = function (n) {
        var d = modData();
        if (d.cores < n) return false;
        d.cores -= n; save(); emit("cores", d.cores);
        return true;
    };

    /* --- модификаторы --- */
    MOD.owns = function (id) { return modData().ownedModifiers.indexOf(id) !== -1; };
    MOD.grantModifier = function (id) {
        var d = modData();
        if (d.ownedModifiers.indexOf(id) !== -1) return false;
        d.ownedModifiers.push(id); save(); emit("modifier", id);
        return true;
    };
    MOD.buyModifier = function (id) {
        var def = REG.modifiers.filter(function (m) { return m.id === id; })[0];
        if (!def) return { ok: false, reason: "нет такого модификатора" };
        if (MOD.owns(id)) return { ok: false, reason: "уже куплен" };
        if (!MOD.spendCores(def.price || 0)) return { ok: false, reason: "не хватает ядер" };
        MOD.grantModifier(id);
        log("куплен модификатор: " + def.name + " (" + (def.price || 0) + " ядер)");
        return { ok: true, def: def };
    };
    MOD.ownedModifierDefs = function () {
        return REG.modifiers.filter(function (m) { return MOD.owns(m.id); });
    };

    /* --- деньги игрока (ванильные) --- */
    MOD.money = function (n) {
        var p = profile(); if (!p) return 0;
        if (n == null) return p.game.money;
        p.game.money = n; save(); emit("money", n);
        return n;
    };
    MOD.balance = function () { return MOD.money(); };
    MOD.spendMoney = function (n) {
        var p = profile(); if (!p) return false;
        if (p.game.money < n) return false;
        p.game.money -= n; save(); emit("money", p.game.money);
        return true;
    };
    MOD.addMoney = function (n) { var p = profile(); if (p) { p.game.money += n; save(); emit("money", p.game.money); } };
    MOD.setLevels = function (n) { var p = profile(); if (p) { p.game.levels = n; save(); } };
    MOD.unlockAll = function () { MOD.setLevels(15); };
    MOD.setDifficulty = function (d) { var p = profile(); if (p) { p.game.difficulty = d; save(); } };
    MOD.points = function (lvl, v) { var p = profile(); if (p && lvl >= 1 && lvl <= 15) { p.game.points[lvl - 1] = v; save(); } };
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

    /* --- бой --- */
    MOD.god = function (on) {
        if (MOD._godTimer) { clearInterval(MOD._godTimer); MOD._godTimer = null; }
        if (on !== false) {
            MOD._godTimer = setInterval(function () {
                var s = MOD.state();
                if (s && s.player) s.player.invincible = true;
            }, 250);
        } else {
            var s = MOD.state();
            if (s && s.player) s.player.invincible = false;
        }
    };
    MOD.heal = function () { var s = MOD.state(); if (s && s.player) s.player.health = s.player.maxHealth; };
    MOD.killAll = function () {
        var s = MOD.state(); if (!s || !s.enemies) return;
        s.enemies.slice().forEach(function (e) { try { if (e && e.alive && e.kill) e.kill(); } catch (x) { } });
    };

    /* --- навигация --- */
    MOD.listLevels = function () {
        var l = levelsData || [];
        l.forEach(function (m, i) { log((i + 1) + ". " + m[0] + " [" + m[1] + "]"); });
        return l.length;
    };
    MOD.playLevel = function (n) {
        var g = global.AT.game; if (!g) return false;
        if (g.state.checkState("Level" + n)) { g.state.start("Level" + n); return true; }
        warn("нет уровня " + n); return false;
    };
    MOD.go = function (state) { if (global.AT.game) global.AT.game.state.start(state); };
    MOD.toMenu = function () { MOD.go("MenuUpgrades"); };
    MOD.toHub = function () { MOD.go("AT2Hub"); };
    MOD.reset = function () { try { global.AT.profile.reset(); } catch (e) { } global.location.reload(); };

    MOD.help = function () {
        log([
            "Awesome Tanks 2.0 — Mod Kit v" + VERSION,
            "  MOD.help()               — этот список",
            "  MOD.help2()              — контент мода (ядра, модификаторы, пушки)",
            "  MOD.money(n) / MOD.addMoney(n)",
            "  MOD.unlockAll() / MOD.setLevels(n) / MOD.setDifficulty(0|1|2)",
            "  MOD.maxWeapons(5) / MOD.maxUpgrades() / MOD.refillAmmo()",
            "  MOD.ammo('rockets', 45)",
            "  MOD.cores() / MOD.addCores(n)         — вторая валюта",
            "  MOD.grantModifier('noclip') / MOD.buyModifier('dash')",
            "  MOD.ownedModifierDefs()  — что куплено",
            "  MOD.god(true|false) / MOD.heal() / MOD.killAll()",
            "  MOD.cheats.toggle()      — чит-меню (правый Shift)",
            "  MOD.listLevels() / MOD.playLevel(16)  — 30 уровней (15 ванильных + 15 новых)",
            "  MOD.toHub() / MOD.toMenu()",
            "  MOD.reset()               — стереть сохранение"
        ].join("\n"));
    };

    MOD.help2 = function () {
        log("Модификаторы (" + REG.modifiers.length + "):");
        REG.modifiers.forEach(function (m) {
            log("  " + (MOD.owns(m.id) ? "[куплен] " : "[" + (m.price || 0) + " ядер] ") + m.name + " — " + m.desc);
        });
        log("Новое оружие (" + REG.weapons.length + "):");
        REG.weapons.forEach(function (w) { log("  " + w.name + " — " + (w.desc || "")); });
        log("Экраны: " + REG.screens.map(function (s) { return s.id; }).join(", "));
        log("Ядер: " + MOD.cores());
    };

    /* ===================== ЗАГРУЗКА ПАКОВ И СТАРТ ======================== */

    function injectPacks() {
        if (!CONFIG.packs || !CONFIG.packs.length || typeof document === "undefined") return;
        CONFIG.packs.forEach(function (url) {
            if (document.querySelector('script[data-modpack="' + url + '"]')) return;
            var s = document.createElement("script");
            s.src = url; s.setAttribute("data-modpack", url);
            s.onerror = function () { warn("не удалось загрузить пак: " + url); };
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
        packs.forEach(function (p) { if (p.onReady) safe(p.onReady, p.id, MOD); });
        emit("ready", MOD);
        log("готово. Паков: " + packs.length + ". MOD.help() — команды.");
    }

    var tries = 0;
    var wait = setInterval(function () {
        tries++;
        if (global.AT && global.AT.game && global.AT.profile && global.AT.profile.current) {
            clearInterval(wait); applyAuto();
        } else if (tries > 600) {
            clearInterval(wait); warn("игра так и не запустилась — автоправки не применены");
        }
    }, 100);
})(window);
