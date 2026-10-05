#!/usr/bin/env node
/*!
 * Тесты мод-кита для Awesome Tanks 2.
 *
 * Проверяют, что ядро (mods/mod-loader.js) и пак (mods/packs/demo-pack.js)
 * работают в браузерной среде: перехват window.AT, применение правок к
 * AT.SETTINGS и AT.LEVELS, автоподарки, команды MOD.* и заглушка рекламы.
 *
 * Запуск (нужен jsdom):
 *     npm i jsdom && node tools/test-modkit.js
 * ========================================================================== */
"use strict";

const fs = require("fs");
const path = require("path");

let JSDOM;
try { JSDOM = require("jsdom").JSDOM; }
catch (e) {
    console.error("Нужен jsdom:  npm i jsdom");
    process.exit(1);
}

const ROOT = path.resolve(__dirname, "..");
const LOADER = path.join(ROOT, "mods", "mod-loader.js");
const PACK = path.join(ROOT, "mods", "packs", "demo-pack.js");

let passed = 0, failed = 0;
function ok(name, cond, extra) {
    if (cond) { passed++; console.log("  ✓ " + name); }
    else { failed++; console.log("  ✗ " + name + (extra ? "  → " + extra : "")); }
}
function section(t) { console.log("\n" + t); }

/* ---- окружение: пустая страница, как будто мод подключён первым ---- */
const dom = new JSDOM("<!doctype html><html><head></head><body></body></html>", {
    runScripts: "outside-only",
    url: "http://localhost:8080/",
    pretendToBeVisual: true
});
const win = dom.window;

function run(file) { win.eval(fs.readFileSync(file, "utf8")); }

section("1. Ядро подключается до игры (document-start / userscript)");
run(LOADER);
ok("window.MOD создан", typeof win.MOD === "object");
ok("версия кита известна", typeof win.MOD.version === "string", win.MOD.version);
ok("window.AT ещё не существует (перехват сработает позже)", typeof win.AT === "undefined");
ok("заглушка рекламы поставлена", typeof win.showBanner === "function");

section("2. Страница игры создаёт AT, пак регистрируется");
run(PACK);
ok("пак попал в реестр", (win.MOD.packs() || []).some(p => p.id === "demo-pack"),
    JSON.stringify(win.MOD.packs().map(p => p.id)));

// аналог строки `var AT = { SITE_LOCK_TARGET: '...' }` со страницы игры
win.eval("var AT = { SITE_LOCK_TARGET: '' };");
ok("AT подхвачен, объект на месте", win.AT && win.AT.SITE_LOCK_TARGET === "");

section("3. Игра публикует SETTINGS — пак правит баланс");
const realSettings = {
    ACHIEVEMENTS_LIMITS: { hunter: 15, destroyer: 80, dodger: 15, treasurer: 35, ultracombo: 1, gotcha: 15, fired: 15, nailed: 1, survivor: 1 },
    AMMO_LIMITS: { shotgun: 105, ricochet: 50, flamethrower: 236, cannon: 105, shock: 1500, rockets: 45, laser: 1500, railgun: 105, mines: 20 },
    PRICES: {
        speed: [500, 600, 700, 800, 900], turret: [500, 600, 700, 800, 900], sight: [500, 600, 700, 800, 900],
        armor: [2e3, 4e3, 8e3, 16e3, 2e4], minigun: [0, 200, 300, 400, 500, 600],
        shotgun: [2750, 500, 900, 1300, 1700, 2100], ricochet: [8e3, 2500, 3e3, 3500, 4e3, 4500]
    },
    AMMO_PRICES: { shotgun: 50, ricochet: 100 },
    AMMO_AMOUNT: { shotgun: 21, ricochet: 10 }
};
win.AT.SETTINGS = JSON.parse(JSON.stringify(realSettings));
const S = win.MOD.settings();
ok("ядро отдаёт тот же объект, что и игра", S === win.AT.SETTINGS);
ok("цена брони изменена паком", S.PRICES.armor[0] === 1000, JSON.stringify(S.PRICES.armor));
ok("цена скорости изменена", S.PRICES.speed[0] === 300);
ok("патроны дробовика: 42 в порции", S.AMMO_AMOUNT.shotgun === 42);
ok("достижение destroyer ослаблено до 40", S.ACHIEVEMENTS_LIMITS.destroyer === 40);
ok("лимиты патронов не задеты", S.AMMO_LIMITS.shotgun === 105);

