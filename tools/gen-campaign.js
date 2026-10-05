#!/usr/bin/env node
/*!
 * Генератор кампании из 15 своих карт для Awesome Tanks 2.
 *
 * Карты строятся процедурно (детерминированно, по seed) в стилях:
 *   open      — открытая арена с укрытиями и колоннами
 *   rooms     — помещения со стенами и дверными проёмами
 *   maze      — лабиринт с расширенными проходами
 *   fortress  — центральная крепость с входами и внутренними комнатами
 *   arena     — просторная площадка для боссов
 *
 * Дальше расставляются декорации (кирпичи, дерево, бочки, ящики, ворота,
 * секретные стены), старт игрока и враги — с учётом прогрессии сложности.
 * Каждая карта проверяется валидатором (рамка, один старт, достижимость целей).
 *
 * Результат: tools/campaign-data.json — из него собираются пак и userscript.
 *
 * Запуск:  node tools/gen-campaign.js
 * ========================================================================== */
"use strict";

const fs = require("fs");
const path = require("path");
const { validateLevels, validateMap, ENEMY_CHARS } = require("./lib/validate-maps");

/* ============================== УТИЛИТЫ ============================== */

function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
        a |= 0; a = (a + 0x6D2B79F5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

const makeRnd = (rnd) => ({
    int: (n) => Math.floor(rnd() * n),
    between: (a, b) => a + Math.floor(rnd() * (b - a + 1)),
    pick: (arr) => arr[Math.floor(rnd() * arr.length)],
    chance: (p) => rnd() < p
});

const blank = (w, h) => Array.from({ length: h }, () => Array.from({ length: w }, () => " "));

function frame(g, w, h) {
    for (let x = 0; x < w; x++) { g[0][x] = "█"; g[h - 1][x] = "█"; }
    for (let y = 0; y < h; y++) { g[y][0] = "█"; g[y][w - 1] = "█"; }
    return g;
}

/* ============================== СТИЛИ ============================== */

function styleOpen(g, w, h, r) {
    const blocks = Math.max(6, Math.floor((w - 2) * (h - 2) / 55));
    for (let i = 0; i < blocks; i++) {
        const bw = r.between(2, 4), bh = r.between(2, 4);
        const x = r.between(2, w - bw - 2), y = r.between(2, h - bh - 2);
        for (let yy = y; yy < y + bh; yy++) for (let xx = x; xx < x + bw; xx++) g[yy][xx] = "█";
    }
}

function styleRooms(g, w, h, r) {
    // сетка комнат: горизонтальные и вертикальные стены с проёмами
    for (let y = r.between(4, 6); y < h - 2; y += r.between(4, 6)) {
        for (let x = 1; x < w - 1; x++) if (r.chance(0.82)) g[y][x] = "█";
        // проёмы
        const doors = r.between(2, 3);
        for (let d = 0; d < doors; d++) {
            const dx = r.between(2, w - 3), len = r.between(1, 3);
            for (let k = 0; k < len; k++) if (dx + k < w - 1) g[y][dx + k] = " ";
        }
    }
    for (let x = r.between(5, 8); x < w - 2; x += r.between(6, 9)) {
        for (let y = 1; y < h - 1; y++) if (r.chance(0.75)) g[y][x] = "█";
        const doors = r.between(2, 3);
        for (let d = 0; d < doors; d++) {
            const dy = r.between(2, h - 3), len = r.between(1, 3);
            for (let k = 0; k < len; k++) if (dy + k < h - 1) g[dy + k][x] = " ";
        }
    }
}

function styleMaze(g, w, h, r) {
    // классический лабиринт по нечётным клеткам, затем «разрежаем» стены
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) g[y][x] = "█";
    const stack = [[1, 1]];
    const visited = new Set(["1,1"]);
    g[1][1] = " ";
    const dirs = [[0, -2], [2, 0], [0, 2], [-2, 0]];
    while (stack.length) {
        const [x, y] = stack[stack.length - 1];
        const options = [];
        for (const [dx, dy] of dirs) {
            const nx = x + dx, ny = y + dy;
            if (nx > 0 && ny > 0 && nx < w - 1 && ny < h - 1 && !visited.has(nx + "," + ny)) options.push([nx, ny, dx, dy]);
        }
        if (!options.length) { stack.pop(); continue; }
        const [nx, ny, dx, dy] = r.pick(options);
        g[y + dy / 2][x + dx / 2] = " ";
        g[ny][nx] = " ";
        visited.add(nx + "," + ny);
        stack.push([nx, ny]);
    }
    // прореживание: убираем часть стен, чтобы карта не была «кишкой»
    for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
        if (g[y][x] === "█" && r.chance(0.30)) g[y][x] = " ";
    }
    // расширяем узкие места: где стена одна и рядом проходы — снимаем
    for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
        if (g[y][x] !== "█") continue;
        const hOpen = g[y][x - 1] !== "█" && g[y][x + 1] !== "█";
        const vOpen = g[y - 1][x] !== "█" && g[y + 1][x] !== "█";
        if ((hOpen || vOpen) && r.chance(0.5)) g[y][x] = " ";
    }
}

