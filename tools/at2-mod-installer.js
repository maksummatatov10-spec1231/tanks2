#!/usr/bin/env node
/*!
 * Awesome Tanks 2 — Mod Kit: установщик мода в копию игры игрока.
 * -----------------------------------------------------------------------------
 * Ставит мод-кит в уже скачанную/установленную копию игры: копирует папку mods/
 * и аккуратно подключает её в index.html (между маркерами AT2MOD).
 *
 * Ничего из игры не распространяет и не требует: работает только с тем, что
 * уже есть у пользователя. Откат в одну команду.
 *
 * Использование:
 *   node at2-mod-installer.js --game "/путь/к/игре"
 *   node at2-mod-installer.js --game "..." --packs demo-pack
 *   node at2-mod-installer.js --game "..." --uninstall
 *   node at2-mod-installer.js --game "..." --dry-run
 *
 * Лицензия: MIT.
 * ========================================================================== */
"use strict";

const fs = require("fs");
const path = require("path");

const KIT_ROOT = path.resolve(__dirname, "..");      // корень мод-кита
const SRC_MODS = path.join(KIT_ROOT, "mods");
const TEMPLATE = path.join(SRC_MODS, "install", "index-template.html");

// Паки 2.0 подключаются в этом порядке (ядро -> карты -> стволы -> модификаторы -> интерфейс).
// demo-pack и другие паки можно добавить через --packs.
const DEFAULT_PACKS = ["at2-core", "at2-campaign", "at2-weapons", "at2-modifiers", "at2-ui", "at2-cheats"];

const MARK_BEGIN = "<!-- AT2MOD:BEGIN -->";
const MARK_END = "<!-- AT2MOD:END -->";
const MARK_GEN = "<!-- AT2MOD-GENERATED -->";

function usage(code) {
    console.log(`
Awesome Tanks 2 — установщик мод-кита

  node at2-mod-installer.js --game <папка с игрой> [опции]

Опции:
  --game <dir>       папка, где лежит awesome_tanks_2.js (обязательно)
  --packs a,b,c      какие паки из mods/packs поставить (по умолчанию все)
  --uninstall        убрать мод (вернуть index.html из бэкапа)
  --dry-run          показать план, ничего не менять
  --help             этот текст
`);
    process.exit(code || 0);
}

function parseArgs(argv) {
    const o = { game: null, packs: null, uninstall: false, dry: false };
    for (let i = 2; i < argv.length; i++) {
        const a = argv[i];
        if (a === "--help" || a === "-h") usage(0);
        else if (a === "--game") o.game = argv[++i];
        else if (a === "--packs") o.packs = String(argv[++i] || "").split(",").filter(Boolean);
        else if (a === "--uninstall") o.uninstall = true;
        else if (a === "--dry-run") o.dry = true;
        else { console.error("Неизвестная опция: " + a); usage(1); }
    }
    if (!o.game) { console.error("Не указан --game"); usage(1); }
    o.game = path.resolve(o.game);
    return o;
}

function read(p) { return fs.readFileSync(p, "utf8"); }
function write(p, s) { fs.writeFileSync(p, s, "utf8"); }
function exists(p) { return fs.existsSync(p); }

function copyRecursive(src, dst, dry, filter) {
    if (!exists(src)) return;
    fs.mkdirSync(dst, { recursive: true });
    for (const name of fs.readdirSync(src)) {
        const s = path.join(src, name), d = path.join(dst, name);
        const st = fs.statSync(s);
        if (st.isDirectory()) {
            if (name === "install" || name === "userscript") continue;   // служебное
            copyRecursive(s, d, dry, filter);
        } else {
            if (filter && !filter(name, path.relative(SRC_MODS, s))) continue;
            if (dry) { console.log("   [план] копировать mods/" + path.relative(SRC_MODS, s)); continue; }
            fs.copyFileSync(s, d);
        }
    }
}

function findGameHtml(gameDir) {
    const cands = ["index.html", "game.html", "(index)"];
    for (const c of cands) {
        const p = path.join(gameDir, c);
        if (exists(p)) return { path: p, name: c };
    }
    return null;
}

function buildBlock(packs) {
    const lines = [MARK_BEGIN, '  <script src="mods/mod-loader.js"></script>'];
    for (const p of packs) lines.push('  <script src="mods/packs/' + p + '.js"></script>');
    if (!packs.length) lines.push("  <!-- паки не выбраны; добавь сюда <script src=\"mods/packs/имя.js\"></script> -->");
    lines.push(MARK_END);
    return lines.join("\n");
}

function stripBlock(html) {
    const re = new RegExp("\\n?[ \\t]*" + MARK_BEGIN + "[\\s\\S]*?" + MARK_END + "\\n?", "g");
    return html.replace(re, "\n");
}

