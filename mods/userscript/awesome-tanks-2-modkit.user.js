// ==UserScript==
// @name         Awesome Tanks 2 — Mod Kit (unofficial)
// @name:ru      Awesome Tanks 2 — мод-кит (неофициальный)
// @namespace    at2-modkit
// @version      2.0.0
// @description  Unofficial mod kit for Awesome Tanks 2: new levels, rebalance and console tools. Contains no game files — only own code and own level designs.
// @description:ru Неофициальный мод-кит для Awesome Tanks 2: новые уровни, ребаланс и консольные команды. Не содержит файлов игры — только свой код и свои карты.
// @author       you
// @license      MIT
// @homepageURL  https://example.invalid/at2-modkit
// @supportURL   https://example.invalid/at2-modkit/issues
// @run-at       document-start
// @grant        none
//
// @match        *://*.coolmathgames.com/*
// @match        *://*.coolmath.com/*
// @match        *://*.crazygames.com/*
// @match        *://*.gamemonetize.com/*
// @match        *://*.igroutka.ru/*
//
// Если игра открывается на другом домене — добавь свою строку @match
// (скрипт всё равно ничего не делает, пока не найдёт игру).
//
// ВАЖНО: это неофициальный мод, не связанный с Coolmath Games и автором игры
// (emittercritter). Игра и её материалы принадлежат правообладателям и здесь
// не распространяются: скрипт лишь достраивает поведение на стороне игрока.
// ===================================================================
// Что делает:
//   * перехватывает window.AT.SETTINGS / window.AT.LEVELS и применяет правки;
//   * добавляет три новые карты кампании и подкручивает баланс (свой контент);
//   * даёт консольные команды window.MOD (деньги, уровни, оружие, бессмертие).
// Настройки — в объекте CONFIG ниже.
// ===================================================================
(function () {
    "use strict";

    var CONFIG = {
        /* Правки контента (свои карты + баланс). Выключи, если нужна ванильная игра */
        contentPack: true,
        /* Подарки при старте */
        startMoney: 0,
        unlockLevels: 0,
        maxWeapons: false,
        maxUpgrades: false,
        godMode: false,
        difficulty: -1          // -1 = спросить в меню, 0/1/2 = легко/средне/сложно
    };

    /* ======================= ПЕРЕХВАТ WINDOW.AT ========================== */

    var ATref, settingsData = null, levelsData = null, hooked = false;

    function hookAt(target) {
        if (!target || hooked) return;
        hooked = true;
        Object.defineProperty(target, "SETTINGS", {
            configurable: true,
            get: function () { return settingsData; },
            set: function (v) { settingsData = v; patchSettings(v); }
        });
        Object.defineProperty(target, "LEVELS", {
            configurable: true,
            get: function () { return levelsData; },
            set: function (v) { levelsData = v; patchLevels(v); }
        });
    }

    // Реклама порталов: игра вызывает showBanner() как глобальную функцию
    try { window.showBanner = function () { }; } catch (e) { }

    // Ловим `var AT = {...}` со страницы игры
    try {
        Object.defineProperty(window, "AT", {
            configurable: true,
            get: function () { return ATref; },
            set: function (v) { ATref = v; hookAt(v); }
        });
    } catch (e) {
        // Если AT уже объявлен через var (страница успела раньше) — просто хукаем его
        if (window.AT) hookAt(window.AT);
    }

    /* ======================= СВОЙ КОНТЕНТ (ПАК) ========================== */

    function patchSettings(S) {
        if (!CONFIG.contentPack) return;
        S.PRICES.armor = [1000, 2000, 4000, 8000, 12000];
        S.PRICES.speed = [300, 400, 500, 600, 700];
        S.PRICES.turret = [300, 400, 500, 600, 700];
        S.PRICES.sight = [300, 400, 500, 600, 700];
        S.PRICES.shotgun = [1500, 400, 700, 1000, 1300, 1600];
        S.PRICES.ricochet = [5000, 1500, 2000, 2500, 3000, 3500];
        S.PRICES.rockets = [8000, 2000, 2500, 3000, 3500, 4000];
        S.AMMO_PRICES.shotgun = 25;
        S.AMMO_AMOUNT.shotgun = 42;
        S.AMMO_PRICES.rockets = 150;
        S.ACHIEVEMENTS_LIMITS.destroyer = 40;
        S.ACHIEVEMENTS_LIMITS.treasurer = 20;
    }

    function patchLevels(levels) {
        if (!CONFIG.contentPack) return;
        levels[0] = ["Полигон", "desert",
            "████████████████████",
            "█ ☻   ○       □    █",
            "█   ##     ░░      █",
            "█   ##  ▒▒▒▒   ○   █",
            "█         #        █",
            "█   1     #    2   █",
            "█         #        █",
            "█   ○     #   □    █",
            "█     ▒▒▒▒▒▒▒      █",
            "█                  █",
            "█   3        ○   4 █",
            "█      □           █",
            "████████████████████"];
        levels[1] = ["Ледяной лабиринт", "snow",
            "█████████████████████",
            "█ ☻   ░░░     ○     █",
            "█ ███ ░ ░ █████ ███ █",
            "█ █   ░ ░     █   █ █",
            "█ █ ▒▒▒▒▒▒▒▒▒ █ ▒ █ █",
            "█ █     1     █   █ █",
            "█ ████████ ███ ███ ██",
            "█     ○    █       ██",
            "█ ███ ████ █ █████ ██",
            "█   █    2   █   □ ██",
            "█ ▒ ████████ █ ███ ██",
            "█ ▒       □  █     ██",
            "█ ██████ ███ █ ██████",
            "█     3      █    ○ █",
            "█████████████████████"];
        levels[2] = ["Засада", "grass",
            "████████████████████████",
            "█ ☻          □         █",
            "█   ██████   ███████   █",
            "█   █    █   █     █   █",
            "█   █ ○  █   █  ○  █   █",
            "█   █    █   █     █   █",
            "█   █   █    █ █████   █",
            "█      ▒ █   █ ▒       █",
            "█ ▒▒▒▒▒▒ ███ █ ▒▒▒▒▒▒  █",
            "█                      █",
            "█   1     ▒▒▒▒▒▒▒▒  2  █",
            "█         ▒  ○  ▒      █",
            "█    ▒▒▒▒▒▒▒  □  ▒▒▒▒  █",
            "█                      █",
            "████████████████████████"];
    }

    /* ============================ API: MOD =============================== */

    var WEAPONS = ["minigun", "shotgun", "ricochet", "flamethrower", "cannon",
                   "shock", "rockets", "laser", "railgun", "mines"];
    var AMMO = ["shotgun", "ricochet", "flamethrower", "cannon", "shock",
                "rockets", "laser", "railgun", "mines"];

    function profile() { return window.AT && window.AT.profile ? window.AT.profile.current : null; }
    function state() { try { return window.AT.game.state.getCurrentState(); } catch (e) { return null; } }
    function save() { try { window.AT.profile.save(); } catch (e) { } }

    var MOD = window.MOD = {
        money: function (n) { var p = profile(); if (p) { p.game.money = n; save(); } },
        addMoney: function (n) { var p = profile(); if (p) { p.game.money += n; save(); } },
        unlockAll: function () { var p = profile(); if (p) { p.game.levels = 15; save(); } },
        setLevels: function (n) { var p = profile(); if (p) { p.game.levels = n; save(); } },
        setDifficulty: function (d) { var p = profile(); if (p) { p.game.difficulty = d; save(); } },
        refillAmmo: function () {
            var p = profile(); if (!p) return;
            var lim = (settingsData && settingsData.AMMO_LIMITS) || {};
            AMMO.forEach(function (w) { if (lim[w] != null) p.game[w + "Ammo"] = lim[w]; });
            save();
        },
        maxWeapons: function (lvl) {
            var p = profile(); if (!p) return;
            lvl = lvl == null ? 5 : Math.max(0, Math.min(5, lvl));
            WEAPONS.forEach(function (w) { p.game[w + "Level"] = lvl; });
            MOD.refillAmmo();
        },
        maxUpgrades: function () {
            var p = profile(); if (!p) return;
            ["speed", "turret", "sight", "armor"].forEach(function (k) { p.game[k] = 5; });
            save();
        },
        ammo: function (w, n) { var p = profile(); if (p && w) { p.game[w + "Ammo"] = n; save(); } },
        god: function (on) {
            if (MOD._t) { clearInterval(MOD._t); MOD._t = null; }
            if (on !== false) {
                MOD._t = setInterval(function () {
                    var s = state();
                    if (s && s.player) s.player.invincible = true;
                }, 250);
            } else {
                var s = state(); if (s && s.player) s.player.invincible = false;
            }
        },
        heal: function () { var s = state(); if (s && s.player) s.player.health = s.player.maxHealth; },
        killAll: function () {
            var s = state(); if (!s || !s.enemies) return;
            s.enemies.slice().forEach(function (e) { try { if (e && e.alive && e.kill) e.kill(); } catch (x) { } });
        },
        listLevels: function () {
            var l = levelsData || [];
            l.forEach(function (m, i) { console.log((i + 1) + ". " + m[0] + " [" + m[1] + "]"); });
            return l.length;
        },
        playLevel: function (n) {
            var g = window.AT.game; if (!g) return;
            if (g.state.checkState("Level" + n)) g.state.start("Level" + n);
            else console.log("нет уровня " + n);
        },
        profile: profile,
        state: state,
        settings: function () { return settingsData; },
        help: function () {
            console.log([
                "Awesome Tanks 2 — Mod Kit (unofficial)",
                "  MOD.money(n) / MOD.addMoney(n)",
                "  MOD.unlockAll() / MOD.setLevels(n) / MOD.setDifficulty(0|1|2)",
                "  MOD.maxWeapons(5) / MOD.maxUpgrades() / MOD.refillAmmo()",
                "  MOD.ammo('rockets', 45)",
                "  MOD.god(true|false) / MOD.heal() / MOD.killAll()",
                "  MOD.listLevels() / MOD.playLevel(34)",
                "  MOD.profile() / MOD.state()"
            ].join("\n"));
        }
    };

    /* ============================ АВТОСТАРТ ============================== */

    var tries = 0;
    var t = setInterval(function () {
        if (window.AT && window.AT.game && window.AT.profile && window.AT.profile.current) {
            clearInterval(t);
            if (CONFIG.difficulty >= 0) MOD.setDifficulty(CONFIG.difficulty);
            if (CONFIG.startMoney) MOD.money(CONFIG.startMoney);
            if (CONFIG.unlockLevels) MOD.setLevels(CONFIG.unlockLevels);
            if (CONFIG.maxWeapons) MOD.maxWeapons(5);
            if (CONFIG.maxUpgrades) MOD.maxUpgrades();
            if (CONFIG.godMode) MOD.god(true);
            console.log("[AT2 ModKit] активен. MOD.help() — команды.");
        } else if (++tries > 600) clearInterval(t);
    }, 100);
})();
