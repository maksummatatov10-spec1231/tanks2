/*!
 * Валидатор карт Awesome Tanks 2.
 * Используется генератором кампании (tools/gen-campaign.js) и тестами.
 *
 * Проверяет всё, что ломает игру или делает уровень непроходимым:
 *   * строки одинаковой длины;
 *   * рамка из неразрушимых стен `█` по периметру (иначе туман/камера/физика «текут»);
 *   * ровно один старт игрока `☻`;
 *   * минимум одна цель (враг/спавнер/турель/босс) — иначе победа сразу;
 *   * все цели достижимы от старта (BFS по проходимым клеткам: `█` не проходит,
 *     остальное можно расчистить выстрелами);
 *   * нет неизвестных символов;
 *   * старт не соприкасается с целью вплотную (иначе умираешь на первом кадре).
 *
 * Модуль ничего не знает про игру: только про формат карты.
 * ========================================================================== */
"use strict";

const LEGEND = {
    " ": "пусто",
    "█": "стена",
    "▓": "секретная стена",
    "▒": "кирпичи (крепкие)",
    "░": "кирпичи",
    "#": "дерево",
    "◘": "ворота",
    "☻": "игрок",
    "○": "бочка",
    "□": "ящик",
    "1": "спавнер 1", "2": "спавнер 2", "3": "спавнер 3", "4": "спавнер 4",
    "5": "спавнер 5", "6": "спавнер 6", "7": "спавнер 7",
    "m": "турель: миниган", "s": "турель: дробовик", "c": "турель: пушка",
    "r": "турель: ракеты", "l": "турель: лазер", "f": "турель: огнемёт",
    "x": "турель: рельса", "t": "турель: рикошет",
    "S": "босс: дробовик", "C": "босс: пушка", "R": "босс: ракеты",
    "L": "босс: лазер", "T": "босс: рикошет", "F": "босс: огнемёт",
    "X": "босс: рельса",
    "❶": "танк: миниган", "❷": "танк: дробовик", "❸": "танк: пушка",
    "❹": "танк: ракеты", "❺": "танк: лазер", "❻": "танк: рикошет",
    "❼": "танк: огнемёт", "❽": "танк: рельса", "❾": "танк: камикадзе"
};

const ENEMY_CHARS = "1234567mcrlsfxtSRLTFCX❶❷❸❹❺❻❼❽❾";
const isEnemy = (c) => ENEMY_CHARS.indexOf(c) !== -1;
const isWall = (c) => c === "█";

