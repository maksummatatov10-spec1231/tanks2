/*!
 * Awesome Tanks 2.0 — арсенал (at2-weapons.js)
 * -----------------------------------------------------------------------------
 * ШЕСТЬ новых пушек в дополнение к десяти ванильным. Ничего не заменяется:
 * старые стволы, их уровни и патроны остаются как были.
 *
 *   Z  «Шквал»      — тройной веер, бесконечный боезапас, высокий темп
 *   X  «Плазмаган»  — плазменные снаряды со сплэшем по площади
 *   C  «Осколочница»— снаряд дробится на шесть осколков при попадании
 *   V  «Пронзатель» — иглы, прошивающие до 3-5 врагов насквозь
 *   B  «Рой»        — залп из трёх самонаводящихся ракет
 *   N  «Тесла»      — мгновенная молния, перескакивающая до 3 целей
 *
 * Покупка и апгрейды — за обычные деньги в хаб-экране 2.0; патроны там же.
 * Прогресс хранится в сохранении игры (ключ mod.weapons), игра не ломается.
 *
 * Требует: mod-loader.js (+ at2-core.js для событий уровня).
 * Лицензия: MIT. Игровых файлов не содержит — только код и свои числа.
 * ========================================================================== */
(function () {
    "use strict";

    var M = window.MOD;
    if (!M) { console.warn("[at2-weapons] нужен mod-loader.js"); return; }

    /* ============================ ТАБЛИЦА ============================== */

    // Цены: [покупка, апгрейд 1→2, 2→3, 3→4]. Числа — наши собственные.
    var ARSENAL = [
        {
            id: "storm", name: "«Шквал»", key: "Z",
            desc: "Скорострельный тройной веер. Бесконечный боезапас, малый урон за пулю.",
            prices: [5000, 1500, 2500, 3500],
            ammo: [Infinity, Infinity, Infinity, Infinity], ammoPrice: 0, ammoAmount: 0,
            dmg: [3, 4, 5, 6], rate: [11, 13, 15, 17]
        },
        {
            id: "plasma", name: "«Плазмаган»", key: "X",
            desc: "Плазменные сгустки: взрыв по площади 44 px, урон падает к краю.",
            prices: [14000, 4000, 6000, 9000],
            ammo: [120, 140, 160, 180], ammoPrice: 250, ammoAmount: 60,
            dmg: [14, 18, 23, 30], rate: [3.2, 3.6, 4, 4.4]
        },
        {
            id: "shrapnel", name: "«Осколочница»", key: "C",
            desc: "Тяжёлый снаряд: при попадании рассыпается на шесть осколков.",
            prices: [18000, 5000, 8000, 12000],
            ammo: [70, 80, 90, 100], ammoPrice: 300, ammoAmount: 35,
            dmg: [22, 28, 35, 45], rate: [1.5, 1.7, 1.9, 2.1]
        },
        {
            id: "piercer", name: "«Пронзатель»", key: "V",
            desc: "Иглы насквозь: прошивают 3-5 врагов, не останавливаясь.",
            prices: [22000, 6000, 9000, 14000],
            ammo: [200, 240, 280, 320], ammoPrice: 350, ammoAmount: 100,
            dmg: [9, 12, 16, 21], rate: [4.2, 4.8, 5.4, 6], pierce: [3, 4, 4, 5]
        },
        {
            id: "swarm", name: "«Рой»", key: "B",
            desc: "Залп из трёх самонаводящихся ракет с дымным следом.",
            prices: [30000, 8000, 12000, 18000],
            ammo: [60, 72, 84, 96], ammoPrice: 400, ammoAmount: 30,
            dmg: [16, 21, 27, 35], rate: [1.1, 1.25, 1.4, 1.55]
        },
        {
            id: "tesla", name: "«Тесла»", key: "N",
            desc: "Мгновенная молния: бьёт цель и перескакивает ещё на две рядом.",
            prices: [38000, 10000, 15000, 22000],
            ammo: [40, 50, 60, 72], ammoPrice: 500, ammoAmount: 20,
            dmg: [30, 40, 52, 68], rate: [0.9, 1, 1.1, 1.25]
        }
    ];

    var FIRST_INDEX = 10;   // индексы 0..9 заняты ванильными стволами (+ мины отдельно)

    /* ======================== СОСТОЯНИЕ/ПОКУПКИ ========================= */

    function slot(id) {
        var d = M.data();
        if (!d.weapons[id]) d.weapons[id] = { level: -1, ammo: 0 };
        return d.weapons[id];
    }
    function def(id) {
        for (var i = 0; i < ARSENAL.length; i++) if (ARSENAL[i].id === id) return ARSENAL[i];
        return null;
    }
    function idxOf(id) {
        for (var i = 0; i < ARSENAL.length; i++) if (ARSENAL[i].id === id) return FIRST_INDEX + i;
        return -1;
    }

    var SHOP = {
        list: function () {
            return ARSENAL.map(function (a) {
                var s = slot(a.id);
                return {
                    id: a.id, name: a.name, key: a.key, desc: a.desc,
                    level: s.level, ammo: s.ammo, maxAmmo: a.ammo[Math.max(0, s.level)],
                    price: s.level < 0 ? a.prices[0] : (s.level < 3 ? a.prices[s.level + 1] : null),
                    ammoPrice: a.ammoPrice, ammoAmount: a.ammoAmount,
                    owned: s.level >= 0
                };
            });
        },
        buy: function (id) {
            var a = def(id), s = slot(id);
            if (!a) return { ok: false, reason: "нет такого оружия" };
            if (s.level >= 0) return { ok: false, reason: "уже куплено" };
            if (!M.spendMoney(a.prices[0])) return { ok: false, reason: "не хватает денег" };
            s.level = 0;
            s.ammo = a.ammo[0] === Infinity ? Infinity : a.ammo[0];
            M.save();
            M.emit("weaponBought", id);
            return { ok: true, def: a };
        },
        upgrade: function (id) {
            var a = def(id), s = slot(id);
            if (!a || s.level < 0) return { ok: false, reason: "сначала купите оружие" };
            if (s.level >= 3) return { ok: false, reason: "максимальный уровень" };
            if (!M.spendMoney(a.prices[s.level + 1])) return { ok: false, reason: "не хватает денег" };
            s.level += 1;
            if (a.ammo[s.level] !== Infinity && s.ammo < a.ammo[s.level]) s.ammo = a.ammo[s.level];
            M.save();
            M.emit("weaponUpgraded", id);
            return { ok: true, def: a, level: s.level };
        },
        buyAmmo: function (id) {
            var a = def(id), s = slot(id);
            if (!a || s.level < 0) return { ok: false, reason: "оружие не куплено" };
            if (a.ammoPrice <= 0) return { ok: false, reason: "боезапас бесконечный" };
            var max = a.ammo[s.level];
            if (s.ammo >= max) return { ok: false, reason: "полный боезапас" };
            if (!M.spendMoney(a.ammoPrice)) return { ok: false, reason: "не хватает денег" };
            s.ammo = Math.min(max, s.ammo + a.ammoAmount);
            M.save();
            M.emit("weaponAmmo", id);
            return { ok: true, ammo: s.ammo, max: max };
        }
    };

    /* ============================ КЛАССЫ =============================== */

    var WB = null, CG = null, TEAMS = null, AUDIO = null, PhaserNS = null;

    function levelOf(w) { return w.game.state.getCurrentState(); }

    function inherit(cls, base) {
        cls.prototype = Object.create(base.prototype);
        cls.prototype.constructor = cls;
    }

    function enemyList(lvl) {
        return (lvl && lvl.enemies) ? lvl.enemies : [];
    }

    function isEnemySprite(spr, lvl) {
        // Всё, что лежит в level.enemies, — враги (танки, боссы, камикадзе).
        var list = enemyList(lvl);
        for (var i = 0; i < list.length; i++) if (list[i] === spr) return true;
        return false;
    }

    function buildClasses() {
        WB = window.AT.weapon.Weapon;
        CG = window.AT.common.COLLISION_GROUPS;
        TEAMS = window.AT.common.TEAMS;
        AUDIO = window.AT.audio;
        PhaserNS = window.Phaser;

        /* ------------------------- 1. Шквал --------------------------- */
        function At2Storm(tank, cfg) {
            WB.call(this, tank, cfg);
            this.velocity = 780;
            this.spread = Math.PI / 12;
            this.bulletFrameName = "game/projectiles/minigun.png";
        }
        inherit(At2Storm, WB);
        At2Storm.prototype.spawnBullet = function (i, a) {
            var b = WB.prototype.spawnBullet.call(this, i, a);
            try {
                b.tint = 0x9fe8ff;
                var lvl = levelOf(this);
                if (lvl) lvl.spawnSparks(b.body.x + 10 * Math.cos(a), b.body.y + 10 * Math.sin(a), a, .15 * Math.PI, 250, 2);
                this.tank.recoil = 2;
                AUDIO.playSound("minigun.mp3", .8);
            } catch (e) { }
            return b;
        };

        /* ------------------------ 2. Плазмаган ------------------------ */
        function At2Plasma(tank, cfg) {
            WB.call(this, tank, cfg);
            this.velocity = 620;
            this.bulletFrameName = "game/projectiles/plasma.png";
            this.radius = 44;
        }
        inherit(At2Plasma, WB);
        At2Plasma.prototype.spawnBullet = function (i, a) {
            var b = WB.prototype.spawnBullet.call(this, i, a);
            try {
                b.tint = 0x7cf0ff;
                this.tank.recoil = 4;
                AUDIO.playSound("cannon.mp3", .9);
            } catch (e) { }
            return b;
        };
        At2Plasma.prototype.onBulletHitWall = function (body, other, fx, ofx, contact, oldM) {
            if (contact && body.sprite && body.sprite.alive) splash(this, body.x, body.y);
            return WB.prototype.onBulletHitWall.call(this, body, other, fx, ofx, contact, oldM);
        };
        At2Plasma.prototype.onBulletHitObject = function (body, other, fx, ofx, contact, oldM) {
            if (other === this.tank.body) return;
            if (!contact || !body.sprite || !body.sprite.alive) return;
            splash(this, body.x, body.y);
            if (other.sprite && other.sprite.onBulletHit) other.sprite.onBulletHit(this.damage, this, body, contact);
            try {
                var lvl = levelOf(this);
                lvl.starEmitter.emitParticle(body.x, body.y, "game.png", "game/particles/star_object.png");
            } catch (e) { }
            body.sprite.kill();
            if (body.setZeroVelocity) body.setZeroVelocity();
        };

        function splash(w, x, y) {
            var lvl = levelOf(w);
            if (!lvl) return;
            var r = w.radius || 40, list = enemyList(lvl);
            for (var i = 0; i < list.length; i++) {
                var e = list[i];
                if (!e || !e.alive || !e.body || !e.onBulletHit) continue;
                var dx = e.body.x - x, dy = e.body.y - y;
                var d = Math.sqrt(dx * dx + dy * dy);
                if (d > r) continue;
                e.onBulletHit(w.damage * (1 - .5 * d / r), w, e.body, true);
            }
            try {
                if (lvl.explosions) lvl.explosions.explode(x, y, r, 0);
                lvl.spawnSparks(x, y, 0, Math.PI * 2, 220, 6);
                AUDIO.playSound("explosion.mp3", .35);
            } catch (e) { }
        }

        /* ----------------------- 3. Осколочница ----------------------- */
        function At2Shrapnel(tank, cfg) {
            WB.call(this, tank, cfg);
            this.velocity = 700;
            this.bulletFrameName = "game/projectiles/cannon.png";
            this.fragments = 6;
        }
        inherit(At2Shrapnel, WB);
        At2Shrapnel.prototype.spawnBullet = function (i, a) {
            var b = WB.prototype.spawnBullet.call(this, i, a);
            try {
                b.tint = 0xffd27f;
                this.tank.recoil = 5;
                AUDIO.playSound("cannon.mp3");
            } catch (e) { }
            return b;
        };
        At2Shrapnel.prototype.onBulletHitWall = function (body, other, fx, ofx, contact, oldM) {
            if (contact && body.sprite && body.sprite.alive && !body.sprite.__at2frag) this.burst(body);
            return WB.prototype.onBulletHitWall.call(this, body, other, fx, ofx, contact, oldM);
        };
        At2Shrapnel.prototype.burst = function (body) {
            var lvl = levelOf(this);
            for (var i = 0; i < this.fragments; i++) {
                try {
                    var a = Math.random() * Math.PI * 2;
                    var b = this.getBullet();
                    b.__at2frag = true;
                    b.tint = 0xffc060;
                    b.body.x = body.x;
                    b.body.y = body.y;
                    b.body.velocity.x = Math.cos(a) * 500;
                    b.body.velocity.y = Math.sin(a) * 500;
                    b.body.rotation = a;
                    b.lifespan = 380;
                    if (lvl) lvl.spawnSparks(body.x, body.y, a, .1 * Math.PI, 180, 1);
                } catch (e) { }
            }
            try { AUDIO.playSound("bullet_hit.mp3"); } catch (e) { }
        };

        /* ------------------------ 4. Пронзатель ----------------------- */
        function At2Piercer(tank, cfg) {
            WB.call(this, tank, cfg);
            this.velocity = 900;
            this.bulletFrameName = "game/projectiles/railgun_1.png";
            this.pierce = cfg && cfg.pierce ? cfg.pierce : 3;
        }
        inherit(At2Piercer, WB);
        At2Piercer.prototype.skipCollision = function (body, other, fx, ofx, contact) {
            if (contact && contact.SetEnabled) contact.SetEnabled(false);
        };
        At2Piercer.prototype.createBullet = function () {
            var b = WB.prototype.createBullet.call(this);
            if (this.team === TEAMS.PLAYER) b.body.setCategoryPresolveCallback(CG.ENEMY, this.skipCollision, this);
            else b.body.setCategoryPresolveCallback(CG.PLAYER, this.skipCollision, this);
            b.body.data.SetUserData({ hits: 0 });
            return b;
        };
        At2Piercer.prototype.spawnBullet = function (i, a) {
            var b = WB.prototype.spawnBullet.call(this, i, a);
            try {
                b.body.sensor = false;
                b.body.restitution = 0;
                b.body.fixedRotation = true;
                b.tint = 0xd0a0ff;
                var d = b.body.data.GetUserData();
                if (d) d.hits = this.pierce || 3;
                this.tank.recoil = 3;
                AUDIO.playSound("railgun.mp3", .6);
            } catch (e) { }
            return b;
        };
        At2Piercer.prototype.onBulletHitWall = function (body, other, fx, ofx, contact, oldM) {
            if (!contact || !body.sprite || !body.sprite.alive) return;
            try {
                var lvl = levelOf(this);
                if (lvl) {
                    lvl.spawnSparks(body.x, body.y, 0, Math.PI * 2, 160, 3);
                    lvl.starEmitter.emitParticle(body.x, body.y, "game.png", "game/particles/star_object.png");
                }
                AUDIO.playSound("bullet_hit.mp3", .7);
            } catch (e) { }
            body.sprite.kill();
            if (body.setZeroVelocity) body.setZeroVelocity();
        };
        At2Piercer.prototype.onBulletHitObject = function (body, other, fx, ofx, contact, oldM) {
            if (other === this.tank.body || !contact || !body.sprite || !body.sprite.alive) return;
            if (other.sprite && other.sprite.onBulletHit) other.sprite.onBulletHit(this.damage, this, body, contact);
            var d = body.data.GetUserData();
            if (d && d.hits > 1) {
                d.hits -= 1;
                try {
                    var lvl = levelOf(this);
                    if (lvl) lvl.spawnSparks(body.x, body.y, body.body ? 0 : 0, Math.PI * 2, 140, 2);
                } catch (e) { }
                return;   // летим дальше — насквозь
            }
            body.sprite.kill();
            if (body.setZeroVelocity) body.setZeroVelocity();
        };

        /* --------------------------- 5. Рой --------------------------- */
        function At2Missile(game, x, y, key, frame) {
            PhaserNS.Sprite.call(this, game, x, y, key, frame);
            this.anchor.set(.5, .5);
            this.at2speed = 260;
            this.at2weapon = null;
            this.at2smoke = 0;
        }
        inherit(At2Missile, PhaserNS.Sprite);
        At2Missile.prototype.update = function () {
            if (!this.alive || !this.body || !this.at2weapon) return;
            var w = this.at2weapon, lvl = levelOf(w);
            if (!lvl) return;
            var dt = Math.min(this.game.time.physicsElapsed || 1 / 60, 1 / 30);

            var list = enemyList(lvl), best = null, bd = Infinity;
            for (var i = 0; i < list.length; i++) {
                var e = list[i];
                if (!e || !e.alive || !e.body) continue;
                var dx = e.body.x - this.body.x, dy = e.body.y - this.body.y, d2 = dx * dx + dy * dy;
                if (d2 < bd) { bd = d2; best = e; }
            }
            if (best) {
                var want = Math.atan2(best.body.y - this.body.y, best.body.x - this.body.x);
                var cur = this.body.rotation;
                var diff = ((want - cur + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
                var turn = 6 * dt;
                this.body.rotation = Math.abs(diff) <= turn ? want : cur + Math.sign(diff) * turn;
                this.at2speed = Math.min(this.at2speed + 620 * dt, w.velocity || 560);
            }
            this.body.velocity.x = Math.cos(this.body.rotation) * this.at2speed;
            this.body.velocity.y = Math.sin(this.body.rotation) * this.at2speed;

            this.at2smoke -= dt;
            if (this.at2smoke <= 0) {
                this.at2smoke = 1 / 8;
                try {
                    lvl.smokeEmitter.emitParticle(this.body.x - 7 * Math.cos(this.body.rotation),
                                                  this.body.y - 7 * Math.sin(this.body.rotation));
                } catch (e) { }
            }
        };

        function At2Swarm(tank, cfg) {
            WB.call(this, tank, cfg);
            this.velocity = 560;
            this.bulletFrameName = "game/projectiles/rocket_0.png";
            this.spawnCount = 3;
            this.spread = Math.PI / 5;
            this.radius = 40;
        }
        inherit(At2Swarm, WB);
        At2Swarm.prototype.newBullet = function () {
            var b = new At2Missile(this.game, 0, 0, "game.png", this.bulletFrameName);
            b.at2weapon = this;
            return b;
        };
        At2Swarm.prototype.spawnBullet = function (i, a) {
            var b = WB.prototype.spawnBullet.call(this, i, a);
            try {
                b.body.rotation = a;
                b.at2speed = 240;
                b.tint = 0xffb0b0;
                this.tank.recoil = 4;
                AUDIO.playSound("rocket.mp3", .7);
            } catch (e) { }
            return b;
        };
        At2Swarm.prototype.onBulletHitWall = function (body, other, fx, ofx, contact, oldM) {
            if (contact && body.sprite && body.sprite.alive) splash(this, body.x, body.y);
            return WB.prototype.onBulletHitWall.call(this, body, other, fx, ofx, contact, oldM);
        };
        At2Swarm.prototype.onBulletHitObject = function (body, other, fx, ofx, contact, oldM) {
            if (other === this.tank.body) return;
            if (!contact || !body.sprite || !body.sprite.alive) return;
            splash(this, body.x, body.y);
            if (other.sprite && other.sprite.onBulletHit) other.sprite.onBulletHit(this.damage, this, body, contact);
            body.sprite.kill();
            if (body.setZeroVelocity) body.setZeroVelocity();
        };

        /* -------------------------- 6. Тесла -------------------------- */
        function At2Tesla(tank, cfg) {
            WB.call(this, tank, cfg);
            this.life = 0;
            this.radius = 170;     // радиус перескока молнии
        }
        inherit(At2Tesla, WB);
        At2Tesla.prototype.shoot = function () {
            var lvl = levelOf(this), tank = this.tank;
            if (!lvl) return;
            var a = tank.turretRotation;
            var x1 = tank.body.x, y1 = tank.body.y;
            var x2 = x1 + 1500 * Math.cos(a), y2 = y1 + 1500 * Math.sin(a);

            var hx = x2, hy = y2, first = null;
            try {
                var hits = this.game.physics.box2d.raycast(x1, y1, x2, y2, true);
                for (var i = 0; hits && i < hits.length; i++) {
                    var h = hits[i];
                    if (!h || !h.body || h.body === tank.body) continue;
                    if (h.point) { hx = h.point.x; hy = h.point.y; }
                    var spr = h.body.sprite;
                    if (spr && isEnemySprite(spr, lvl)) first = spr;
                    break;
                }
            } catch (e) { }

            // Цепь: сама цель + до двух врагов рядом с точкой попадания.
            var targets = [];
            if (first) targets.push(first);
            var near = enemyList(lvl).filter(function (e) {
                if (!e || !e.alive || !e.body || targets.indexOf(e) !== -1) return false;
                var dx = e.body.x - hx, dy = e.body.y - hy;
                return dx * dx + dy * dy <= this.radius * this.radius;
            }, this).sort(function (p, q) {
                var dp = (p.body.x - hx) * (p.body.x - hx) + (p.body.y - hy) * (p.body.y - hy);
                var dq = (q.body.x - hx) * (q.body.x - hx) + (q.body.y - hy) * (q.body.y - hy);
                return dp - dq;
            });
            for (var k = 0; k < near.length && targets.length < 3; k++) targets.push(near[k]);

            var dmg = this.damage;
            for (var t = 0; t < targets.length; t++) {
                var e = targets[t];
                try {
                    if (e.onBulletHit) e.onBulletHit(dmg * (t === 0 ? 1 : .7), this, e.body, true);
                } catch (err) { }
            }

            drawLightning(lvl, x1, y1, [targets.length ? { x: targets[0].body.x, y: targets[0].body.y } : { x: hx, y: hy }]
                .concat(targets.slice(1).map(function (e) { return { x: e.body.x, y: e.body.y }; })), targets.length);
            try {
                lvl.spawnSparks(hx, hy, 0, Math.PI * 2, 260, 5);
                lvl.shakeCamera(3);
                AUDIO.playSound("laser_start.mp3", .8);
            } catch (e) { }

            this.ammo -= 1;
            this.onShot(this);
            if (this.ammo === 0) this.onOutOfAmmo(this);
            this.tank.recoil = 3;
        };

        function drawLightning(lvl, x1, y1, stops, hitCount) {
            try {
                var g = lvl.add.graphics(0, 0);
                g.lineStyle(3, 0x7ce7ff, .95);
                var px = x1, py = y1;
                for (var i = 0; i < stops.length; i++) {
                    var s = stops[i], steps = 5;
                    for (var j = 1; j <= steps; j++) {
                        var nx = px + (s.x - px) * (1 / (steps - j + 1)) + (j === steps ? 0 : (Math.random() - .5) * 26);
                        var ny = py + (s.y - py) * (1 / (steps - j + 1)) + (j === steps ? 0 : (Math.random() - .5) * 26);
                        g.moveTo(px, py);
                        g.lineTo(nx, ny);
                        px = nx; py = ny;
                    }
                    px = s.x; py = s.y;
                    g.lineStyle(2, 0xffffff, .8);
                    g.moveTo(px, py);
                    g.lineTo(px + 4, py + 4);
                    g.lineStyle(3, 0x7ce7ff, .95);
                }
                var layer = lvl.topLayer || lvl.objectsLayer;
                if (layer && layer.add) layer.add(g);
                lvl.game.time.events.add(130, function () { try { g.destroy(); } catch (e) { } });
            } catch (e) { }
        }

        return {
            storm: At2Storm,
            plasma: At2Plasma,
            shrapnel: At2Shrapnel,
            piercer: At2Piercer,
            swarm: At2Swarm,
            tesla: At2Tesla
        };
    }

    /* ===================== ПРИКРЕПЛЕНИЕ К ИГРОКУ ======================== */

    var CLASSES = null;

    function configFor(a, s) {
        var lv = Math.max(0, s.level);
        var cfg = {
            id: "player/" + a.id,
            team: window.AT.common.TEAMS.PLAYER,
            spawnDistance: a.id === "tesla" ? 24 : 20,
            damage: a.dmg[lv],
            rate: a.rate[lv],
            life: a.id === "swarm" ? 3.2 : (a.id === "shrapnel" ? 1.6 : 1.1),
            velocity: 700,
            ammo: a.ammo[lv] === Infinity ? Infinity : s.ammo,
            maxAmmo: a.ammo[lv],
            soundAlertRadius: 100,
            onOutOfAmmo: function () { }
        };
        if (a.id === "piercer") cfg.pierce = a.pierce[lv];
        return cfg;
    }

    function attachToPlayer(lvl) {
        var p = lvl && lvl.player;
        if (!p || !p.weapons || !CLASSES) return;
        var d = M.data();
        ARSENAL.forEach(function (a, i) {
            var s = slot(a.id);
            var idx = FIRST_INDEX + i;
            if (s.level < 0) { p.weapons[idx] = null; return; }
            var w = new CLASSES[a.id](p, configFor(a, s));
            w.__at2id = a.id;
            if (a.ammo[Math.max(0, s.level)] !== Infinity && (!w.ammo || w.ammo <= 0)) w.ammo = Math.round(a.ammo[0] * .5);
            w.onShot = function () { };
            p.weapons[idx] = w;
            if (w.spawnsChildren && lvl.weaponsLayer) lvl.weaponsLayer.add(w);
        });
        M.emit("arsenalAttached", p);
    }

    function saveAmmo(lvl) {
        var p = lvl && lvl.player;
        if (!p || !p.weapons) return;
        ARSENAL.forEach(function (a, i) {
            var s = slot(a.id);
            if (s.level < 0) return;
            var w = p.weapons[FIRST_INDEX + i];
            if (w && isFinite(w.ammo)) s.ammo = w.ammo;
        });
        M.save();
    }

    /* ============================ КЛАВИШИ =============================== */

    function bindKeys(lvl) {
        var p = lvl && lvl.player;
        if (!p || !lvl.addKey) return;
        ARSENAL.forEach(function (a, i) {
            var idx = FIRST_INDEX + i;
            try {
                lvl.addKey(a.key, function () {
                    if (!p.reallyAlive || !p.weapons[idx]) return;
                    if (lvl.changeWeapon) lvl.changeWeapon(idx);
                }, lvl, []);
            } catch (e) { M.warn("не удалось привязать клавишу " + a.key + ":", e); }
        });
    }

    /* ============================== ПАК ================================ */

    M.registerPack({
        id: "at2-weapons",
        name: "Awesome Tanks 2.0 — арсенал",
        version: "3.1.0",

        onReady: function () {
            CLASSES = buildClasses();
            window.AT.game.state.states && Object.keys(window.AT.game.state.states).forEach(function (key) {
                var st = window.AT.game.state.states[key];
                if (!st || !/^Level\d+$/.test(key)) return;
                if (st.__at2weapons) return;
                st.__at2weapons = true;

                M.wrap(st, "createPlayer", function (orig) {
                    return function () {
                        var r = orig.apply(this, arguments);
                        try { attachToPlayer(this); bindKeys(this); } catch (e) { M.warn("attachToPlayer:", e); }
                        return r;
                    };
                });

                M.wrap(st, "shutdown", function (orig) {
                    return function () {
                        try { saveAmmo(this); } catch (e) { }
                        return orig.apply(this, arguments);
                    };
                });
            });
            M.log("арсенал 2.0 готов: " + ARSENAL.length + " новых стволов (Z X C V B N)");
        }
    });

    /* ============================ ЭКСПОРТ ============================== */

    M.ARSENAL = ARSENAL;
    M.arsenal = {
        list: SHOP.list,
        buy: SHOP.buy,
        upgrade: SHOP.upgrade,
        buyAmmo: SHOP.buyAmmo,
        def: def,
        indexOf: idxOf,
        firstIndex: FIRST_INDEX,
        /** Выдать/забрать ствол напрямую (для отладки). */
        force: function (id, lvl) {
            var s = slot(id), a = def(id);
            if (!a) return false;
            s.level = Math.max(-1, Math.min(3, lvl == null ? 3 : lvl));
            if (s.level >= 0) s.ammo = a.ammo[s.level];
            M.save();
            return true;
        }
    };
})();