function styleFortress(g, w, h, r) {
    // 1) внешний рельеф (укрытия и колонны) — потом поверх него строим крепость,
    //    чтобы блоки не «прорастали» сквозь её стены
    styleOpen(g, w, h, r);

    // 2) центральная крепость с 4 входами
    const cw = Math.max(7, Math.floor(w * 0.5)), ch = Math.max(6, Math.floor(h * 0.5));
    const cx = Math.floor((w - cw) / 2), cy = Math.floor((h - ch) / 2);
    for (let y = cy; y < cy + ch; y++) for (let x = cx; x < cx + cw; x++) g[y][x] = " ";
    for (let y = cy; y < cy + ch; y++) for (let x = cx; x < cx + cw; x++) {
        const border = (y === cy || y === cy + ch - 1 || x === cx || x === cx + cw - 1);
        g[y][x] = border ? "█" : " ";
    }
    // входы
    const doors = [
        [cx + Math.floor(cw / 2), cy, "h"], [cx + Math.floor(cw / 2), cy + ch - 1, "h"],
        [cx, cy + Math.floor(ch / 2), "v"], [cx + cw - 1, cy + Math.floor(ch / 2), "v"]
    ];
    doors.forEach(([x, y, k]) => {
        if (k === "h") { g[y][x - 1] = " "; g[y][x] = " "; g[y][x + 1] = " "; }
        else { g[y - 1][x] = " "; g[y][x] = " "; g[y + 1][x] = " "; }
    });
    // внутренние перегородки
    for (let i = 0; i < r.between(2, 4); i++) {
        const vx = r.between(cx + 2, cx + cw - 3), vy = r.between(cy + 2, cy + ch - 3);
        const len = r.between(3, 5), dir = r.chance(0.5) ? [1, 0] : [0, 1];
        for (let k = 0; k < len; k++) {
            const x = vx + dir[0] * k, y = vy + dir[1] * k;
            if (x > cx && x < cx + cw - 1 && y > cy && y < cy + ch - 1) g[y][x] = "█";
        }
    }
}

function styleArena(g, w, h, r) {
    // просторно: несколько колонн по краям и по центру «арены»
    const pillars = Math.max(4, Math.floor((w * h) / 120));
    for (let i = 0; i < pillars; i++) {
        const x = r.between(3, w - 5), y = r.between(3, h - 5);
        g[y][x] = "█";
        if (r.chance(0.5)) g[y + 1][x] = "█";
        if (r.chance(0.5)) g[y][x + 1] = "█";
    }
}

/* ============================ ДЕКОРАЦИИ ============================ */

function freeCells(g, w, h) {
    const res = [];
    for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) if (g[y][x] === " ") res.push([x, y]);
    return res;
}

