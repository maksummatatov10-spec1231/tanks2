/*!
 * Awesome Tanks 2.0 — модификаторы (at2-modifiers.js)
 * -----------------------------------------------------------------------------
 * 20 уникальных модификаторов, покупаются за ЯДРА (◈) — вторую валюту 2.0.
 * Ничего не заменяют: это дополнительный слой прогресса поверх ванильных апгрейдов.
 *
 *   АКТИВНЫЕ (клавиша, перезарядка):
 *     H  Ноуклип           5 с — сквозь стены и пули
 *     G  Рывок             3× скорость на 0.25 с
 *     J  Щит               6 с полной неуязвимости
 *     K  Хронометр         3 с враги заморожены (2 раза за уровень)
 *     L  Ядерный залп      выжигает всё в радиусе 260 (1 раз за уровень)
 *     U  Блинк             телепорт к курсору
 *     I  Ударная волна     отбрасывает врагов
 *     O  Форсаж            6 с: +60% скорость и темп огня
 *     Y  Берсерк           5 с: ×2 урон, цена — 3 HP
 *
 *   ПАССИВНЫЕ (работают всегда):
 *     Гусеницы «Вихрь»     +18% скорости
 *     Шипованные колёса    таран + резче разгон
 *     Колёса «Пантера»     +45% скорости башни
 *     Собиратель           +25% ядер
 *     Вампиризм            +2 HP за убийство
 *     Композитная броня    +25% прочности
 *     Боезапас 2.0         +30% патронов и запас на старте
 *     Сканер               карта видна с начала уровня
 *     Магнит               притягивает бонусы
 *     Призрак              1.5 с неуязвимости после урона
 *     Детонатор            убитые враги взрываются
 *
 * Требует: mod-loader.js + at2-core.js. Лицензия: MIT.
 * ========================================================================== */