function patchHtml(html, packs) {
    const clean = html.indexOf(MARK_BEGIN) !== -1 ? stripBlock(html) : html;
    const gameTag = /[ \t]*<script[^>]*awesome_tanks_2\.js[^>]*>\s*<\/script>/i;
    if (!gameTag.test(clean)) return null;
    return clean.replace(gameTag, buildBlock(packs) + "\n  " + '<script src="awesome_tanks_2.js"></script>');
}

function install(o) {
    if (!exists(path.join(o.game, "awesome_tanks_2.js"))) {
        console.error("✗ В папке нет awesome_tanks_2.js — это не копия игры:\n  " + o.game);
        process.exit(2);
    }

    // какие паки ставим
    let packs = o.packs;
    if (!packs) {
        const dir = path.join(SRC_MODS, "packs");
        const available = exists(dir) ? fs.readdirSync(dir).filter(f => f.endsWith(".js")).map(f => f.replace(/\.js$/, "")) : [];
        packs = DEFAULT_PACKS.filter(p => available.includes(p));
        if (!packs.length) packs = available;      // страховка: если набор 2.0 отсутствует — берём всё
    }
    for (const p of packs) {
        if (!exists(path.join(SRC_MODS, "packs", p + ".js"))) {
            console.error("✗ Нет пака mods/packs/" + p + ".js\n  доступны: " +
                (exists(path.join(SRC_MODS, "packs")) ? fs.readdirSync(path.join(SRC_MODS, "packs")).join(", ") : "нет"));
            process.exit(2);
        }
    }

    console.log("Установка мод-кита в:\n  " + o.game + "\n");
    console.log("1) Копирую mods/ ...");
    copyRecursive(SRC_MODS, path.join(o.game, "mods"), o.dry);

    console.log("2) Правлю страницу запуска ...");
    let target = findGameHtml(o.game);
    if (!target) {
        console.log("   index.html не найден — создаю из шаблона кита");
        if (!o.dry) write(path.join(o.game, "index.html"), read(TEMPLATE));
        target = { path: path.join(o.game, "index.html"), name: "index.html" };
    }
    let html = read(target.path);
    const wasGenerated = html.indexOf(MARK_GEN) !== -1;

    const patched = patchHtml(html, packs);
    if (patched === null) {
        console.error("✗ Не нашёл в " + target.name + " тег <script src=\"awesome_tanks_2.js\">.");
        console.error("  Добавь строку вручную перед ним:");
        console.error("  " + buildBlock(packs).split("\n").join("\n  "));
        process.exit(3);
    }

    if (o.dry) {
        console.log("   [план] обновить " + target.name + ", блок:\n" + buildBlock(packs).split("\n").map(l => "      " + l).join("\n"));
        console.log("\nПробный запуск завершён (ничего не изменено).");
        return;
    }

    const bak = target.path + ".at2mod.bak";
    if (!exists(bak) && !wasGenerated) {
        fs.copyFileSync(target.path, bak);
        console.log("   бэкап: " + path.basename(bak));
    }
    write(target.path, patched);
    console.log("   обновлён: " + target.name);

    console.log(`
✓ Готово. Паки: ${packs.length ? packs.join(", ") : "(ни одного)"}
  Запуск игры: локальный http-сервер из папки игры
      python3 -m http.server 8080     →  http://localhost:8080/
  Откат:  node at2-mod-installer.js --game "${o.game}" --uninstall
`);
}

function uninstall(o) {
    console.log("Удаление мода из:\n  " + o.game + "\n");
    const target = findGameHtml(o.game);

    if (target) {
        const bak = target.path + ".at2mod.bak";
        const html = read(target.path);
        if (exists(bak)) {
            write(target.path, read(bak));
            fs.unlinkSync(bak);
            console.log("✓ " + target.name + " восстановлен из бэкапа, бэкап удалён");
        } else if (html.indexOf(MARK_GEN) !== -1) {
            fs.unlinkSync(target.path);
            console.log("✓ " + target.name + " (создан установщиком) удалён");
        } else if (html.indexOf(MARK_BEGIN) !== -1) {
            write(target.path, stripBlock(html));
            console.log("✓ блок мода убран из " + target.name);
        } else {
            console.log("• в " + target.name + " нет следов мода — не трогаю");
        }
    }

    const modsDir = path.join(o.game, "mods");
    if (exists(modsDir)) {
        fs.rmSync(modsDir, { recursive: true, force: true });
        console.log("✓ папка mods/ удалена");
    }
    console.log("\nИгра снова в исходном виде.");
}

const opts = parseArgs(process.argv);
if (opts.uninstall) uninstall(opts);
else install(opts);