function decorate(g, w, h, r, d) {
    const put = (x, y, c) => { if (x > 0 && y > 0 && x < w - 1 && y < h - 1 && g[y][x] === " ") { g[y][x] = c; return true; } return false; };

    // кирпичные кластеры
    for (let i = 0; i < d.bricks; i++) {
        const c = r.chance(0.5) ? "░" : "▒";
        const len = r.between(2, 4), vertical = r.chance(0.5);
        const x = r.between(2, w - 4), y = r.between(2, h - 4);
        for (let k = 0; k < len; k++) put(vertical ? x : x + k, vertical ? y + k : y, c);
    }
    // дерево
    for (let i = 0; i < d.wood; i++) {
        const len = r.between(2, 3), vertical = r.chance(0.5);
        const x = r.between(2, w - 4), y = r.between(2, h - 4);
        for (let k = 0; k < len; k++) put(vertical ? x : x + k, vertical ? y + k : y, "#");
    }
    // бочки и ящики
    for (let i = 0; i < d.barrels; i++) { const [x, y] = r.pick(freeCells(g, w, h)); put(x, y, "○"); }
    for (let i = 0; i < d.crates; i++) { const [x, y] = r.pick(freeCells(g, w, h)); put(x, y, "□"); }
    // ворота: короткая линия в проходе
    for (let i = 0; i < (d.gates || 0); i++) {
        const vertical = r.chance(0.5), len = r.between(2, 4);
        const x = r.between(2, w - 4), y = r.between(2, h - 4);
        for (let k = 0; k < len; k++) put(vertical ? x : x + k, vertical ? y + k : y, "◘");
    }
    // секретные стены: заменяем одиночные стены, у которых есть проход рядом
    let secrets = d.secrets || 0;
    for (let y = 1; y < h - 1 && secrets > 0; y++) for (let x = 1; x < w - 1 && secrets > 0; x++) {
        if (g[y][x] !== "█") continue;
        const near = (g[y][x - 1] !== "█") || (g[y][x + 1] !== "█") || (g[y - 1][x] !== "█") || (g[y + 1][x] !== "█");
        if (near && r.chance(0.12)) { g[y][x] = "▓"; secrets--; }
    }
}

/* ========================= РАССТАНОВКА ========================= */

function manhattan(a, b) { return Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]); }

function openNeighborhood(g, w, h, x, y, radius) {
    let free = 0, total = 0;
    for (let yy = y - radius; yy <= y + radius; yy++) for (let xx = x - radius; xx <= x + radius; xx++) {
        total++;
        if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
        if (g[yy][xx] === " ") free++;
    }
    return free / total;
}

function placeEnemies(g, w, h, r, enemies, player, sizes) {
    const placed = [];
    const spec = (c) => ({
        minPlayer: "1234567".includes(c) ? 9 : ("mcrlsfxt".includes(c) ? 8 : 11),
        space: "SCRLTFX".includes(c) ? 0.72 : 0.25,
        radius: "SCRLTFX".includes(c) ? 2 : 1
    });
    for (const c of enemies) {
        const s = spec(c);
        const wanted = { minPlayer: s.minPlayer, space: s.space, between: 2 };
        let cell = null;
        for (let attempt = 0; attempt < 4000 && !cell; attempt++) {
            const relax = attempt / 4000;             // постепенно ослабляем требования
            const [x, y] = r.pick(freeCells(g, w, h));
            if (sizes && "SCRLTFX".includes(c)) {
                // боссы — ближе к центру карты
                if (Math.abs(x - w / 2) + Math.abs(y - h / 2) > (w + h) / 3) continue;
            }
            if (manhattan([x, y], player) < wanted.minPlayer * (1 - 0.4 * relax)) continue;
            if (openNeighborhood(g, w, h, x, y, s.radius) < wanted.space * (1 - 0.35 * relax)) continue;
            if (placed.some(p => manhattan(p, [x, y]) < wanted.between)) continue;
            cell = [x, y];
        }
        if (!cell) return null;                        // не удалось — пусть решает вызывающий
        g[cell[1]][cell[0]] = c;
        placed.push(cell);
    }
    return placed;
}

function placePlayer(g, w, h, r, enemiesCells) {
    const corners = [[2, 2], [w - 3, 2], [2, h - 3], [w - 3, h - 3]];
    const shuffled = corners.slice().sort(() => r.int(3) - 1);
    for (const [cx, cy] of shuffled) {
        for (let radius = 0; radius < 6; radius++) {
            for (let dy = -radius; dy <= radius; dy++) for (let dx = -radius; dx <= radius; dx++) {
                const x = cx + dx, y = cy + dy;
                if (x < 1 || y < 1 || x > w - 2 || y > h - 2) continue;
                if (g[y][x] !== " ") continue;
                if (enemiesCells.some(e => manhattan(e, [x, y]) < 8)) continue;
                g[y][x] = "☻";
                return [x, y];
            }
        }
    }
    return null;
}

/* ============================ СПЕЦИФИКАЦИЯ ============================ */