(function () {
    "use strict";

    var M = window.MOD;
    if (!M) { console.warn("[at2-modifiers] нужен mod-loader.js"); return; }

    var LIST = [
        /* ------------------------- активные ------------------------- */
        { id: "noclip", kind: "active", key: "H", cd: 25, price: 34, name: "Ноуклип",
          desc: "5 секунд движения сквозь стены и пули. Если закончился внутри стены — продлевается, пока не выйдете." },
        { id: "dash", kind: "active", key: "G", cd: 6, price: 18, name: "Рывок",
          desc: "Мгновенный рывок: скорость втрое выше на четверть секунды." },
        { id: "shield", kind: "active", key: "J", cd: 30, price: 26, name: "Щит",
          desc: "6 секунд полной неуязвимости." },
        { id: "timeslow", kind: "active", key: "K", cd: 40, uses: 2, price: 26, name: "Хронометр",
          desc: "Замораживает всех врагов на 3 секунды. Два заряда на уровень." },
        { id: "nuke", kind: "active", key: "L", cd: 0, uses: 1, price: 28, name: "Ядерный залп",
          desc: "Выжигает всё живое в радиусе 260 (200 урона). Один заряд на уровень." },
        { id: "teleport", kind: "active", key: "U", cd: 12, price: 22, name: "Блинк",
          desc: "Телепорт к курсору, если путь не перекрыт." },
        { id: "wave", kind: "active", key: "I", cd: 10, price: 12, name: "Ударная волна",
          desc: "Отбрасывает врагов в радиусе 190 и снимает 6 HP." },
        { id: "overdrive", kind: "active", key: "O", cd: 28, price: 24, name: "Форсаж",
          desc: "6 секунд: +60% скорости и +60% темпа стрельбы." },
        { id: "berserk", kind: "active", key: "Y", cd: 30, price: 20, name: "Берсерк",
          desc: "5 секунд удвоенного урона. Цена — 3 HP сразу." },

        /* ------------------------ пассивные ------------------------- */
        { id: "wheels", kind: "passive", price: 14, name: "Гусеницы «Вихрь»",
          desc: "+18% скорости движения." },
        { id: "wheels_grip", kind: "passive", price: 20, name: "Шипованные колёса",
          desc: "Резче разгон и торможение, а таран на скорости бьёт врагов (12 урона)." },
        { id: "wheels_turn", kind: "passive", price: 16, name: "Колёса «Пантера»",
          desc: "+45% скорости наведения башни." },
        { id: "scavenger", kind: "passive", price: 22, name: "Собиратель",
          desc: "+25% ядер со всех источников." },
        { id: "vampire", kind: "passive", price: 24, name: "Вампиризм",
          desc: "Восстанавливает 2 HP за каждое убийство." },
        { id: "armor2", kind: "passive", price: 20, name: "Композитная броня",
          desc: "+25% максимальной прочности." },
        { id: "ammo2", kind: "passive", price: 20, name: "Боезапас 2.0",
          desc: "+30% к максимуму патронов и столько же боезапаса на старте уровня." },
        { id: "scanner", kind: "passive", price: 16, name: "Сканер",
          desc: "Карта полностью видна с начала уровня — туман больше не мешает." },
        { id: "magnet", kind: "passive", price: 18, name: "Магнит",
          desc: "Притягивает монеты и бонусы в радиусе 120." },
        { id: "ghost", kind: "passive", price: 18, name: "Призрак",
          desc: "После полученного урона — 1.5 с неуязвимости." },
        { id: "detonator", kind: "passive", price: 24, name: "Детонатор",
          desc: "Убитые враги взрываются: 20 урона в радиусе 70." }
    ];

    LIST.forEach(function (d) { M.registerModifier(d); });

    /* ======================== ВСПОМОГАТЕЛЬНОЕ ========================== */

    function owns(id) { return M.owns(id); }
    function levelNow() { return M.state(); }
    function now(lvl) { return lvl.game.time.now; }

    /* Временные множители свойств игрока (складываются между собой). */
    function bump(p, prop, mul, seconds) {
        p.__at2bumps = p.__at2bumps || [];
        if (p.__at2baseProps == null) p.__at2baseProps = {};
        if (p.__at2baseProps[prop] == null) p.__at2baseProps[prop] = p[prop];
        p.__at2bumps.push({ prop: prop, mul: mul, until: Date.now() + seconds * 1000 });
    }
    function tickBumps(p) {
        if (!p.__at2bumps || !p.__at2bumps.length) return;
        var t = Date.now(), alive = [];
        for (var i = 0; i < p.__at2bumps.length; i++) if (p.__at2bumps[i].until > t) alive.push(p.__at2bumps[i]);
        p.__at2bumps = alive;
        Object.keys(p.__at2baseProps).forEach(function (prop) {
            var mul = 1;
            alive.forEach(function (b) { if (b.prop === prop) mul *= b.mul; });
            p[prop] = p.__at2baseProps[prop] * mul;
        });
    }

    /* Множители оружия (урон/темп) — с восстановлением базовых значений. */
    function weaponList(p) {
        var list = [];
        (p.weapons || []).forEach(function (w) { if (w) list.push(w); });
        if (p.mines) list.push(p.mines);
        return list;
    }
    function scaleWeapons(p, dmg, rate) {
        weaponList(p).forEach(function (w) {
            if (w.__at2dmgBase == null) w.__at2dmgBase = w.damage;
            if (w.__at2rateBase == null) w.__at2rateBase = w.rate;
            if (dmg != null) w.damage = w.__at2dmgBase * dmg;
            if (rate != null) w.rate = w.__at2rateBase * rate;
        });
    }
    function restoreWeapons(p) { scaleWeapons(p, 1, 1); }

    function heal(p, n) {
        if (!p) return;
        p.health = Math.min(p.maxHealth, p.health + n);
        try { var lvl = levelNow(); if (lvl && lvl.hud) lvl.hud.healthVial.updateProgress(p.health / p.maxHealth, 5); } catch (e) { }
    }

    /* Снять «призрачную» неуязвимость, когда истекут её 1.5 с.
       Раньше проверка была одна и при активном щите/ноуклипе флаг invincible
       оставался включённым навсегда — игрок становился бессмертным молча. */
    function armGhostOff(lvl, p) {
        p.__at2ghostUntil = Date.now() + 1500;
        if (p.__at2ghostTick) return;
        p.__at2ghostTick = lvl.game.time.events.loop(250, function () {
            var now = Date.now();
            if (now < p.__at2ghostUntil) return;
            if (p.__at2shield || p.__at2noclip) return;      // их неуязвимость своя — проверим позже
            p.invincible = false;
            try { lvl.game.time.events.remove(p.__at2ghostTick); } catch (e) { }
            p.__at2ghostTick = null;
        });
    }

    function enemiesIn(lvl, x, y, r) {
        var out = [], list = (lvl && lvl.enemies) ? lvl.enemies : [];
        for (var i = 0; i < list.length; i++) {
            var e = list[i];
            if (!e || !e.alive || !e.body) continue;
            var dx = e.body.x - x, dy = e.body.y - y;
            if (dx * dx + dy * dy <= r * r) out.push(e);
        }
        return out;
    }

    function toast(text, color) { if (M.toast) M.toast(text, color); }
    function fakeWeapon(p) { return (p && p.weapon) || { hitColor: 16777215, damage: 0 }; }

    /* ============================ ЭФФЕКТЫ ============================== */

    function playerFilterHit(lvl, x1, y1, x2, y2) {
        // Возвращает первый объект на пути (или null, если путь свободен).
        try {
            var hits = lvl.physics.box2d.raycast(x1, y1, x2, y2, true);
            for (var i = 0; hits && i < hits.length; i++) {
                var b = hits[i] && hits[i].body;
                if (!b || !b.sprite) continue;
                return b;
            }
        } catch (e) { }
        return null;
    }

    /* Пока щит или ноуклип активны, урон не должен проходить вообще.
       Родной путь урона (Tank.onBulletHit) сам проверяет this.invincible, но
       взрывы, огонь и прямые вызовы damage() могут его обойти — поэтому
       закрываем и сам метод на время эффекта. */
    function guardDamage(p) {
        if (p.__at2dmgOrig) return;
        p.__at2dmgOrig = p.damage;
        p.damage = function (t) {
            if (p.__at2shield || p.__at2noclip || p.invincible) return this;
            return p.__at2dmgOrig.apply(this, arguments);
        };
    }

    var EFFECTS = {
        /* ------------------------------------------------------------- */
        noclip: {
            run: function (lvl, p) {
                if (p.__at2noclip) { toast("Ноуклип уже активен", "#ffd27f"); return false; }
                var st = { wasInvincible: p.invincible, extends: 0 };
                try {
                    var fx = p.body.data.GetFixtureList();
                    st.mask = fx ? fx.GetFilterData().maskBits : 0xFFFF;
                } catch (e) { st.mask = 0xFFFF; }
                p.__at2noclip = st;
                p.invincible = true;
                guardDamage(p);
                try {
                    p.body.setCollisionMask(0);
                    p.bodySprite.tint = 0x66fff0;
                    p.turretSprite.tint = 0x66fff0;
                } catch (e) { }
                toast("НОУКЛИП: 5 с сквозь стены и пули");
                st.timer = lvl.game.time.events.add(5000, function () { EFFECTS.noclip.off(lvl, p); });
                return true;
            },
            off: function (lvl, p) {
                var st = p.__at2noclip;
                if (!st) return;
                var tx = lvl.pxToTile(p.body.x), ty = lvl.pxToTile(p.body.y);
                if (!lvl.isTileFree(tx, ty) && st.extends < 4) {
                    st.extends += 1;
                    toast("Стена вокруг — ноуклип продлён");
                    st.timer = lvl.game.time.events.add(1500, function () { EFFECTS.noclip.off(lvl, p); });
                    return;
                }
                p.__at2noclip = null;
                try {
                    p.body.setCollisionMask(st.mask == null ? 0xFFFF : st.mask);
                    p.bodySprite.tint = 0xffffff;
                    p.turretSprite.tint = 0xffffff;
                } catch (e) { }
                p.invincible = !!st.wasInvincible;
                toast("Ноуклип выключен", "#ffd27f");
            }
        },
        /* ------------------------------------------------------------- */
        dash: {
            run: function (lvl, p) {
                bump(p, "moveSpeed", 3, 0.25);
                p.__at2dashUntil = Date.now() + 250;
                try {
                    lvl.spawnSmoke(p.bodyX, p.bodyY, 6);
                    lvl.shakeCamera(3);
                } catch (e) { }
                toast("РЫВОК!");
                return true;
            }
        },
        /* ------------------------------------------------------------- */
        shield: {
            run: function (lvl, p) {
                p.__at2shield = (p.__at2shield || 0) + 1;
                p.__at2shieldHp = p.health;      // это здоровье и держим, пока щит активен
                p.invincible = true;
                guardDamage(p);
                /* Держим здоровье: одного флага invincible мало — взрывы, огонь и
                   «касание» врага вычитают здоровье мимо него. Пока щит активен,
                   возвращаем полное здоровье каждый кадр (см. M.lockShield). */
                if (M.lockShield) M.lockShield(true);

                var ring = null;
                try {
                    ring = lvl.add.graphics(0, 0);
                    ring.lineStyle(3, 0x7ce7ff, .9);
                    ring.drawCircle(0, 0, 30);
                    var layer = lvl.objectsLayer || lvl.topLayer;
                    if (layer && layer.add) layer.add(ring);
                } catch (e) { }
                var follow = lvl.game.time.events.loop(16, function () {
                    try { if (ring) ring.position.set(p.bodyX, p.bodyY); } catch (e) { }
                });
                lvl.game.time.events.add(6000, function () {
                    p.__at2shield = Math.max(0, (p.__at2shield || 1) - 1);
                    if (!p.__at2shield) p.invincible = false;
                    try { lvl.game.time.events.remove(follow); if (ring) ring.destroy(); } catch (e) { }
                });
                toast("ЩИТ: 6 с неуязвимости");
                return true;
            }
        },
        /* ------------------------------------------------------------- */
        timeslow: {
            run: function (lvl, p) {
                if (lvl.freezeTime > 0) { toast("Уже заморожено", "#ffd27f"); return false; }
                if (lvl.freezeEnemies) lvl.freezeEnemies();
                lvl.freezeTime = 3;
                toast("ХРОНОМЕТР: враги заморожены");
                return true;
            }
        },
        /* ------------------------------------------------------------- */
        nuke: {
            run: function (lvl, p) {
                var x = p.bodyX, y = p.bodyY, r = 260;
                enemiesIn(lvl, x, y, r).forEach(function (e) {
                    try { e.onBulletHit(200 * (1 - .4 * (Math.sqrt((e.body.x - x) * (e.body.x - x) + (e.body.y - y) * (e.body.y - y)) / r)), fakeWeapon(p), e.body, true); } catch (err) { }
                });
                try {
                    lvl.explosions.explode(x, y, r, 0);
                    lvl.spawnSparks(x, y, 0, Math.PI * 2, 420, 24);
                    lvl.shakeCamera(22);
                    window.AT.audio.playSound("explosion.mp3");
                } catch (e) { }
                toast("ЯДЕРНЫЙ ЗАЛП!", "#ff9f6a");
                return true;
            }
        },
        /* ------------------------------------------------------------- */
        teleport: {
            run: function (lvl, p) {
                var mp = lvl.input.mousePointer, x = mp.worldX, y = mp.worldY;
                if (!x && !y) { toast("Нужен курсор", "#ffd27f"); return false; }
                /* держим цель внутри карты: иначе блинк уносил танк за её пределы */
                var T = window.AT.SETTINGS.TILE_SIZE || 52;
                var maxX = ((lvl.width || 40) - 1) * T, maxY = ((lvl.height || 40) - 1) * T;
                x = Math.max(T, Math.min(maxX, x));
                y = Math.max(T, Math.min(maxY, y));
                if (playerFilterHit(lvl, p.body.x, p.body.y, x, y)) { toast("Путь перекрыт", "#ffb0b0"); return false; }
                try {
                    lvl.spawnSmoke(p.bodyX, p.bodyY, 8);
                    p.body.x = x; p.body.y = y;
                    p.body.velocity.x = p.body.velocity.y = 0;
                    lvl.spawnSmoke(x, y, 8);
                } catch (e) { return false; }
                toast("БЛИНК");
                return true;
            }
        },
        /* ------------------------------------------------------------- */
        wave: {
            run: function (lvl, p) {
                var x = p.bodyX, y = p.bodyY, r = 190;
                enemiesIn(lvl, x, y, r).forEach(function (e) {
                    try {
                        var dx = e.body.x - x, dy = e.body.y - y, d = Math.max(1, Math.sqrt(dx * dx + dy * dy));
                        e.body.velocity.x += dx / d * 420;
                        e.body.velocity.y += dy / d * 420;
                        e.onBulletHit(6, fakeWeapon(p), e.body, true);
                    } catch (err) { }
                });
                try {
                    lvl.explosions.explode(x, y, r, 0);
                    lvl.shakeCamera(10);
                } catch (e) { }
                toast("УДАРНАЯ ВОЛНА");
                return true;
            }
        },
        /* ------------------------------------------------------------- */
        overdrive: {
            run: function (lvl, p) {
                bump(p, "moveSpeed", 1.6, 6);
                scaleWeapons(p, null, 1.6);
                p.__at2over = true;
                toast("ФОРСАЖ: +60% скорость и темп огня");
                lvl.game.time.events.add(6000, function () { p.__at2over = false; restoreWeapons(p); });
                return true;
            }
        },
        /* ------------------------------------------------------------- */
        berserk: {
            run: function (lvl, p) {
                if (p.health <= 3) { toast("Мало HP для берсерка", "#ffb0b0"); return false; }
                p.health -= 3;
                scaleWeapons(p, 2, null);
                p.__at2berserk = true;
                toast("БЕРСЕРК: ×2 урон на 5 с");
                lvl.game.time.events.add(5000, function () { p.__at2berserk = false; restoreWeapons(p); });
                return true;
            }
        }
    };

    /* ============================= УСТАНОВКА =========================== */

    var installed = {};

    function applyPassives(lvl, p) {
        if (owns("armor2") && !p.__at2armor) {
            p.__at2armor = true;
            p.maxHealth = Math.round(p.maxHealth * 1.25);
            p.health = p.maxHealth;
        }
        if (owns("wheels")) bump(p, "moveSpeed", 1.18, 1e9);
        if (owns("wheels_grip")) bump(p, "moveSpeed", 1.12, 1e9);
        if (owns("wheels_turn")) bump(p, "turretSpeed", 1.45, 1e9);
        if (owns("scanner")) {
            try {
                var n = (lvl.width || 40) + 4, m = (lvl.height || 40) + 4;
                for (var x = -2; x < n; x++) for (var y = -2; y < m; y++) lvl.fog.revealTile(x, y);
            } catch (e) { }
        }
        if (owns("ammo2")) {
            weaponList(p).forEach(function (w) {
                if (!isFinite(w.maxAmmo)) return;
                w.maxAmmo = Math.round(w.maxAmmo * 1.3);
                w.ammo = Math.min(w.maxAmmo, Math.round(w.ammo + w.maxAmmo * .3));
            });
        }
    }

    var CD = {};   // id -> остаток перезарядки в секундах

    function bindActives(lvl, p) {
        LIST.forEach(function (d) {
            if (d.kind !== "active") return;
            if (!owns(d.id)) return;
            var uses = d.uses == null ? Infinity : d.uses;
            try {
                lvl.addKey(d.key, function () {
                    if (!p.reallyAlive || lvl.gamePaused || lvl.summaryAlert) return;
                    if ((CD[d.id] || 0) > 0) { toast(d.name + ": перезарядка " + Math.ceil(CD[d.id]) + " с", "#ffd27f"); return; }
                    if (uses <= 0) { toast(d.name + ": заряды кончились", "#ffb0b0"); return; }
                    var fx = EFFECTS[d.id];
                    if (!fx || !fx.run) return;
                    var ok = fx.run(lvl, p, d);
                    if (ok === false) return;
                    if (uses !== Infinity) uses -= 1;
                    CD[d.id] = d.cd || 0;
                }, lvl, []);
            } catch (e) { M.warn("клавиша " + d.key + ":", e); }
        });
    }

    function tickActives(lvl, dt) {
        Object.keys(CD).forEach(function (k) { if (CD[k] > 0) CD[k] = Math.max(0, CD[k] - dt); });
    }

    function onLevelCreate(lvl) {
        var p = lvl && lvl.player;
        if (!p) return;
        try {
            p.__at2baseProps = {};
            p.__at2bumps = [];
            applyPassives(lvl, p);
            bindActives(lvl, p);
            CD = {};
            p.__at2lastHealth = p.health;
            p.__at2ramCd = 0;
            M.log("модификаторы: активно " + M.ownedModifierDefs().length + " из " + LIST.length);
        } catch (e) { M.warn("установка модификаторов:", e); }
    }

    function onLevelUpdate(lvl, dt) {
        var p = lvl && lvl.player;
        if (!p) return;
        tickBumps(p);
        tickActives(lvl, dt);

        if (owns("ghost")) {
            if (p.__at2lastHealth != null && p.health < p.__at2lastHealth) {
                p.invincible = true;
                armGhostOff(lvl, p);
                toast("Призрак: 1.5 с неуязвимости", "#c9a0ff");
            }
            p.__at2lastHealth = p.health;
        }

        if (owns("magnet") && lvl.groundLayer) {
            var kids = lvl.groundLayer.children;
            for (var i = 0; i < kids.length; i++) {
                var c = kids[i];
                if (!c || !c.alive || typeof c.x !== "number") continue;
                if (!(window.AT.bonus.Bonus && c instanceof window.AT.bonus.Bonus)) continue;
                var dx = p.bodyX - c.x, dy = p.bodyY - c.y;
                var d2 = dx * dx + dy * dy;
                if (d2 < 14400 && d2 > 400) {
                    var d = Math.sqrt(d2);
                    c.x += dx / d * 3.4;
                    c.y += dy / d * 3.4;
                }
            }
        }

        if (owns("wheels_grip")) {
            p.__at2ramCd -= dt;
            if (p.__at2ramCd <= 0 && p._at2speed > p.moveSpeed * .55) {
                var near = enemiesIn(lvl, p.bodyX, p.bodyY, 42);
                if (near.length) {
                    p.__at2ramCd = .4;
                    try {
                        near[0].onBulletHit(12, fakeWeapon(p), near[0].body, true);
                        lvl.spawnSparks(p.bodyX, p.bodyY, 0, Math.PI * 2, 200, 4);
                        lvl.shakeCamera(4);
                    } catch (e) { }
                }
            }
        }
    }

    /* Урон по врагам от «Детонатора» — через событие ядра. */
    function onEnemyKilled(info) {
        if (!info || !info.enemy || !owns("detonator")) return;
        var lvl = info.level, e = info.enemy;
        try {
            var x = e.body ? e.body.x : e.x, y = e.body ? e.body.y : e.y;
            enemiesIn(lvl, x, y, 70).forEach(function (t) {
                if (t === e) return;
                try { t.onBulletHit(20, e.weapon || { hitColor: 16777215 }, t.body, true); } catch (err) { }
            });
            if (lvl.explosions) lvl.explosions.explode(x, y, 70, 0);
            lvl.spawnSparks(x, y, 0, Math.PI * 2, 260, 8);
        } catch (err) { }
    }

    function onEnemyKilledVampire(info) {
        if (!info || !info.enemy || !owns("vampire")) return;
        heal(info.level.player, 2);
    }

    /* ============================== ПАК ================================ */

    M.registerPack({
        id: "at2-modifiers",
        name: "Awesome Tanks 2.0 — модификаторы",
        version: "3.2.0",

        onReady: function () {
            var g = window.AT.game;
            if (g && g.state && g.state.states) {
                Object.keys(g.state.states).forEach(function (key) {
                    var st = g.state.states[key];
                    if (!st || installed[key] || !/^Level\d+$/.test(key)) return;
                    installed[key] = true;

                    M.wrap(st, "create", function (orig) {
                        return function () {
                            var r = orig.apply(this, arguments);
                            onLevelCreate(this);
                            return r;
                        };
                    });

                    M.wrap(st, "update", function (orig) {
                        return function () {
                            var dt = Math.min(this.game.time.physicsElapsed || 1 / 60, 1 / 30);
                            onLevelUpdate(this, dt);
                            return orig.apply(this, arguments);
                        };
                    });
                });
            }
            M.on("enemyKilled", onEnemyKilled);
            M.on("enemyKilled", onEnemyKilledVampire);
            M.log("модификаторы 2.0 в строю: " + LIST.length + " штук, валюта — ядра (◈)");
        }
    });

    /* ============================ ЭКСПОРТ ============================== */

    M.MODIFIERS = LIST;
    M.mods = {
        list: function () {
            return LIST.map(function (d) {
                return {
                    id: d.id, name: d.name, desc: d.desc, kind: d.kind, key: d.key || null,
                    cd: d.cd || 0, uses: d.uses == null ? null : d.uses,
                    price: d.price, owned: owns(d.id),
                    cooldown: Math.ceil(CD[d.id] || 0)
                };
            });
        },
        buy: function (id) {
            var r = M.buyModifier(id);
            if (r.ok) toast("Куплено: " + r.def.name, "#9fffb0");
            return r;
        },
        owns: owns,
        count: function () { return M.ownedModifierDefs().length; },
        cooldowns: function () { return Object.assign({}, CD); },
        /** Сбросить кулдауны (отладка). */
        resetCooldowns: function () { CD = {}; }
    };
})();
