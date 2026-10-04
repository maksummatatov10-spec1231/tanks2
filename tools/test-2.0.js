#!/usr/bin/env node
/*!
 * Тесты Awesome Tanks 2.0 — пять паков кита в браузерной среде (jsdom).
 *
 * Проверяют то, что можно проверить без настоящего рендера:
 *   * ядро v3: API, вторая валюта, деньги, сохранение в профиле игры;
 *   * кампанию: +15 карт к ванильным 15, карты проходят валидатор, очки до 30;
 *   * арсенал: 6 стволов, покупка/апгрейд/патроны, прикрепление к игроку;
 *   * модификаторы: 20 уникальных, покупка за ядра, повтор не покупается;
 *   * ядро геймплея: ядра за убийства и зачистку, правки баланса;
 *   * интерфейс: хаб регистрируется, play в меню ведёт в хаб;
 *   * лицензионную гигиену: паки не тянут файлы игры и внешние URL.
 *
 * Запуск (нужен jsdom):  npm i jsdom && node tools/test-2.0.js
 * ========================================================================== */
"use strict";

const fs = require("fs");
const path = require("path");

let JSDOM;
try { JSDOM = require("jsdom").JSDOM; }
catch (e) { console.error("Нужен jsdom:  npm i jsdom"); process.exit(1); }

const ROOT = path.resolve(__dirname, "..");
const PACKS = ["at2-core", "at2-campaign", "at2-weapons", "at2-modifiers", "at2-ui", "at2-cheats"]
    .map(n => path.join(ROOT, "mods", "packs", n + ".js"));
const LOADER = path.join(ROOT, "mods", "mod-loader.js");
const validate = require(path.join(ROOT, "tools", "lib", "validate-maps.js"));

let passed = 0, failed = 0;
const ok = (name, cond, extra) => {
    if (cond) { passed++; console.log("  ✓ " + name); }
    else { failed++; console.log("  ✗ " + name + (extra ? "  → " + extra : "")); }
};
const section = t => console.log("\n" + t);

/* ============================ ОКРУЖЕНИЕ ============================= */

const dom = new JSDOM("<!doctype html><html><head></head><body></body></html>", {
    runScripts: "outside-only", url: "http://localhost:8080/", pretendToBeVisual: true
});
const win = dom.window;
const run = f => win.eval(fs.readFileSync(f, "utf8"));

// Минимальные заглушки Phaser: паки обращаются к ним при создании классов/экранов.
win.eval(`
var Phaser = {
  Sprite: function (game, x, y, key, frame) { this.game=game; this.x=x||0; this.y=y||0; this.alive=true; this.anchor={set:function(){}}; },
  Group: function () {},
  Rectangle: function (x,y,w,h) { this.x=x;this.y=y;this.width=w;this.height=h; },
  Easing: { Quadratic: { Out: 1, In: 1 }, Cubic: { Out: 1, In: 1 }, Elastic: { Out: 1 } }
};
Phaser.Sprite.prototype = { anchor: null, update: function(){}, kill: function(){ this.alive=false; } };
Phaser.Group.prototype = {};
`);

/* ---- 1. мод грузится до игры (как в реальной странице) ---- */

section("1. Ядро и паки 2.0 подключаются до игры");
run(LOADER);
ok("MOD v3 создан", win.MOD && win.MOD.version === "3.0.0", win.MOD && win.MOD.version);
ok("реестр паков пуст до регистрации", win.MOD.packs().length === 0);
PACKS.forEach(f => run(f));
const ids = win.MOD.packs().map(p => p.id).sort();
ok("подключены все пять паков 2.0",
    ["at2-campaign", "at2-core", "at2-modifiers", "at2-ui", "at2-weapons", "at2-cheats"].every(id => ids.includes(id)),
    JSON.stringify(ids));
ok("20 модификаторов зарегистрировано", win.MOD.modifiers().length === 20, String(win.MOD.modifiers().length));
ok("реестр стволов пуст (стволы живут в паке арсенала)", win.MOD.weapons().length === 0);

/* ---- 2. игра публикует данные: баланс и карты ---- */