const SPEC = [
    { name: "Полигон",            terrain: "desert", style: "open",     w: 20, h: 13, enemies: ["1"],
      decor: { bricks: 5, wood: 1, barrels: 6, crates: 5, gates: 0, secrets: 1 } },
    { name: "Снежный перевал",    terrain: "snow",   style: "rooms",    w: 21, h: 15, enemies: ["1", "1"],
      decor: { bricks: 6, wood: 2, barrels: 6, crates: 5, gates: 2, secrets: 1 } },
    { name: "Ржавый форт",        terrain: "grass",  style: "fortress", w: 23, h: 17, enemies: ["2", "2", "m"],
      decor: { bricks: 7, wood: 2, barrels: 7, crates: 6, gates: 4, secrets: 1 } },
    { name: "Каменный лабиринт",  terrain: "desert", style: "maze",     w: 25, h: 17, enemies: ["2", "2", "3"],
      decor: { bricks: 6, wood: 2, barrels: 7, crates: 6, gates: 2, secrets: 2 } },
    { name: "Ледяные клещи",      terrain: "snow",   style: "open",     w: 23, h: 17, enemies: ["3", "3", "m", "s"],
      decor: { bricks: 7, wood: 2, barrels: 8, crates: 6, gates: 0, secrets: 1 } },
    { name: "Нефтяные поля",      terrain: "desert", style: "open",     w: 25, h: 17, enemies: ["3", "3", "3", "c"],
      decor: { bricks: 6, wood: 1, barrels: 14, crates: 7, gates: 0, secrets: 1 } },
    { name: "Заброшенный завод",  terrain: "grass",  style: "rooms",    w: 25, h: 19, enemies: ["4", "3", "r", "m"],
      decor: { bricks: 8, wood: 3, barrels: 8, crates: 7, gates: 4, secrets: 1 } },
    { name: "Метель",             terrain: "snow",   style: "arena",    w: 25, h: 19, enemies: ["4", "4", "s", "f"],
      decor: { bricks: 7, wood: 2, barrels: 9, crates: 7, gates: 0, secrets: 2 } },
    { name: "Каньон",             terrain: "desert", style: "maze",     w: 27, h: 19, enemies: ["4", "4", "5", "l"],
      decor: { bricks: 7, wood: 2, barrels: 8, crates: 6, gates: 2, secrets: 2 } },
    { name: "Бетонный узел",      terrain: "grass",  style: "fortress", w: 25, h: 21, enemies: ["5", "5", "c", "x"],
      decor: { bricks: 9, wood: 3, barrels: 9, crates: 8, gates: 5, secrets: 1 } },
    { name: "Полярная станция",   terrain: "snow",   style: "rooms",    w: 25, h: 21, enemies: ["5", "6", "x", "f"],
      decor: { bricks: 9, wood: 3, barrels: 9, crates: 8, gates: 5, secrets: 2 } },
    { name: "Пепел",              terrain: "desert", style: "open",     w: 27, h: 21, enemies: ["6", "7", "R"],
      decor: { bricks: 8, wood: 2, barrels: 12, crates: 8, gates: 0, secrets: 2 } },
    { name: "Лабиринт Титана",    terrain: "grass",  style: "maze",     w: 27, h: 23, enemies: ["6", "7", "C", "x"],
      decor: { bricks: 8, wood: 3, barrels: 9, crates: 7, gates: 3, secrets: 2 } },
    { name: "Стальной шторм",     terrain: "snow",   style: "arena",    w: 27, h: 23, enemies: ["7", "L", "T", "l"],
      decor: { bricks: 9, wood: 2, barrels: 10, crates: 8, gates: 0, secrets: 2 } },
    { name: "Последний рубеж",    terrain: "desert", style: "fortress", w: 27, h: 25, enemies: ["S", "C", "R", "L", "X"],
      decor: { bricks: 10, wood: 3, barrels: 12, crates: 9, gates: 6, secrets: 2 } }
];

/* ============================== БАЛАНС ============================== */