section("4. Игра публикует LEVELS — пак подменяет карты");
const realLevels = [["Level 1", "grass", "███", "█ █", "███"], ["Level 2", "snow", "███", "█ █", "███"]];
for (let i = 2; i < 42; i++) realLevels.push(["Level " + (i + 1), "grass", "███", "█ █", "███"]);
win.AT.LEVELS = JSON.parse(JSON.stringify(realLevels));
const L = win.MOD.levels();
ok("карт осталось 42", L.length === 42, String(L.length));
ok("уровень 1 заменён", L[0][0] === "Полигон", L[0][0]);
ok("уровень 2 заменён", L[1][0] === "Ледяной лабиринт", L[1][0]);
ok("уровень 3 заменён", L[2][0] === "Засада", L[2][0]);
ok("уровень 4 не тронут", L[3][0] === "Level 4");
ok("террейн у новой карты задан", ["grass", "snow", "desert"].includes(L[1][1]), L[1][1]);

// структурная проверка всех трёх своих карт
section("5. Свои карты корректны (рамка, старт, враги, длины)");
const ENEMIES = "1234567mcrlsfxtSRLTFCX❶❷❸❹❺❻❼❽❾";
[0, 1, 2].forEach(i => {
    const rows = L[i].slice(2);
    const w = rows[0].length;
    const sameLen = rows.every(r => r.length === w);
    const framed = rows[0].split("").every(c => c === "█") &&
                   rows[rows.length - 1].split("").every(c => c === "█") &&
                   rows.every(r => r[0] === "█" && r[r.length - 1] === "█");
    const starts = rows.join("").split("☻").length - 1;
    const enemies = rows.join("").split("").filter(c => ENEMIES.includes(c)).length;
    ok(`«${L[i][0]}»: строки одной длины`, sameLen, w);
    ok(`«${L[i][0]}»: рамка из стен`, framed);
    ok(`«${L[i][0]}»: ровно один старт`, starts === 1, String(starts));
    ok(`«${L[i][0]}»: есть враги`, enemies > 0, String(enemies));
});

section("6. Автоподарки и готовность игры");
win.MOD.CONFIG.startMoney = 123456;
win.MOD.CONFIG.unlockLevels = 15;
win.MOD.CONFIG.maxUpgrades = true;
const saved = [];
win.AT.profile = {
    current: { game: { money: 0, levels: 0, speed: 0, turret: 0, sight: 0, armor: 0 } },
    save: () => saved.push(1),
    reset: () => { }
};
win.AT.game = { state: { getCurrentState: () => null, checkState: () => true, start: (s) => saved.push(s) } };

setTimeout(() => {
    ok("деньги из конфига применены", win.AT.profile.current.game.money === 123456, String(win.AT.profile.current.game.money));
    ok("уровни открыты", win.AT.profile.current.game.levels === 15);
    ok("апгрейды на максимум", win.AT.profile.current.game.armor === 5 && win.AT.profile.current.game.speed === 5);
    ok("сохранение вызывалось", saved.length > 0);

    section("7. Команды MOD");
    win.MOD.money(999);
    ok("MOD.money()", win.AT.profile.current.game.money === 999);
    win.MOD.addMoney(1);
    ok("MOD.addMoney()", win.AT.profile.current.game.money === 1000);
    win.MOD.maxWeapons(3);
    ok("MOD.maxWeapons() ставит уровни пушек", win.AT.profile.current.game.rocketsLevel === 3);
    ok("MOD.maxWeapons() заливает патроны", win.AT.profile.current.game.rocketsAmmo === 45,
        String(win.AT.profile.current.game.rocketsAmmo));
    win.MOD.ammo("laser", 777);
    ok("MOD.ammo()", win.AT.profile.current.game.laserAmmo === 777);
    ok("MOD.playLevel() дёргает состояние Phaser", win.MOD.playLevel(34) === true);
    ok("MOD.help() не падает", (win.MOD.help(), true));
    ok("MOD.listLevels() не падает", (win.MOD.listLevels(), true));

    console.log("\n──────────────");
    console.log(`Пройдено: ${passed}   Провалено: ${failed}`);
    process.exit(failed ? 1 : 0);
}, 400);