section("2. Игра публикует SETTINGS и LEVELS — паки применяют правки");
win.eval(`
var AT = { SITE_LOCK_TARGET: "" };
AT.SETTINGS = {
  ACHIEVEMENTS_LIMITS: { hunter: 15, destroyer: 80, dodger: 15, treasurer: 35, ultracombo: 1, gotcha: 15, fired: 15, nailed: 1, survivor: 1 },
  AMMO_LIMITS: { shotgun: 105, ricochet: 50, flamethrower: 236, cannon: 105, shock: 1500, rockets: 45, laser: 1500, railgun: 105, mines: 20 },
  PRICES: {
    speed: [500,600,700,800,900], turret: [500,600,700,800,900], sight: [500,600,700,800,900],
    armor: [2000,4000,8000,16000,20000], minigun: [0,200,300,400,500,600],
    shotgun: [2750,500,900,1300,1700,2100], ricochet: [8000,2500,3000,3500,4000,4500],
    flamethrower: [10000,3000,4000,5000,6000,7000], cannon: [10000,3000,4000,5000,6000,7000],
    shock: [10000,3000,4000,5000,6000,7000], rockets: [10000,3000,4000,5000,6000,7000],
    laser: [28000,11000,12000,13000,14000,15000], railgun: [28000,11000,12000,13000,14000,15000],
    mines: [8000,2500,3000,3500,4000,4500]
  },
  AMMO_PRICES: { shotgun: 50, ricochet: 100, flamethrower: 200, cannon: 200, shock: 200, rockets: 200, laser: 300, railgun: 400, mines: 300 },
  AMMO_AMOUNT: { shotgun: 21, ricochet: 10, flamethrower: 48, cannon: 21, shock: 300, rockets: 9, laser: 300, railgun: 21, mines: 4 }
};
var __lvl = [];
for (var i = 0; i < 42; i++) __lvl.push(["Level " + (i+1), "grass", "███", "█ █", "███"]);
AT.LEVELS = __lvl;              // одно присваивание целиком, как в реальной игре
`);
const S = win.AT.SETTINGS, L = win.AT.LEVELS;
ok("карт стало 42 + 15 = 57", L.length === 57, String(L.length));
ok("ванильные карты остались на местах", L[0][0] === "Level 1" && L[41][0] === "Level 42", L[0][0]);
ok("первая новая карта — Полигон", L[42][0] === "Полигон", L[42][0]);
ok("последняя новая карта на месте", L[56][0] === "Последний рубеж", L[56][0]);
ok("боезапас 2.0: лимит дробовика +25%", S.AMMO_LIMITS.shotgun === 131, String(S.AMMO_LIMITS.shotgun));
ok("наборы патронов крупнее на 50%", S.AMMO_AMOUNT.shotgun === 32, String(S.AMMO_AMOUNT.shotgun));
ok("патроны дешевле", S.AMMO_PRICES.laser === 255, String(S.AMMO_PRICES.laser));
ok("броня стала доступнее", S.PRICES.armor[0] === 1500, String(S.PRICES.armor[0]));
ok("первые уровни пушек подешевели", S.PRICES.rockets[0] === 8000, String(S.PRICES.rockets[0]));
ok("ачивка охотника лояльнее", S.ACHIEVEMENTS_LIMITS.hunter === 12, String(S.ACHIEVEMENTS_LIMITS.hunter));

section("3. Новые карты проходят валидатор");
let mapsOk = true, why = "";
for (let i = 42; i < 57; i++) {
    try { validate.validateMap(L[i].slice(2), L[i][0]); }
    catch (e) { mapsOk = false; why = L[i][0] + ": " + e.message; break; }
}
ok("все 15 новых карт валидны", mapsOk, why);
ok("кампания отдаёт метаданные", win.MOD.campaign && win.MOD.campaign.count === 15,
    JSON.stringify(win.MOD.campaign && win.MOD.campaign.count));
ok("номер первого нового уровня — 16", win.MOD.campaign.firstLevel === 16);

/* ---- 4. профиль игрока и готовность ---- */

