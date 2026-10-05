#!/usr/bin/env node
/*!
 * build-packs.js — сборка паков мод-кита из данных.
 *
 *   node tools/build-packs.js            # собрать все паки
 *   node tools/build-packs.js campaign   # только карты
 *
 * Сейчас собирает:
 *   tools/campaign-data.json  ->  mods/packs/at2-campaign.js
 *
 * Паки, написанные руками (mod-loader, at2-core, at2-weapons, at2-modifiers, at2-ui),
 * этот скрипт не трогает.
 */
"use strict";

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const OUT_CAMPAIGN = path.join(ROOT, "mods", "packs", "at2-campaign.js");

function readJson(p) {
    return JSON.parse(fs.readFileSync(p, "utf8"));
}

/* ---------------------------------------------------------------- кампания */

function buildCampaign() {
    const src = path.join(ROOT, "tools", "campaign-data.json");
    const data = readJson(src);
    const levels = data.levels;
    if (!Array.isArray(levels) || !levels.length) throw new Error("campaign-data.json: нет levels");

    // Имена оставляем как есть: кампанию 2.0 в хабе отмечает отдельная вкладка,
    // а символы вне латиницы шрифт игры не содержит.
    const rows = levels.map((lvl) => "        " + JSON.stringify(lvl));

    const meta = data.meta || {};
    const bal = data.balance || {};

    const header = `/*!
 * Awesome Tanks 2.0 — новые карты кампании (at2-campaign.js)
 * -----------------------------------------------------------------------------
 * ФАЙЛ СГЕНЕРИРОВАН: tools/build-packs.js из tools/campaign-data.json.
 * Правьте JSON и генератор, а не этот файл.
 *
 * 15 собственных карт (не из оригинальной игры), ${meta.seed ? "seed " + meta.seed : "детерминированные"}.
 * Они ДОБАВЛЯЮТСЯ к 15 ванильным: игра получает уровни 16..30.
 * Карты проверены валидатором tools/lib/validate-maps.js.
 */
(function () {
    "use strict";

    var M = window.MOD;
    if (!M) { console.warn("[at2-campaign] нужен mod-loader.js"); return; }

    var FIRST = 16;          // номер первого нового уровня
    var COUNT = ${levels.length};
    var TITLE = ${JSON.stringify(meta.title || "Кампания 2.0")};

    var LEVELS = [
${rows.join(",\n")}
    ];

    // Краткая сводка (для меню и документации). Баланс, под который считались карты:
    // PRICES ${JSON.stringify(bal.PRICES || {})}
    // AMMO_PRICES ${JSON.stringify(bal.AMMO_PRICES || {})}
    var MAPS = LEVELS.map(function (l, i) {
        return { number: FIRST + i, name: l[0], terrain: l[1], width: l[2].length, height: l.length - 2 };
    });

    function patchLevels(levels) {
        if (!levels || levels.__at2campaign) return;
        try { Object.defineProperty(levels, "__at2campaign", { value: true }); } catch (e) { levels.__at2campaign = true; }
        for (var i = 0; i < LEVELS.length; i++) levels.push(LEVELS[i]);
        M.log("новых карт добавлено: " + LEVELS.length + " (уровни " + FIRST + "-" + (FIRST + COUNT - 1) + ")");
    }

    function extendProfile() {
        // Ванильный профиль хранит очки только для 15 уровней — расширяем до новых.
        try {
            var p = window.AT.profile.current;
            if (!p || !p.game || !p.game.points) return;
            var need = FIRST + COUNT - 1;   // уровни 1..30
            if (p.game.points.length < need) {
                while (p.game.points.length < need) p.game.points.push(0);
                window.AT.profile.save();
                M.log("профиль расширен до " + need + " уровней очков");
            }
        } catch (e) { }
    }

    M.registerPack({
        id: "at2-campaign",
        name: "Awesome Tanks 2.0 — кампания из ${levels.length} новых карт",
        version: "3.0.0",
        patchLevels: patchLevels,
        onReady: extendProfile
    });

    M.campaign = {
        title: TITLE,
        firstLevel: FIRST,
        count: COUNT,
        maps: MAPS,
        nameOf: function (number) {
            var m = MAPS[number - FIRST];
            return m ? m.name : null;
        }
    };
})();
`;

    fs.writeFileSync(OUT_CAMPAIGN, header, "utf8");
    const kb = (fs.statSync(OUT_CAMPAIGN).size / 1024).toFixed(1);
    console.log(`[build-packs] mods/packs/at2-campaign.js — ${levels.length} карт, ${kb} КБ`);
}

/* ------------------------------------------------------------------ запуск */

function main() {
    const what = process.argv[2] || "all";
    if (what === "all" || what === "campaign") buildCampaign();
    else { console.error("неизвестная цель:", what, "(campaign|all)"); process.exit(2); }
}

main();