const BALANCE = {
    note: "Мягче ванильного: меньше гринда на 15 уровней. Всё можно отключить, убрав patchSettings в паке.",
    PRICES: {
        armor: [1500, 3000, 6000, 12000, 18000],
        speed: [400, 500, 600, 700, 800],
        turret: [400, 500, 600, 700, 800],
        sight: [400, 500, 600, 700, 800],
        minigun: [0, 150, 250, 350, 450, 550],
        shotgun: [2200, 400, 700, 1000, 1300, 1600],
        ricochet: [6000, 1800, 2400, 3000, 3600, 4200],
        flamethrower: [8000, 2200, 2800, 3400, 4000, 4600],
        cannon: [8000, 2200, 2800, 3400, 4000, 4600],
        shock: [8000, 2200, 2800, 3400, 4000, 4600],
        rockets: [9000, 2400, 3000, 3600, 4200, 4800],
        laser: [24000, 9000, 10000, 11000, 12000, 13000],
        railgun: [24000, 9000, 10000, 11000, 12000, 13000],
        mines: [6000, 1800, 2400, 3000, 3600, 4200]
    },
    AMMO_PRICES: { rockets: 180, railgun: 350 },
    ACHIEVEMENTS_LIMITS: { destroyer: 60 }
};

/* ============================== СБОРКА ============================== */

const SEED = 20261004;
const levels = [];
const report = [];
const problems = [];

for (let i = 0; i < SPEC.length; i++) {
    const s = SPEC[i];
    let rows = null, stats = null, tries = 0;

    while (tries++ < 60) {
        const rnd = mulberry32(SEED + i * 7919 + tries * 104729);
        const r = makeRnd(rnd);
        const g = blank(s.w, s.h);

        // рамка ставится раньше стиля, чтобы стили её не сломали
        if (s.style === "maze") styleMaze(g, s.w, s.h, r);
        else if (s.style === "rooms") styleRooms(g, s.w, s.h, r);
        else if (s.style === "fortress") styleFortress(g, s.w, s.h, r);
        else if (s.style === "arena") styleArena(g, s.w, s.h, r);
        else styleOpen(g, s.w, s.h, r);
        frame(g, s.w, s.h);

        decorate(g, s.w, s.h, r, s.decor);
        frame(g, s.w, s.h);

        // враги -> игрок (так у игрока есть гарантированный «карман» вокруг старта)
        const enemyCells = [];
        // временный старт для проверки дистанций: берём угол, который выбрал бы placePlayer
        const tmp = [[2, 2], [s.w - 3, 2], [2, s.h - 3], [s.w - 3, s.h - 3]][r.int(4)];
        const placed = placeEnemies(g, s.w, s.h, r, s.enemies, tmp);
        if (!placed) continue;
        placed.forEach(p => enemyCells.push(p));

        // поставить игрока в самый «свободный» из углов
        const player = placePlayer(g, s.w, s.h, r, enemyCells);
        if (!player) continue;

        rows = g.map(row => row.join(""));
        const res = validateMap(rows, s.name);
        if (res.problems.length) { problems.push(...res.problems); continue; }  // другая попытка
        stats = res.stats;
        break;
    }

    if (!rows) { console.error(`✗ не удалось сгенерировать «${s.name}»`); process.exit(1); }
    levels.push([s.name, s.terrain].concat(rows));
    report.push({ name: s.name, terrain: s.terrain, style: s.style, tries, ...stats });
}

/* --- финальная проверка всего массива --- */
const allProblems = validateLevels(levels);
if (allProblems.length) {
    console.error("ПРОБЛЕМЫ:\n" + allProblems.map(p => "  ✗ " + p).join("\n"));
    process.exit(1);
}

const data = {
    meta: {
        title: "Новая кампания",
        version: "1.0.0",
        generator: "tools/gen-campaign.js",
        seed: SEED,
        comment: "15 оригинальных карт (собственная работа), сгенерированы детерминированно и проверены валидатором."
    },
    balance: BALANCE,
    levels: levels
};

const out = path.join(__dirname, "campaign-data.json");
fs.writeFileSync(out, JSON.stringify(data, null, 2) + "\n", "utf8");

console.log("Уровень              местность  стиль      размер   враги  спавнеры  турели  боссы  бочек  ящиков");
report.forEach((r, i) => {
    console.log(
        `${String(i + 1).padStart(2)}. ${r.name.padEnd(19)} ${r.terrain.padEnd(10)} ${r.style.padEnd(10)} ` +
        `${(r.width + "x" + r.height).padEnd(8)} ${String(r.enemies).padStart(5)} ${String(r.spawners).padStart(9)} ` +
        `${String(r.turrets).padStart(7)} ${String(r.bosses).padStart(6)} ${String(r.barrels).padStart(6)} ${String(r.crates).padStart(8)}`);
});
console.log(`\n✓ все 15 карт проверены (рамка, один старт, достижимость целей)`);
console.log(`→ ${path.relative(process.cwd(), out)}`);