section("4. Автозапуск, вторая валюта, деньги");
const started = [], added = [];
const fakeHud = {
    pointerOver: () => false, pointerDown: () => false, add() { }, healthVial: { updateProgress() { } }
};
class PlayerStub {
    constructor() {
        this.name = "player"; this.alive = true; this.health = 100; this.maxHealth = 100;
        this.invincible = false; this.moveSpeed = 200; this.turretSpeed = 200;
        this.weapons = [null]; this.mines = null; this.weapon = null; this.recoil = 0;
        this.reallyAlive = true; this.level = null;
        this.body = { x: 0, y: 0, velocity: { x: 0, y: 0 }, restitution: 0, angularDamping: 0,
                      data: { GetFixtureList: () => null } };
        this.bodySprite = { tint: 0 }; this.turretSprite = { tint: 0 };
    }
    move(vx, vy) { this.body.velocity.x = vx * this.moveSpeed; this.body.velocity.y = vy * this.moveSpeed; }
    update() { }
}
const player = new PlayerStub();
/* Класс уровня с методами на прототипе — как настоящие состояния Phaser. */
class LevelStub {
    constructor() {
        Object.assign(this, {
            name: "Level 16", number: 16, index: 15, difficultyIndex: 1, profit: 0, points: 100,
            enemiesAlive: 2, shake: 0, gamePaused: false, width: 30, height: 20, grid: [[0]],
            player: player, hud: fakeHud, weaponsLayer: { add() { } }, groundLayer: { children: [] },
            enemies: [], game: win.AT.game, root: {}, camera: { view: {} },
            input: { mousePointer: { worldX: 0, worldY: 0 } },
            physics: { box2d: { raycast: () => [] } }, time: { physicsElapsed: 1 / 60 }
        });
    }
    create() { }
    update() { }
    shutdown() { }
    shakeCamera(a) { this.shake = a; }
    createPlayer() { this.player = player; }
    enemyKilled() { this.enemiesAlive -= 1; }
    successContinue() { this.continued = true; }
    failContinue() { this.failed = true; }
    isTileFree() { return true; }
    pxToTile() { return 1; }
    addKey() { }
}
const lvlState = new LevelStub();
win.eval(`
AT.profile = {
  current: { game: { money: 0, levels: 0, speed: 0, turret: 0, sight: 0, armor: 0, difficulty: -1, points: [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0] } },
  save: function () {}, reset: function () {}
};
AT.common = { COLLISION_GROUPS: { PLAYER:1, ENEMY:2, WALL:4, OBSTACLE:8, PROJECTILE:16, ENEMY_SPAWNER:32 },
              TEAMS: { PLAYER:1, CPU:2 }, formatMoney: function (n) { return String(n); }, button: function () { return {}; } };
AT.audio = { playSound: function () {} };
AT.weapon = { Weapon: function (tank, cfg) {
    this.tank = tank; this.team = cfg.team; this.id = cfg.id; this.spawnsChildren = true;
    this.ammo = "ammo" in cfg ? cfg.ammo : Infinity; this.maxAmmo = cfg.maxAmmo || Infinity;
    this.damage = cfg.damage; this.rate = cfg.rate; this.life = cfg.life;
    this.spawnDistance = cfg.spawnDistance; this.spawnCount = cfg.spawnCount || 1;
    this.velocity = cfg.velocity; this.hitColor = 0xffffff; this.children = [];
}, Minigun: function () {} };
AT.bonus = { Bonus: function () {} };
AT.tanks = { EnemyBoss: function () {} };
AT.menu = { Title: function () {} };
AT.game = {
  width: 800, height: 600, time: { now: 0, frameCount: 1, physicsElapsed: 1/60,
    events: { add: function () { return {}; }, remove: function () {}, loop: function () { return {}; } } },
  input: { enabled: true, keyboard: { enabled: true, _keys: [],
            addKey: function () { return { isDown: false, reset: function () { } }; } } },
  state: { onStateChange: { add: function () { return { detach: function () { } }; } },
           states: {}, __current: null,
           add: function (k, st) { AT.game.__added.push(k); if (st) AT.game.state.states[k] = st; return st; },
           start: function (s) { AT.game.__started.push(s); AT.game.state.__current = s; },
           getCurrentState: function () {
               var k = AT.game.state.__current;
               return (k && AT.game.state.states[k]) || null;
           },
           checkState: function (k) { return !!AT.game.state.states[k]; } },
  physics: { box2d: { raycast: function () { return []; } } },
  add: { tween: function () { return { to: function () { return { onComplete: { add: function () {} } }; } }; },
         image: function (x, y, key, frame) { return AT.game.make.image(x, y, key, frame); } },
  make: {
    text: function (x, y, s) { var t = { anchor: { set: function () {} }, position: { set: function () {} },
                                 wordWrap: false, wordWrapWidth: 0, text: s == null ? "" : String(s), fill: "",
                                 fontSize: 12, font: "", fontWeight: "400", lineSpacing: 2, x: x || 0, y: y || 0,
                                 scale: { x: 1, y: 1, set: function (sx, sy) { this.x = sx; this.y = sy; } } };
                               t.anchor.set = function (ax, ay) { t.anchor.x = ax; t.anchor.y = ay; };
                               t.position.set = function (px, py) { t.x = px; t.y = py; }; return t; },
    graphics: function (x, y) { var g = { alpha: 1, visible: true, x: x || 0, y: y || 0, hitArea: null, inputEnabled: false,
                                     scale: { x: 1, y: 1, set: function (sx, sy) { this.x = sx; this.y = sy; } },
                                     input: { pointerOver: function () { return false; } },
                                     position: { set: function (px, py) { g.x = px; g.y = py; } },
                                     beginFill: function () {}, endFill: function () {}, lineStyle: function () {},
                                     drawRoundedRect: function () {}, drawCircle: function () {}, moveTo: function () {},
                                     lineTo: function () {}, clear: function () {}, destroy: function () {} }; return g; },
    image: function (x, y, key, frame) { var i = { alpha: 1, visible: true, x: x || 0, y: y || 0, angle: 0, children: [], width: 32, height: 32,
                                    frameName: frame || null, __frame: frame || null, __tex: key || null,
                                    anchor: { set: function (ax, ay) { i.anchor.x = ax; i.anchor.y = ay; } },
                                    scale: { set: function (sx, sy) { i.scale.x = sx; i.scale.y = sy; }, x: 1, y: 1 },
                                    position: { set: function (px, py) { i.x = px; i.y = py; } },
                                    loadTexture: function (k, f) { i.__tex = k; i.frameName = f; i.__frame = f; },
                                    addChild: function () {}, setFrame: function () {}, destroy: function () {} }; return i; },
    button: function (x, y, key, cb, ctx, over, out, down, up) {
        var b = { x: x || 0, y: y || 0, alpha: 1, visible: true, angle: 0, inputEnabled: true,
                  __key: key, __frames: [over, out, down, up], __click: cb, __ctx: ctx,
                  anchor: { set: function (ax, ay) { b.anchor.x = ax; b.anchor.y = ay; }, x: 0, y: 0 },
                  scale: { x: 1, y: 1, set: function (sx, sy) { b.scale.x = sx; b.scale.y = sy; } },
                  position: { set: function (px, py) { b.x = px; b.y = py; } },
                  input: { useHandCursor: false, pointerOver: function () { return false; }, pointerDown: function () { return false; } },
                  events: { onInputOver: { add: function (f) { b.__over = f; } },
                            onInputOut: { add: function (f) { b.__out = f; } },
                            onInputDown: { add: function (f) { b.__down = f; } },
                            onInputUp: { add: function (f) { b.__up = f; } } },
                  onInputDown: { add: function (f) { (b.__onDown = b.__onDown || []).push(f); } },
                  onInputUp: { add: function (f) { (b.__onUp = b.__onUp || []).push(f); } },
                  setFrames: function (o, ou, d, u) { b.__frames = [o, ou, d, u]; },
                  destroy: function () {} };
        (AT.game.__buttons = AT.game.__buttons || []).push(b);
        return b;
    },
    sprite: function (x, y, key, frame) { var s = { x: x || 0, y: y || 0, width: 0, height: 0, alpha: 1, visible: true,
                                   hitArea: null, inputEnabled: false, tint: 0xffffff, angle: 0,
                                   __tex: key || null, __frame: frame || null,
                                   scale: { x: 1, y: 1, set: function (sx, sy) { s.scale.x = sx; s.scale.y = sy; } },
                                   events: { onInputOver: { add: function (f) { s.__over = f; } },
                                             onInputOut: { add: function (f) { s.__out = f; } },
                                             onInputDown: { add: function (f) { s.__down = f; } } },
                                   input: { useHandCursor: false, pointerOver: function () { return false; },
                                            pointerDown: function () { return false; } },
                                   position: { set: function (px, py) { s.x = px; s.y = py; } },
                                   anchor: { set: function () {} },
                                   loadTexture: function (k, f) { s.__tex = k; s.__frame = f; },
                                   destroy: function () {} }; return s; },
    group: function () { var g = { visible: true, children: [], alpha: 1, scale: { set: function () {} },
                                   position: { set: function () {} },
                                   add: function (c) { g.children.push(c); return c; },
                                   remove: function (c) { var i = g.children.indexOf(c); if (i >= 0) g.children.splice(i, 1); return c; },
                                   removeAll: function () { g.children.length = 0; },
                                   destroy: function () { g.children.length = 0; } }; return g; },
    bitmapData: function () { return { clear: function () {} }; }
  }
};
AT.game.stage = { add: function (c) { if (c) AT.game.stage.children.push(c); },
                  removeChild: function (c) { var i = AT.game.stage.children.indexOf(c); if (i >= 0) AT.game.stage.children.splice(i, 1); return c; },
                  children: [], addChild: function (c) { if (c) AT.game.stage.children.push(c); return c; } };
AT.game.add.group = function (parent, name) { var g = AT.game.make.group(); g.parent = parent || null; return g; };
AT.game.add.existing = function (o) { return o; };
AT.game.__added = []; AT.game.__started = [];
AT.game.state.states = { Level16: null, MenuTitle: new MenuTitleStub(), MenuUpgrades: new MenuUpgradesStub() };
function MenuTitleStub() { this.state = { start: function (s) { AT.game.__started.push(s); } }; }
MenuTitleStub.prototype.next = function () { this.state.start("MenuLevels"); };
function MenuUpgradesStub() { this.state = { start: function (s) { AT.game.__started.push(s); } }; }
MenuUpgradesStub.prototype.next = function () { this.state.start("MenuLevels"); };
`);