/** Возвращает { problems: string[], stats: {...} } для одной карты. */
function validateMap(rows, name) {
    const problems = [];
    const label = name ? `«${name}»` : "карта";

    if (!Array.isArray(rows) || !rows.length) return { problems: [label + ": пустая карта"], stats: {} };
    if (rows.some(r => typeof r !== "string")) problems.push(label + ": все строки карты должны быть строками");
    if (problems.length) return { problems, stats: {} };

    const h = rows.length, w = rows[0].length;
    if (rows.some(r => r.length !== w)) problems.push(label + ": строки разной длины");
    if (w < 7 || h < 7) problems.push(label + `: слишком маленькая карта ${w}x${h}`);

    // рамка и неизвестные символы
    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            const c = rows[y][x];
            if (!(c in LEGEND)) problems.push(label + `: неизвестный символ «${c}» в (${x},${y})`);
            const onBorder = y === 0 || x === 0 || y === h - 1 || x === w - 1;
            if (onBorder && !isWall(c)) problems.push(label + `: рамка не из стен в (${x},${y}) — «${c}»`);
        }
    }

    // старт
    let start = null, starts = 0;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (rows[y][x] === "☻") { starts++; start = [x, y]; }
    if (starts === 0) problems.push(label + ": нет старта игрока ☻");
    if (starts > 1) problems.push(label + `: стартов ${starts}, должен быть ровно один`);

    // цели
    const targets = [];
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (isEnemy(rows[y][x])) targets.push([x, y, rows[y][x]]);
    if (!targets.length) problems.push(label + ": нет ни одного врага — уровень закончится мгновенно");

    // достижимость
    if (start) {
        const seen = new Set([start[0] + "," + start[1]]);
        const q = [start];
        while (q.length) {
            const [x, y] = q.pop();
            for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
                const nx = x + dx, ny = y + dy;
                if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
                const k = nx + "," + ny;
                if (seen.has(k) || isWall(rows[ny][nx])) continue;
                seen.add(k); q.push([nx, ny]);
            }
        }
        const unreachable = targets.filter(([x, y]) => !seen.has(x + "," + y));
        if (unreachable.length) {
            problems.push(label + ": недостижимые цели — " +
                unreachable.map(([x, y, c]) => `${c}(${x},${y})`).join(", "));
        }
    }

    // старт вплотную к врагу
    if (start) {
        const [sx, sy] = start;
        for (const [x, y, c] of targets) {
            if (Math.abs(x - sx) <= 1 && Math.abs(y - sy) <= 1) {
                problems.push(label + `: старт вплотную к цели «${c}» в (${x},${y})`);
            }
        }
    }

    const stats = {
        width: w, height: h,
        enemies: targets.length,
        spawners: targets.filter(t => "1234567".includes(t[2])).length,
        turrets: targets.filter(t => "mcrlsfxt".includes(t[2])).length,
        bosses: targets.filter(t => "SCRLTFX".includes(t[2])).length,
        barrels: rows.join("").split("○").length - 1,
        crates: rows.join("").split("□").length - 1
    };
    return { problems, stats };
}

/** Проверяет массив карт формата AT.LEVELS: [ "Имя", "terrain", ...строки ] */
function validateLevels(levels) {
    const problems = [];
    const terrains = ["grass", "snow", "desert"];
    levels.forEach((lvl, i) => {
        if (!Array.isArray(lvl) || lvl.length < 4) { problems.push(`уровень ${i + 1}: мало строк`); return; }
        if (typeof lvl[0] !== "string") problems.push(`уровень ${i + 1}: нет имени`);
        if (!terrains.includes(lvl[1])) problems.push(`уровень ${i + 1}: неизвестная местность «${lvl[1]}»`);
        const res = validateMap(lvl.slice(2), lvl[0]);
        res.problems.forEach(p => problems.push(p));
    });
    return problems;
}

module.exports = { LEGEND, ENEMY_CHARS, isEnemy, isWall, validateMap, validateLevels };

/* --- CLI: node tools/lib/validate-maps.js mods/packs/new-campaign.js --- */
if (require.main === module) {
    const path = require("path");
    const file = process.argv[2];
    if (!file) {
        console.log("Использование: node tools/lib/validate-maps.js <файл-пака-или-json>");
        process.exit(1);
    }
    let levels;
    if (file.endsWith(".json")) {
        levels = JSON.parse(require("fs").readFileSync(file, "utf8")).levels;
    } else {
        const src = require("fs").readFileSync(file, "utf8");
        const m = src.match(/var\s+LEVELS\s*=\s*(\[[\s\S]*?\]);/);
        if (!m) { console.error("в файле не найден массив LEVELS"); process.exit(1); }
        levels = eval(m[1]);   // файл пака и так доверенный
    }
    const problems = validateLevels(levels);
    levels.forEach((l, i) => {
        const st = validateMap(l.slice(2), l[0]).stats;
        console.log(`${String(i + 1).padStart(2)}. ${l[0].padEnd(26)} ${st.width}x${st.height}  ` +
            `враги ${String(st.enemies).padStart(2)} (спавнеры ${st.spawners}, турели ${st.turrets}, боссы ${st.bosses})`);
    });
    if (problems.length) {
        console.error("\nПРОБЛЕМЫ:\n" + problems.map(p => "  ✗ " + p).join("\n"));
        process.exit(1);
    }
    console.log("\n✓ все карты прошли проверку");
}