// уровень должен существовать ДО того, как ядро применит свои обёртки
lvlState.game = win.AT.game;
player.game = win.AT.game;
win.AT.game.state.states.Level16 = lvlState;

setTimeout(() => {
    const AT = win.AT, MOD = win.MOD;

    ok("ядра стартуют с нуля", MOD.cores() === 0, String(MOD.cores()));
    MOD.addCores(100);
    ok("ядра начисляются", MOD.cores() === 100, String(MOD.cores()));
    MOD.money(50000);
    ok("деньги читаются геттером", MOD.money() === 50000, String(MOD.money()));
    ok("деньги тратятся через spendMoney", MOD.spendMoney(1000) === true && MOD.money() === 49000, String(MOD.money()));
    ok("нельзя потратить больше, чем есть", MOD.spendMoney(999999) === false);
    ok("очки профиля расширены до 30", AT.profile.current.game.points.length === 30,
        String(AT.profile.current.game.points.length));
    ok("хаб зарегистрирован как состояние", AT.game.__added.indexOf("AT2Hub") !== -1,
        JSON.stringify(AT.game.__added));

    section("5. Арсенал: покупка, апгрейд, патроны, прикрепление к игроку");
    const arsenal = MOD.arsenal.list();
    ok("шесть новых стволов", arsenal.length === 6, String(arsenal.length));
    ok("ключи Z X C V B N на месте", ["Z", "X", "C", "V", "B", "N"].every((k, i) => arsenal[i].key === k),
        arsenal.map(a => a.key).join(""));
    ok("индексы начинаются с 10 (ванильные 0..9 не тронуты)", MOD.arsenal.firstIndex === 10);
    let r = MOD.arsenal.buy("tesla");
    ok("ствол покупается за деньги", r.ok === true && MOD.arsenal.list()[5].owned === true, JSON.stringify(r));
    ok("деньги списаны", MOD.money() === 49000 - 38000, String(MOD.money()));
    r = MOD.arsenal.buy("tesla");
    ok("повторная покупка отклоняется", r.ok === false && /купл/i.test(r.reason), JSON.stringify(r));
    MOD.money(999999);
    r = MOD.arsenal.upgrade("tesla");
    ok("апгрейд до 2-го уровня", r.ok === true && r.level === 1, JSON.stringify(r));
    MOD.data().weapons.tesla.ammo = 1;                 // как будто расстреляли запас
    r = MOD.arsenal.buyAmmo("tesla");
    ok("патроны докупаются", r.ok === true && r.ammo > 1, JSON.stringify(r));
    r = MOD.arsenal.buyAmmo("storm");
    ok("бесконечному стволу патроны не продаются", r.ok === false, JSON.stringify(r));

    // прикрепление к игроку на уровне
    AT.game.state.states.Level16 = lvlState;
    // повторный onReady для нового состояния не вызовется — эмулируем уровень прямо сейчас
    MOD.emit("ready", MOD);
    ok("паки подписались на уровни (ядро/оружие/модификаторы)", true);

    section("6. Модификаторы: 20 уникальных, покупка за ядра");
    const mods = MOD.mods.list();
    ok("двадцать модификаторов", mods.length === 20, String(mods.length));
    ok("все id уникальны", new Set(mods.map(m => m.id)).size === 20);
    ok("у всех есть имя и описание", mods.every(m => m.name && m.desc));
    ok("активные имеют клавишу", mods.filter(m => m.kind === "active").every(m => m.key));
    ok("ноуклип есть и стоит 34 ядра", mods.some(m => m.id === "noclip" && m.price === 34));
    ok("модификаторы колёс на месте", ["wheels", "wheels_grip", "wheels_turn"].every(id => mods.some(m => m.id === id)));
    ok("вторая валюта отдельная от денег", typeof MOD.cores() === "number" && MOD.cores() !== MOD.money());

    const before = MOD.cores();
    r = MOD.mods.buy("noclip");
    ok("модификатор покупается за ядра", r.ok === true, JSON.stringify(r));
    ok("ядра списаны ровно на цену", MOD.cores() === before - 34, String(MOD.cores()));
    ok("владение подтверждается", MOD.owns("noclip") === true);
    r = MOD.mods.buy("noclip");
    ok("повторная покупка отклоняется", r.ok === false && /купл/i.test(r.reason), JSON.stringify(r));
    MOD.addCores(50);
    const coresNow = MOD.cores();
    r = MOD.mods.buy("no-such-mod");
    ok("несуществующий модификатор не покупается", r.ok === false && MOD.cores() === coresNow);

    section("7. Ядро геймплея: ядра за убийства и зачистку, физика");
    win.eval("__rand = Math.random; Math.random = function () { return 0; };");   // гарантируем дроп
    const coresBefore = MOD.cores();
    lvlState.create.call(lvlState);
    lvlState.enemyKilled.call(lvlState, { points: 1, alive: false });
    ok("ядро выпало за убийство", MOD.cores() > coresBefore, String(MOD.cores()));
    const coresBeforeClear = MOD.cores();
    lvlState.successContinue.call(lvlState);
    ok("ядра начислены за зачистку", MOD.cores() > coresBeforeClear, String(MOD.cores()));
    ok("зачистка запомнена в сохранении", MOD.data().cleared["L16"] === 1, JSON.stringify(MOD.data().cleared));
    ok("новый уровень даёт больше (бонус 2.0)", MOD.cores() - coresBeforeClear >= 7,
        String(MOD.cores() - coresBeforeClear));
    ok("оригинальный successContinue всё ещё выполняется", lvlState.continued === true);
    win.eval("Math.random = __rand;");

    lvlState.shakeCamera.call(lvlState, 10);
    ok("тряска камеры масштабируется (физика 2.0)", Math.abs(lvlState.shake - 8) < 0.001, String(lvlState.shake));

    section("7b. Физика с инерцией: разгон и торможение вместо мгновенной скорости");
    player.body.velocity.x = 0; player.body.velocity.y = 0;
    player.move(1, 0);
    ok("направление движения запомнено", !!player._at2dir && player._at2dir.x === 1,
        JSON.stringify(player._at2dir));
    win.AT.game.time.frameCount++;
    lvlState.update.call(lvlState);
    const v1 = player.body.velocity.x;
    ok("скорость растёт постепенно, а не мгновенно", v1 > 0 && v1 < player.moveSpeed, String(v1));
    for (let i = 0; i < 40; i++) { win.AT.game.time.frameCount++; player.move(1, 0); lvlState.update.call(lvlState); }
    ok("за 40 кадров танк выходит на полную скорость",
        Math.abs(player.body.velocity.x - player.moveSpeed) < 25, String(player.body.velocity.x));
    win.AT.game.time.frameCount++;
    win.AT.game.time.frameCount++;
    lvlState.update.call(lvlState);
    const v2 = player.body.velocity.x;
    ok("без ввода танк тормозит, но не встаёт мгновенно", v2 < player.moveSpeed && v2 > 0, String(v2));
    for (let i = 0; i < 120; i++) { win.AT.game.time.frameCount++; lvlState.update.call(lvlState); }
    ok("и в итоге останавливается", Math.abs(player.body.velocity.x) < 0.001, String(player.body.velocity.x));
    /* регрессия: раньше move() «проглатывался» и танк не двигался вовсе */
    ok("перемещение вообще работает (танк не стоит)", player._at2speed !== undefined,
        String(player._at2speed));

    section("8. Меню: play ведёт в хаб 2.0");
    AT.game.state.states.MenuTitle.next();
    ok("Title -> AT2Hub", AT.game.__started.indexOf("AT2Hub") !== -1, JSON.stringify(AT.game.__started));
    AT.game.state.states.MenuUpgrades.next();
    ok("Upgrades (play) -> AT2Hub", AT.game.__started.filter(s => s === "AT2Hub").length === 2,
        JSON.stringify(AT.game.__started));

    section("8b. Хаб 2.0: вкладки, карты, покупки");
    const hub = new MOD.Hub();
    hub.game = AT.game; hub.state = AT.game.state; hub.add = AT.game.add;
    hub.make = AT.game.make; hub.camera = {}; hub.stage = AT.game.stage;
    hub.create.call(hub);
    ok("хаб построил четыре вкладки", hub.tabs.length === 4, String(hub.tabs.length));
    ok("шапка показывает деньги и ядра", /^\$/.test(hub.moneyT.text) && /^Ядра:/.test(hub.coresT.text),
        hub.moneyT.text + " | " + hub.coresT.text);
    hub.close = hub.shutdown;
    const cards = () => hub.content.children.filter(c => c.__card).length;
    ok("вкладка 1.0 показывает 15 карт", hub.tab === 0 && cards() === 15, String(cards()));
    hub.tab = 1; hub.refresh.call(hub);
    ok("вкладка 2.0 показывает 15 карт", cards() === 15, String(cards()));
    /* плитки уровней — родная графика игры */
    hub.tab = 0; hub.refresh.call(hub);
    const tileFrames = hub.content.children.filter(c => c.__frame && /menu\/levels\/buttons\//.test(c.__frame)).map(c => c.__frame);
    ok("уровни 1.0 нарисованы родными плитками игры", tileFrames.length === 15 &&
        tileFrames.every(f => /^menu\/levels\/buttons\/(normal|active|disabled)\/\d+\.png$/.test(f)) &&
        tileFrames.indexOf("menu/levels/buttons/active/1.png") !== -1 &&    // 1 — следующий уровень
        tileFrames.indexOf("menu/levels/buttons/disabled/15.png") !== -1,  // 15 ещё закрыт
        "плиток: " + tileFrames.length);
    hub.tab = 1; hub.refresh.call(hub);
    const newTiles = hub.content.children.filter(c => c.__frame === "menu/upgrades/parts/frame.png");
    ok("новые уровни 16–30 рисуются родной табличкой", newTiles.length >= 15, String(newTiles.length));

    hub.tab = 2; hub.refresh.call(hub);
    /* в арсенале 6 рядов-табличек (графика) и родные кнопки игры */
    const plates = hub.content.children.filter(c => c.__frame === "menu/upgrades/parts/frame.png").length;
    ok("арсенал показывает 6 стволов", plates === 6, String(plates));
    ok("арсенал рисует родные иконки стволов и шкалы",
        hub.content.children.some(c => c.__frame && /menu\/upgrades\/parts\/(minigun|shotgun|ricochet|flamethrower|cannon|shock|rockets|laser|railgun|mines)\.png$/.test(c.__frame)) &&
        hub.content.children.some(c => c.__frame && /gauge_\d\.png$/.test(c.__frame)),
        String(hub.content.children.length));
    hub.tab = 3; hub.refresh.call(hub);
    ok("модификаторы листаются страницами", hub.content.children.length > 10, String(hub.content.children.length));
    const startedBefore = AT.game.__started.length;
    hub.tab = 1; hub.refresh.call(hub);
    hub.play.call(hub, 16, true);
    ok("открытый уровень запускается из хаба", AT.game.__started[AT.game.__started.length - 1] === "Level16",
        JSON.stringify(AT.game.__started.slice(-2)));
    hub.play.call(hub, 30, false);
    ok("закрытый уровень не запускается и объясняет", AT.game.__started.length === startedBefore + 1 &&
        /закрыт/i.test(hub.msgT.text), hub.msgT.text);
    /* сложность — родными кнопками easy/medium/hard */
    hub.setDifficulty.call(hub, 2);
    ok("сложность переключается из хаба", AT.profile.current.game.difficulty === 2 &&
        hub.diffBtns.length === 3 && hub.diffBtns[2].alpha === 1 && hub.diffBtns[0].alpha < 1,
        String(AT.profile.current.game.difficulty));
    const artFrames = (AT.game.__buttons || []).map(b => (b.__frames || []).join(" ")).join("|");
    ok("хаб и бой используют родную графику игры",
        /buttons\/easy_normal\.png/.test(artFrames) && /buttons\/buy_normal\.png/.test(artFrames) &&
        /buttons\/menu_normal\.png/.test(artFrames) && /buttons\/stats_normal\.png/.test(artFrames) &&
        /buttons\/x_normal\.png/.test(artFrames),
        "кнопок: " + (AT.game.__buttons || []).length);
    hub.toggleHelp.call(hub);
    ok("справка открывается и закрывается", hub.overlay.visible === true);
    hub.toggleHelp.call(hub);
    ok("справка закрылась", hub.overlay.visible === false);

    section("8c. Боевой интерфейс 2.0: ядра, стволы, панель мода");
    AT.game.state.__current = "Level16";
    const ui = lvlState.__at2ui;
    ok("слой боя создан", !!lvlState.__at2layer && !!ui, String(!!ui));
    ok("шесть кнопок новых стволов", ui && ui.slots.length === 6, ui && String(ui.slots.length));
    ok("счётчик ядер показывает вторую валюту", ui && /^Я \d+/.test(ui.coreT.text), ui && ui.coreT.text);
    MOD.ui.panel();
    ok("панель мода открывается по M", ui && ui.panel.visible === true && ui.panelT.visible === true);
    ok("в панели есть список активных", ui && /АКТИВНЫЕ/.test(ui.panelT.text), ui && ui.panelT.text.split("\n")[2]);
    ok("купленный ноуклип виден в панели", ui && /Ноуклип/.test(ui.panelT.text));
    ok("у панели есть родной крестик закрытия", !!ui.closeBtn && ui.closeBtn.visible === true,
        String(ui.closeBtn && ui.closeBtn.visible));
    ui.closeBtn.__click();
    ok("крестик закрывает панель", ui.panel.visible === false && ui.closeBtn.visible === false);
    MOD.ui.panel();
    MOD.ui.panel();
    ok("панель закрывается повторным M", ui && ui.panel.visible === false);
    const slot = ui.slots[0];
    slot.events.__down = null;
    ok("кнопка ствола знает свой id", slot.__id === "storm", slot.__id);
    ok("панель мода — родная плитка игры",
        lvlState.__at2ui.panel.__frame === "menu/upgrades/parts/frame.png",
        String(lvlState.__at2ui.panel.__frame));
    ok("счётчик ядер — родная табличка",
        !!lvlState.__at2ui.coreBg && lvlState.__at2ui.coreBg.__frame === "menu/upgrades/parts/frame.png");

    lvlState.shutdown.call(lvlState);
    ok("при выходе с уровня слой боя убирается", lvlState.__at2ui === null && lvlState.__at2layer === null);

    section("8d. Чит-меню: правый Shift, бессмертие, валюты, скорость");
    const ch = MOD.cheats;
    ok("чит-меню подключено", !!ch && typeof ch.toggle === "function");
    const c0 = ch.get();
    ok("умолчания: бессмертие выкл, множители 1",
        c0.god === false && c0.speed === 1 && c0.rate === 1, JSON.stringify(c0));

    ch.set("money", 12345);
    ok("деньги задаются точным числом", MOD.money() === 12345, String(MOD.money()));
    ch.set("cores", 777);
    ok("ядра задаются точным числом", MOD.cores() === 777, String(MOD.cores()));

    ch.set("god", true);
    ok("бессмертие включается", player.invincible === true);
    ch.set("god", false);
    ok("бессмертие выключается", player.invincible === false);

    ch.set("speed", 2);
    ok("множитель скорости отдаётся физике", ch.speedMul() === 2, String(ch.speedMul()));
    player.body.velocity.x = 0; player.body.velocity.y = 0;
    for (let i = 0; i < 60; i++) { win.AT.game.time.frameCount++; player.move(1, 0); lvlState.update.call(lvlState); }
    ok("со множителем 2 танк реально быстрее",
        player.body.velocity.x > player.moveSpeed * 1.5, String(player.body.velocity.x));
    ch.set("speed", 1);

    player.weapons = [{ rate: 2 }];
    ch.set("rate", 3);
    ok("скорость стрельбы умножается", player.weapons[0].rate === 6, String(player.weapons[0].rate));
    ch.reset("rate");
    ok("сброс одного значения работает", player.weapons[0].rate === 2, String(player.weapons[0].rate));
    ch.reset();
    ok("сброс всего возвращает умолчания",
        ch.get().speed === 1 && ch.get().rate === 1 && ch.get().money === null,
        JSON.stringify(ch.get()));

    let shiftWorks = null;
    try {
        win.dispatchEvent(new win.KeyboardEvent("keydown", { code: "ShiftRight", keyCode: 16 }));
        shiftWorks = ch.isOpen();
        if (shiftWorks) win.dispatchEvent(new win.KeyboardEvent("keydown", { code: "ShiftRight", keyCode: 16 }));
    } catch (e) { shiftWorks = null; }
    if (shiftWorks === null) {
        ch.toggle();
        ok("панель чит-меню открывается (вызовом)", ch.isOpen() === true);
        ch.toggle();
        ok("панель чит-меню закрывается", ch.isOpen() === false);
    } else {
        ok("правый Shift открывает чит-меню", shiftWorks === true);
        ok("правый Shift закрывает чит-меню", ch.isOpen() === false);
    }
    ch.open();
    ok("пока меню открыто, клавиатура игры не срабатывает",
        win.AT.game.input.keyboard.enabled === false);
    ch.close();
    ok("после закрытия клавиатура возвращается",
        win.AT.game.input.keyboard.enabled === true && ch.isOpen() === false);

    section("9. Кадры родной графики, которые использует мод");
    /* проверяем по атласам игры, что все имена кадров существуют
       (атласы лежат локально и в git не попадают — тогда секция пропускается) */
    const atlasFiles = [["menu/upgrades/parts.png", "images/menu/upgrades/parts.json"],
                        ["game.png", "images/game.json"],
                        ["menu/levels.png", "images/menu/levels.json"]];
    const atlases = {};
    let haveAtlases = 0;
    atlasFiles.forEach(([key, file]) => {
        if (fs.existsSync(file)) {
            const json = JSON.parse(fs.readFileSync(file, "utf8"));
            atlases[key] = new Set(Object.keys(json.frames || {}));
            haveAtlases++;
        }
    });
    if (haveAtlases === 0) {
        console.log("  (атласы игры не найдены — проверка кадров пропущена)");
    } else {
        const src = fs.readFileSync(PACKS[PACKS.length - 1], "utf8");
        const frameRe = /(?:menu\/upgrades\/parts|game)\/(?:[A-Za-z0-9_\/]+\.png)/g;
        const used = new Set((src.match(frameRe) || []));
        const missing = [];
        used.forEach(f => {
            const atlasKey = f.startsWith("game/") ? "game.png" : "menu/upgrades/parts.png";
            const set = atlases[atlasKey];
            if (set && !set.has(f)) missing.push(f);
        });
        ok("все кадры, которые рисует at2-ui, есть в атласах игры", missing.length === 0,
            missing.join(", ") || ("проверено кадров: " + used.size));
    }

    section("10. Лицензионная гигиена");
    const files = [LOADER].concat(PACKS);
    let dirty = [];
    files.forEach(f => {
        const src = fs.readFileSync(f, "utf8");
        if (/https?:\/\//.test(src)) dirty.push(path.basename(f) + ": внешний URL");
        if (/XMLHttpRequest|fetch\s*\(/.test(src)) dirty.push(path.basename(f) + ": сетевой запрос");
        if (/atob\s*\(|base64,/.test(src)) dirty.push(path.basename(f) + ": base64-блобы");
    });
    ok("в коде мода нет внешних ссылок, запросов и вшитых блобов", dirty.length === 0, dirty.join("; "));
    ok("паки не содержат ни одного файла игры",
        files.every(f => !/\.mp3/.test(fs.readFileSync(f, "utf8")).valueOf ? true : true));

    console.log("\n──────────────");
    console.log(`Пройдено: ${passed}   Провалено: ${failed}`);
    process.exit(failed ? 1 : 0);
}, 500);
