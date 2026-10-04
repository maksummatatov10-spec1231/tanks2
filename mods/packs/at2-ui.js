/*!
 * Awesome Tanks 2.0 — интерфейс (at2-ui.js)
 * -----------------------------------------------------------------------------
 * 1) ХАБ 2.0 — новый экран между меню и боем вместо ванильного выбора уровня:
 *    кампании 1.0 и 2.0 (все 30 карт), арсенал новых стволов, магазин
 *    модификаторов за ядра, сложность, лучшие очки. Кнопки «play» в ванильных
 *    меню (Title и Upgrades) ведут сюда.
 * 2) В БОЮ: счётчик ядер, быстрый выбор новых стволов (Z X C V B N) и панель
 *    мода по клавише M со списком купленного и перезарядок.
 *
 * Графика только из самой игры (фреймы menu/upgrades/parts.png, game.png),
 * ни одного своего файла — поэтому мод ничего не распространяет.
 *
 * Шрифт Gunplay не содержит кириллицы, поэтому весь текст рисуется стеком
 * «Gunplay + системный фолбэк»: латиница и цифры — родным шрифтом игры,
 * русские буквы — системным (canvas умеет фолбэк по глифам).
 *
 * Требует: mod-loader.js (+ at2-core / at2-weapons / at2-modifiers по желанию).
 * Лицензия: MIT. Игровых файлов не содержит — только код.
 * ========================================================================== */
(function () {
    "use strict";

    var M = window.MOD;
    if (!M) { console.warn("[at2-ui] нужен mod-loader.js"); return; }

    var FONT = 'Gunplay, Arial, Helvetica, sans-serif';
    /* Палитра взята из родной графики игры:
       зелёные таблички frame.png (#179037 / #0D8539), золото кнопок и денег (#FFB600). */
    var COL = {
        accent: "#ffb600", gold: "#ffb600", dim: "#a9c7a6", white: "#f2f7ee",
        ok: "#9be08f", bad: "#ff9f9f"
    };
    var N = {
        panel: 0x11662f, dark: 0x0a3d1c, accent: 0xffb600, dim: 0x2f7a46,
        gold: 0xffb600, line: 0x179037, deep: 0x07230f
    };
    var ART = "menu/upgrades/parts.png";
    var BTN = "menu/upgrades/parts/buttons/";

    /* ============================= УТИЛИТЫ ============================= */

    function txt(game, x, y, str, size, color) {
        var t = game.make.text(x, y, str);
        t.font = FONT;
        t.fontWeight = "400";
        t.fontSize = size || 14;
        t.fill = color || COL.white;
        t.lineSpacing = 2;
        return t;
    }

    function grafx(game, w, h, radius, fill, alpha, line) {
        var g = game.make.graphics(0, 0);
        g.beginFill(fill == null ? N.panel : fill, alpha == null ? 1 : alpha);
        g.drawRoundedRect(0, 0, w, h, radius == null ? 8 : radius);
        g.endFill();
        if (line != null) {
            g.lineStyle(2, line, 1);
            g.drawRoundedRect(0, 0, w, h, radius == null ? 8 : radius);
        }
        return g;
    }

    /* Прозрачная текстура 2×2 для областей ввода (своих файлов мод не тащит). */
    var _blank = null;
    function blank(game) {
        if (_blank) return _blank;
        _blank = game.make.bitmapData(2, 2);
        _blank.clear(0, 0, 2, 2);
        return _blank;
    }

    /* Кнопка: своя рамка + прозрачная область ввода + подпись. */
    function btn(game, group, x, y, w, h, label, cb, ctx, opt) {
        opt = opt || {};
        var fill = opt.fill == null ? N.panel : opt.fill;
        var line = opt.line == null ? (opt.accent ? N.accent : N.dim) : opt.line;
        var gfx = grafx(game, w, h, opt.radius == null ? 7 : opt.radius, fill, .96, line);
        gfx.position.set(x, y);
        group.add(gfx);

        var hit = game.make.sprite(x, y, blank(game));
        hit.width = w;
        hit.height = h;
        hit.inputEnabled = true;
        hit.input.useHandCursor = true;
        hit.hitArea = new Phaser.Rectangle(0, 0, w, h);
        hit.events.onInputOver.add(function () { gfx.alpha = .7; });
        hit.events.onInputOut.add(function () { gfx.alpha = 1; });
        hit.events.onInputDown.add(function () { if (cb) cb.call(ctx || null); });
        group.add(hit);

        hit.gfx = gfx;
        hit.labelText = null;
        if (label != null) {
            var t = txt(game, x + w / 2, y + h / 2, label, opt.size || 14, opt.color || COL.white);
            t.anchor.set(.5, .5);
            group.add(t);
            hit.labelText = t;
        }
        return hit;
    }

    function setBtnLabel(b, str, color) {
        if (b && b.labelText) { b.labelText.text = str; if (color) b.labelText.fill = color; }
    }

    /* Перерисовать рамку панельки: подсветка наведения/активного пункта. */
    function redrawBox(g, w, h, radius, fill, line, alpha) {
        try {
            g.clear();
            g.beginFill(fill, alpha == null ? .96 : alpha);
            g.drawRoundedRect(0, 0, w, h, radius == null ? 7 : radius);
            g.endFill();
            if (line != null) {
                g.lineStyle(2, line, 1);
                g.drawRoundedRect(0, 0, w, h, radius == null ? 7 : radius);
            }
        } catch (e) { }
    }

    /* Короткий «пульс» размера — для счётчиков, покупок, иконок. */
    function pulse(game, obj, amount, ms) {
        if (!obj || !obj.scale) return null;
        try {
            return game.add.tween(obj.scale).to({ x: amount, y: amount }, ms || 90,
                Phaser.Easing.Quadratic.Out, true, 0, 0, true);
        } catch (e) { return null; }
    }

    /* Кнопка родной графикой игры (buy / upgrade / refill / play / menu / stats / easy / medium / hard).
       Если графики нет в кэше — тихо возвращаем null, интерфейс не ломается. */
    function artButton(game, group, x, y, base, cb, ctx, opt) {
        opt = opt || {};
        var b = null;
        try {
            b = game.make.button(x, y, ART, function () { if (cb) cb.call(ctx || null); }, null,
                base + "_hover.png", base + "_normal.png", base + "_down.png", base + "_normal.png");
        } catch (e) { b = null; }
        if (!b) return null;
        b.anchor.set(.5, .5);
        var sc = opt.scale == null ? .5 : opt.scale;
        b.scale.set(sc, sc);
        if (opt.alpha != null) b.alpha = opt.alpha;
        try {
            var au = window.AT && window.AT.audio;
            if (au && au.playButtonDown) b.onInputDown.add(au.playButtonDown);
            if (au && au.playButtonUp) b.onInputUp.add(au.playButtonUp);
        } catch (e) { }
        group.add(b);
        if (opt.caption) {
            var t = txt(game, x, y + 14 * sc + 6, opt.caption, 10, COL.dim);
            t.anchor.set(.5, 0);
            group.add(t);
            b.__caption = t;
        }
        return b;
    }

    /* Крестик закрытия — родные кадры x_hover / x_normal. */
    function artClose(game, group, x, y, cb, ctx, opt) {
        opt = opt || {};
        var b = null;
        try {
            b = game.make.button(x, y, ART, function () { if (cb) cb.call(ctx || null); }, null,
                BTN + "x_hover.png", BTN + "x_normal.png", BTN + "x_normal.png", BTN + "x_hover.png");
        } catch (e) { b = null; }
        if (!b) return null;
        b.anchor.set(.5, .5);
        var sc = opt.scale == null ? .5 : opt.scale;
        b.scale.set(sc, sc);
        group.add(b);
        return b;
    }

    /* Картинка из родного атласа меню (галочка, шкала, иконка ствола и т.п.). */
    function artIcon(game, group, x, y, frame, scale) {
        var img = game.make.image(x, y, ART, frame);
        img.anchor.set(.5, .5);
        if (scale != null) img.scale.set(scale, scale);
        group.add(img);
        return img;
    }

    /* Мягкое появление группы. */
    function fadeIn(game, obj, ms) {
        if (!obj) return;
        try {
            obj.alpha = 0;
            game.add.tween(obj).to({ alpha: 1 }, ms || 220, Phaser.Easing.Linear.None, true);
        } catch (e) { obj.alpha = 1; }
    }

    function money() { try { return window.AT.profile.current.game.money; } catch (e) { return 0; } }
    function moneyFmt(n) {
        try { return window.AT.common.formatMoney(n); } catch (e) { return String(n); }
    }
    function cores() { return M.cores(); }
    function unlocked() { try { return window.AT.profile.current.game.levels; } catch (e) { return 0; } }
    function bestPoints(n) {
        try { return window.AT.profile.current.game.points[n - 1] || 0; } catch (e) { return 0; }
    }
    function lvlName(n) {
        try { var l = window.AT.LEVELS[n - 1]; return (l && l[0]) || ("Уровень " + n); } catch (e) { return "Уровень " + n; }
    }
    function lvlTerrain(n) {
        try { var l = window.AT.LEVELS[n - 1]; return (l && l[1]) || ""; } catch (e) { return ""; }
    }
    var DIFF_NAMES = ["ЛЕГКО", "СРЕДНЕ", "ТЯЖЕЛО"];
    function diffIndex() {
        try { var d = window.AT.profile.current.game.difficulty; return (d == null || d < 0) ? 1 : d; } catch (e) { return 1; }
    }
    function go(ctx, key) {
        try { ctx.state.start(key); }
        catch (e) { try { ctx.game.state.start(key); } catch (e2) { M.warn("не удалось перейти в " + key + ":", e2); } }
    }

    /* ============================== ХАБ 2.0 ============================= */

    function Hub() {
        this.tab = 0;
        this.page = 0;
        this._w = 0;
        this._h = 0;
    }

    Hub.prototype.create = function () {
        var g = this.game, self = this;
        this.root = g.add.group();
        this.bg = g.make.image(300, 310, "menu/upgrades/background.png");
        this.root.add(this.bg);

        this.head = txt(g, 300, 24, "AWESOME TANKS 2.0", 32, COL.accent);
        this.head.anchor.set(.5, 0);
        this.root.add(this.head);

        this.sub = txt(g, 300, 60, "хаб мода: карты, арсенал, модификаторы за ядра", 13, COL.dim);
        this.sub.anchor.set(.5, 0);
        this.root.add(this.sub);

        this.moneyT = txt(g, 574, 24, "", 17, COL.gold);
        this.moneyT.anchor.set(1, 0);
        this.root.add(this.moneyT);
        this.coresT = txt(g, 574, 46, "", 17, COL.accent);
        this.coresT.anchor.set(1, 0);
        this.root.add(this.coresT);

        this.tabs = [];
        var names = ["КАМПАНИЯ 1.0", "КАМПАНИЯ 2.0", "АРСЕНАЛ", "МОДИФИКАТОРЫ"];
        names.forEach(function (n, i) {
            var b = btn(g, self.root, 27 + i * 138, 84, 132, 32, n, function () {
                self.tab = i;
                self.page = 0;
                self.refresh();
            }, self, { size: 13 });
            b.__tab = i;
            self.tabs.push(b);
        });

        /* --- нижняя панель: всё родной графикой игры --- */
        var by = 512;
        var lbl = txt(g, 14, by - 4, "СЛОЖНОСТЬ", 11, COL.dim);
        this.root.add(lbl);

        artButton(g, this.root, 52, by + 6, BTN + "menu", function () { self.go("MenuUpgrades"); }, self,
            { scale: .46, caption: "апгрейды" });

        this.diffBtns = [];
        ["easy", "medium", "hard"].forEach(function (name, i) {
            var b = artButton(g, self.root, 168 + i * 100, by + 6, BTN + name, function () { self.setDifficulty(i); }, self, { scale: .45 });
            self.diffBtns.push(b);
        });

        artButton(g, this.root, 470, by + 6, BTN + "stats", function () { self.toggleHelp(); }, self,
            { scale: .45, caption: "управление" });

        this.soundIcon = artIcon(g, this.root, 530, by + 2, BTN + "sound_normal.png", .8);
        this.soundState = artIcon(g, this.root, 545, by + 14, BTN + "on.png", .8);
        this.musicIcon = artIcon(g, this.root, 572, by + 2, BTN + "music_normal.png", .8);
        this.musicState = artIcon(g, this.root, 587, by + 14, BTN + "on.png", .8);
        var sHit = game_makeHit(g, this.root, 516, by - 6, 32, 34, function () { self.toggleSound(); });
        var mHit = game_makeHit(g, this.root, 558, by - 6, 32, 34, function () { self.toggleMusic(); });
        this.soundHit = sHit;
        this.musicHit = mHit;

        this.msgT = txt(g, 300, 566, "", 13, COL.dim);
        this.msgT.anchor.set(.5, 0);
        this.root.add(this.msgT);

        this.content = g.add.group();
        this.root.add(this.content);
        this.overlay = g.add.group();
        this.root.add(this.overlay);
        this.overlay.visible = false;

        this.layout(g.width, g.height);
        this.updateHeader();
        this.refresh();
        fadeIn(g, this.root, 240);
    };

    Hub.prototype.shutdown = function () {
        if (this.root) { this.root.destroy(true); this.root = null; }
        this.content = this.overlay = null;
    };

    Hub.prototype.layout = function (w, h) {
        if (!this.root) return;
        var s = Math.min(w / 600, h / 600);
        this.root.scale.set(s);
        this.root.position.set(w / 2 - 300 * s, h / 2 - 300 * s);
        this._w = w;
        this._h = h;
    };

    Hub.prototype.resize = function (w, h) { this.layout(w, h); };

    Hub.prototype.update = function () {
        if (this.game.width !== this._w || this.game.height !== this._h) this.layout(this.game.width, this.game.height);
    };

    Hub.prototype.msg = function (str, color) {
        if (this.msgT) { this.msgT.text = str || ""; this.msgT.fill = color || COL.dim; }
    };

    Hub.prototype.updateHeader = function () {
        if (this.moneyT) this.moneyT.text = "$ " + moneyFmt(money());
        if (this.coresT) {
            var line = "\u042F\u0434\u0440\u0430: " + cores();
            if (this.coresT.text && this.coresT.text !== line) pulse(this.game, this.coresT, 1.22);
            this.coresT.text = line;
        }
        var d = diffIndex();
        (this.diffBtns || []).forEach(function (b, i) {
            if (!b) return;
            b.alpha = i === d ? 1 : .45;
        });
        if (this.soundState) this.soundState.loadTexture(ART, BTN + (soundOn() ? "on.png" : "off.png"));
        if (this.musicState) this.musicState.loadTexture(ART, BTN + (musicOn() ? "on.png" : "off.png"));
        if (this.soundIcon) this.soundIcon.alpha = soundOn() ? 1 : .5;
        if (this.musicIcon) this.musicIcon.alpha = musicOn() ? 1 : .5;
    };

    function soundOn() { try { return !!window.AT.profile.current.game.sound; } catch (e) { return true; } }
    function musicOn() { try { return !!window.AT.profile.current.game.music; } catch (e) { return true; } }

    Hub.prototype.setDifficulty = function (i) {
        try {
            var p = window.AT.profile.current.game;
            p.difficulty = i;
            window.AT.profile.save();
            this.msg("сложность: " + DIFF_NAMES[i], COL.ok);
        } catch (e) { this.msg("не удалось сохранить сложность", COL.bad); }
        this.updateHeader();
    };

    Hub.prototype.toggleSound = function () {
        var on = !soundOn();
        try {
            var p = window.AT.profile.current.game;
            p.sound = on;
            if (window.AT.audio && window.AT.audio.toggleSound) window.AT.audio.toggleSound(on);
            window.AT.profile.save();
        } catch (e) { }
        this.msg(on ? "звук включён" : "звук выключен", COL.dim);
        this.updateHeader();
    };

    Hub.prototype.toggleMusic = function () {
        var on = !musicOn();
        try {
            var p = window.AT.profile.current.game;
            p.music = on;
            if (window.AT.audio && window.AT.audio.toggleMusic) window.AT.audio.toggleMusic(on);
            window.AT.profile.save();
        } catch (e) { }
        this.msg(on ? "музыка включена" : "музыка выключена", COL.dim);
        this.updateHeader();
    };

    Hub.prototype.go = function (key) { go(this, key); };

    Hub.prototype.refresh = function () {
        if (!this.content) return;
        this.content.removeAll(true);
        this.overlay.visible = false;
        this.overlay.removeAll(true);

        (this.tabs || []).forEach(function (b, i) {
            var on = i === this.tab;
            if (b.gfx) b.gfx.alpha = on ? 1 : .45;
            b.gfx.clear();
            b.gfx.beginFill(N.panel, .96);
            b.gfx.drawRoundedRect(0, 0, 132, 32, 7);
            b.gfx.endFill();
            b.gfx.lineStyle(2, on ? N.accent : N.dim, 1);
            b.gfx.drawRoundedRect(0, 0, 132, 32, 7);
            if (b.labelText) b.labelText.fill = on ? COL.accent : COL.dim;
        }, this);

        this.updateHeader();

        if (this.tab === 0) this.buildLevels(1);
        else if (this.tab === 1) this.buildLevels(16);
        else if (this.tab === 2) this.buildArsenal();
        else this.buildModifiers();
    };

    /* ------------------------------ карты ------------------------------ */

    Hub.prototype.buildLevels = function (from) {
        var g = this.game, self = this;
        for (var i = 0; i < 15; i++) {
            var n = from + i;
            var col = i % 5, row = Math.floor(i / 5);
            var x = 26 + col * 112, y = 120 + row * 118;
            var open = (n - 1) <= unlocked();
            var passed = bestPoints(n) > 0;

            var card = grafx(g, 100, 108, 8, open ? N.panel : N.dark, .96, open ? N.dim : 0x2a3242);
            card.position.set(x, y);
            this.content.add(card);

            /* фон карточки — родная рамка frame.png */
            var frame = artIcon(g, this.content, x + 50, y + 30, "menu/upgrades/parts/frame.png", 1);
            frame.scale.set(.92, .62);
            frame.alpha = open ? 1 : .45;

            var num = txt(g, x + 50, y + 26, String(n), 22, open ? COL.white : COL.dim);
            num.anchor.set(.5, .5);
            this.content.add(num);

            if (passed) {
                var chk = artIcon(g, this.content, x + 80, y + 12, "menu/upgrades/parts/check.png", .26);
                chk.angle = 8;
            }

            var nm = txt(g, x + 8, y + 56, lvlName(n), 10, open ? COL.accent : COL.dim);
            nm.wordWrap = true;
            nm.wordWrapWidth = 84;
            this.content.add(nm);

            var info = txt(g, x + 8, y + 85, open ? (bestPoints(n) > 0 ? "лучший: " + bestPoints(n) : lvlTerrain(n)) : "закрыто", 9, COL.dim);
            this.content.add(info);

            if (open) {
                var pl = artIcon(g, this.content, x + 50, y + 96, BTN + "play_normal.png", .3);
                pl.alpha = .95;
            }

            (function (num2, isOpen, box) {
                var hit = game_makeHit(g, self.content, x, y, 100, 108, function () { self.play(num2, isOpen); });
                hit.__card = true;
                hit.events.onInputOver.add(function () {
                    if (!isOpen) return;
                    redrawBox(box, 100, 108, 8, N.panel, N.accent);
                    g.add.tween(box.scale).to({ x: 1.04, y: 1.04 }, 120, Phaser.Easing.Quadratic.Out, true);
                });
                hit.events.onInputOut.add(function () {
                    redrawBox(box, 100, 108, 8, isOpen ? N.panel : N.dark, isOpen ? N.dim : 0x2a3242);
                    g.add.tween(box.scale).to({ x: 1, y: 1 }, 140, Phaser.Easing.Quadratic.Out, true);
                });
            })(n, open, card);
        }

        var info2 = txt(g, 300, 480, this.tab === 0
            ? "Кампания 1.0 — 15 оригинальных карт игры, ничего не менялось."
            : "Кампания 2.0 — 15 новых карт мода, поверх оригинальных; очки считаются отдельно.",
            12, COL.dim);
        info2.anchor.set(.5, 0);
        this.content.add(info2);
    };

    function game_makeHit(game, group, x, y, w, h, cb) {
        var hit = game.make.sprite(x, y, blank(game));
        hit.width = w;
        hit.height = h;
        hit.inputEnabled = true;
        hit.input.useHandCursor = true;
        hit.hitArea = new Phaser.Rectangle(0, 0, w, h);
        hit.events.onInputDown.add(cb);
        group.add(hit);
        return hit;
    }

    Hub.prototype.play = function (n, open) {
        if (!open) { this.msg("Уровень " + n + " закрыт — пройдите предыдущие", COL.bad); return; }
        go(this, "Level" + n);
    };

    /* ----------------------------- арсенал ----------------------------- */

    var WEAPON_ICON = {
        storm: "minigun", plasma: "shock", shrapnel: "shotgun",
        piercer: "railgun", swarm: "rockets", tesla: "laser"
    };

    Hub.prototype.buildArsenal = function () {
        var g = this.game, self = this;
        var list = (M.arsenal && M.arsenal.list()) || [];
        if (!list.length) {
            var w1 = txt(g, 300, 280, "Арсенал не подключён: нужен mods/packs/at2-weapons.js", 15, COL.bad);
            w1.anchor.set(.5, 0);
            this.content.add(w1);
            return;
        }
        list.forEach(function (a, i) {
            var y = 120 + i * 62;
            var row = grafx(g, 548, 56, 8, a.owned ? 0x1a2434 : N.panel, .96, a.owned ? 0x3f7f5a : N.dim);
            row.position.set(26, y);
            row.scale.set(1, 1);
            self.content.add(row);

            var icon = g.make.image(60, y + 28, "menu/upgrades/parts.png", "menu/upgrades/parts/" + (WEAPON_ICON[a.id] || "cannon") + ".png");
            icon.scale.set(.5, .5);
            icon.__baseScale = .5;
            icon.anchor.set(.5, .5);
            if (!a.owned) icon.alpha = .45;
            self.content.add(icon);

            var nm = txt(g, 108, y + 6, a.name + "   [" + a.key + "]", 15, a.owned ? COL.white : COL.accent);
            self.content.add(nm);
            var lv = txt(g, 108, y + 28, a.owned ? "уровень " + (a.level + 1) + "/4" : "не куплен", 11, COL.dim);
            self.content.add(lv);

            /* шкала уровня — родной gauge_0…5.png */
            var gframe = "menu/upgrades/parts/gauge_" + Math.max(0, Math.min(5, a.owned ? a.level + 1 : 0)) + ".png";
            var gauge = artIcon(g, self.content, 196, y + 33, gframe, .3);
            gauge.alpha = a.owned ? 1 : .5;

            if (a.owned && a.maxAmmo !== Infinity) {
                artIcon(g, self.content, 240, y + 34, "menu/upgrades/parts/ammo_small.png", .3);
                var am = txt(g, 252, y + 28, a.ammo + " / " + a.maxAmmo, 11, COL.dim);
                self.content.add(am);
            }
            if (!a.owned) {
                var d = txt(g, 240, y + 8, a.desc || "", 11, COL.dim);
                d.wordWrap = true;
                d.wordWrapWidth = 150;
                self.content.add(d);
            }

            if (!a.owned) {
                var buy = artButton(g, self.content, 505, y + 20, BTN + "buy", function () {
                    var r = M.arsenal.buy(a.id);
                    self.msg(r && r.ok ? ("куплено: " + a.name) : ("не вышло: " + ((r && r.reason) || "?")), r && r.ok ? COL.ok : COL.bad);
                    if (r && r.ok) pulse(g, icon, 1.25, 130);
                    self.refresh();
                }, self, { scale: .42, caption: "$ " + moneyFmt(a.price) });
                if (buy) buy.alpha = M.money() >= a.price ? 1 : .5;
            } else if (a.price != null) {
                artButton(g, self.content, 505, y + 18, BTN + "upgrade", function () {
                    var r = M.arsenal.upgrade(a.id);
                    var now = (M.arsenal.list().filter(function (q) { return q.id === a.id; })[0] || {}).level;
                    self.msg(r && r.ok ? (a.name + ": уровень " + (now + 1)) : ("не вышло: " + ((r && r.reason) || "?")), r && r.ok ? COL.ok : COL.bad);
                    self.refresh();
                }, self, { scale: .4, caption: "$ " + moneyFmt(a.price) });
            } else {
                var mx = txt(g, 505, y + 28, "МАКСИМУМ", 13, COL.ok);
                mx.anchor.set(.5, .5);
                self.content.add(mx);
            }

            if (a.owned && a.ammoPrice) {
                artButton(g, self.content, 415, y + 18, BTN + "refill", function () {
                    var r = M.arsenal.buyAmmo(a.id);
                    self.msg(r && r.ok ? ("патроны: " + (r.ammo || "") + " / " + (r.max || "")) : ("не вышло: " + ((r && r.reason) || "?")), r && r.ok ? COL.ok : COL.bad);
                    self.refresh();
                }, self, { scale: .4, caption: "$ " + moneyFmt(a.ammoPrice) });
            }
        });

        var hint = txt(g, 300, 496, "Купленные стволы включаются в бою клавишами Z X C V B N или колесом мыши.", 12, COL.dim);
        hint.anchor.set(.5, 0);
        this.content.add(hint);
    };

    /* --------------------------- модификаторы -------------------------- */

    var PER_PAGE = 5;

    Hub.prototype.buildModifiers = function () {
        var g = this.game, self = this;
        var list = (M.mods && M.mods.list()) || [];
        if (!list.length) {
            var w2 = txt(g, 300, 280, "Модификаторы не подключены: нужен mods/packs/at2-modifiers.js", 15, COL.bad);
            w2.anchor.set(.5, 0);
            this.content.add(w2);
            return;
        }
        var pages = Math.max(1, Math.ceil(list.length / PER_PAGE));
        if (this.page >= pages) this.page = pages - 1;
        var slice = list.slice(this.page * PER_PAGE, this.page * PER_PAGE + PER_PAGE);

        slice.forEach(function (m, i) {
            var y = 118 + i * 72;
            var row = grafx(g, 548, 66, 8, m.owned ? 0x1a2433 : N.panel, .96, m.owned ? 0x3f7f5a : N.dim);
            row.position.set(26, y);
            self.content.add(row);

            var badge = grafx(g, 34, 26, 6, N.dark, 1, m.kind === "active" ? N.accent : N.dim);
            badge.position.set(38, y + 20);
            self.content.add(badge);
            var key = txt(g, 55, y + 33, m.key || "•", 15, m.kind === "active" ? COL.accent : COL.dim);
            key.anchor.set(.5, .5);
            self.content.add(key);

            var nm = txt(g, 84, y + 6, m.name + (m.kind === "active" ? "  (активный" + (m.uses ? ", " + m.uses + " заряда" : "") + ")" : "  (пассивный)"), 14, m.owned ? COL.white : COL.accent);
            self.content.add(nm);
            var d = txt(g, 84, y + 24, m.desc || "", 10, COL.dim);
            d.wordWrap = true;
            d.wordWrapWidth = 380;
            self.content.add(d);

            if (m.owned) {
                artIcon(g, self.content, 505, y + 24, "menu/upgrades/parts/check.png", .32);
                var ok = txt(g, 505, y + 46, "куплено", 10, COL.ok);
                ok.anchor.set(.5, 0);
                self.content.add(ok);
            } else {
                artButton(g, self.content, 505, y + 22, BTN + "buy", function () {
                    var r = M.mods.buy(m.id);
                    self.msg(r && r.ok ? ("куплено: " + m.name) : ("не вышло: " + ((r && r.reason) || "?")), r && r.ok ? COL.ok : COL.bad);
                    self.refresh();
                }, self, { scale: .42, caption: m.price + " \u042F" });
            }
        });

        btn(g, this.content, 26, 480, 46, 34, "<", function () {
            self.page = (self.page + pages - 1) % pages; self.refresh();
        }, self, { size: 16 });
        btn(g, this.content, 528, 480, 46, 34, ">", function () {
            self.page = (self.page + 1) % pages; self.refresh();
        }, self, { size: 16 });
        var pg = txt(g, 300, 490, "страница " + (this.page + 1) + " / " + pages + "   •   ядер: " + cores(), 12, COL.dim);
        pg.anchor.set(.5, .5);
        this.content.add(pg);
    };

    /* ----------------------------- помощь ------------------------------ */

    Hub.prototype.toggleHelp = function () {
        var g = this.game, self = this;
        if (this.overlay.visible) { this.overlay.visible = false; this.overlay.removeAll(true); return; }
        this.overlay.removeAll(true);

        var bgp = grafx(g, 520, 400, 10, 0x0d111a, .97, N.accent);
        bgp.position.set(40, 110);
        this.overlay.add(bgp);

        var lines = [
            "УПРАВЛЕНИЕ (2.0)",
            "",
            "Движение — WASD или стрелки, огонь — мышь/пробел.",
            "1…9 — ванильные стволы,  Q / E  или колесо — перебор,",
            "Z X C V B N — новые стволы 2.0 (нужно купить в хабе).",
            "",
            "АКТИВНЫЕ МОДИФИКАТОРЫ (клавиши):",
            "H — ноуклип (сквозь стены и пули, 5 с),  G — рывок,",
            "J — щит,  K — хронометр,  L — ядерный залп,  U — блинк,",
            "I — ударная волна,  O — форсаж,  Y — берсерк.",
            "",
            "M — панель мода в бою: ядра, перезарядки, стволы.",
            "Ядра (\u042F) — вторая валюта: падают за убийства, боссов и",
            "зачистку уровня, тратятся на модификаторы.",
            "",
            "Всё сохраняется в сохранении игры, оригинальные карты не тронуты."
        ];
        var t = txt(g, 60, 126, lines.join("\n"), 13, COL.white);
        this.overlay.add(t);

        btn(g, this.overlay, 480, 452, 70, 40, "OK", function () {
            self.overlay.visible = false;
        }, self, { size: 14, accent: true });
        this.overlay.visible = true;
    };

    /* ===================== ПАТЧ ВАНИЛЬНЫХ МЕНЮ ========================= */

    /* Кнопка «play» у Title и Upgrades ведёт в хаб; если хаба нет — как раньше. */
    function toHub(state) {
        if (!state || state.__at2hub || typeof state.next !== "function") return;
        state.__at2hub = true;
        var orig = state.next;
        state.next = function () {
            var g = window.AT && window.AT.game;
            if (g && g.state && g.state.checkState && g.state.checkState("AT2Hub")) { go(this, "AT2Hub"); return; }
            return orig.apply(this, arguments);
        };
    }

    function hookMenus() {
        var g = window.AT && window.AT.game;
        if (!g || !g.state || !g.state.states) return;
        var st = g.state.states;
        toHub(st.MenuTitle);
        toHub(st.MenuUpgrades);

        // боевой интерфейс 2.0 на каждом уровне (независимо от at2-core)
        Object.keys(st).forEach(function (key) {
            var s = st[key];
            if (!s || s.__at2uiHook || !/^Level\d+$/.test(key)) return;
            s.__at2uiHook = true;
            M.wrap(s, "create", function (orig) {
                return function () {
                    var r = orig.apply(this, arguments);
                    try { installBattle(this); } catch (e) { M.warn("бой-интерфейс 2.0:", e); }
                    return r;
                };
            });
            M.wrap(s, "update", function (orig) {
                return function () {
                    try { tickBattle(this); } catch (e) { }
                    return orig.apply(this, arguments);
                };
            });
            M.wrap(s, "shutdown", function (orig) {
                return function () {
                    try { dropBattle(this); } catch (e) { }
                    return orig.apply(this, arguments);
                };
            });
        });
    }

    function dropBattle(lvl) {
        var layer = lvl.__at2layer;
        if (layer && layer.parent) layer.parent.removeChild(layer);
        if (layer) { try { layer.destroy(true); } catch (e) { } }
        lvl.__at2layer = null;
        lvl.__at2ui = null;
    }

    /* ===================== БОЙ: ЯДРА, СТВОЛЫ, ПАНЕЛЬ ==================== */

    function coresLine() { return "\u042F " + cores(); }

    function installBattle(lvl) {
        if (!lvl || lvl.__at2ui) return;
        var g = lvl.game;
        if (!g || !g.add || !g.make) return;

        var ui = lvl.__at2ui = { items: [], slots: [] };
        var ARS = (M.arsenal && M.arsenal.list()) || [];

        var layer = g.add.group(g.stage);
        lvl.__at2layer = layer;

        // счётчик ядер
        ui.coreBg = grafx(g, 150, 32, 8, N.deep, .9, N.accent);
        layer.add(ui.coreBg);
        ui.coreT = txt(g, 0, 0, coresLine() + "   (ядра)", 15, COL.accent);
        layer.add(ui.coreT);

        // быстрый выбор новых стволов
        ARS.forEach(function (a) {
            var b = btn(g, layer, 0, 0, 34, 30, a.key, function () {
                var s = M.data().weapons[a.id];
                if (!s || s.level < 0) {
                    if (M.toast) M.toast("Ствол не куплен: " + a.name, COL.bad);
                    return;
                }
                if (lvl.changeWeapon) lvl.changeWeapon(idxOf(a.id));
            }, null, { size: 14, line: N.dim });
            b.__id = a.id;
            ui.slots.push(b);
            ui.items.push(b);
        });

        // кнопка панели мода
        ui.panelBtn = btn(g, layer, 0, 0, 34, 30, "i", function () { togglePanel(lvl); }, null, { size: 15, accent: true });
        ui.items.push(ui.panelBtn);

        // сама панель
        ui.panel = grafx(g, 420, 300, 10, N.deep, .97, N.accent);
        ui.panel.inputEnabled = true;
        ui.panel.hitArea = new Phaser.Rectangle(0, 0, 420, 300);
        ui.panel.visible = false;
        layer.add(ui.panel);
        ui.panelT = txt(g, 0, 0, "", 13, COL.white);
        ui.panelT.visible = false;
        layer.add(ui.panelT);

        ui.items.push(ui.panel);

        /* крестик закрытия панели — родной кадр x_normal */
        ui.closeBtn = artClose(g, layer, 0, 0, function () { togglePanel(lvl); }, null, { scale: .55 });
        if (ui.closeBtn) {
            ui.closeBtn.visible = false;
            ui.items.push(ui.closeBtn);
        }

        layoutBattle(lvl);

        /* Лёгкий вход в бой: шторка + подпись карты (для 15 новых уровней). */
        try {
            fadeIn(g, layer, 260);
            if (lvl.camera && lvl.camera.flash) lvl.camera.flash(0x000000, 220);
            var num = lvl.number;
            var mapName = (M.campaign && M.campaign.nameOf) ? M.campaign.nameOf(num) : null;
            if (mapName) {
                M.toast("\u041a\u0410\u0420\u0422\u0410 " + num + "/30 \u2014 " + mapName);
            } else if (num === 15) {
                M.toast("\u041f\u041e\u0421\u041b\u0415\u0414\u041d\u042f\u042f \u041a\u0410\u0420\u0422\u0410 1.0");
            }
        } catch (e) { M.warn("вступление боя:", e); }

        // клики по нашим кнопкам не должны стрелять
        if (lvl.hud && lvl.hud.pointerOver) {
            ["pointerOver", "pointerDown"].forEach(function (name) {
                M.wrap(lvl.hud, name, function (orig) {
                    return function (id) {
                        if (orig.call(this, id)) return true;
                        return hitMine(lvl, id);
                    };
                });
            });
        }

        // клавиши
        try { lvl.addKey("M", function () { togglePanel(lvl); }, lvl, []); } catch (e) { }

        // события
        M.on("cores", function () {
            if (!ui.coreT || lvl.__at2ui !== ui) return;
            var line = coresLine() + "   (ядра)";
            if (ui.coreT.text !== line) pulse(g, ui.coreT, 1.18, 110);
            ui.coreT.text = line;
        });
        M.on("enemyKilled", function (e) {
            if (!e || !(e.cores > 0) || e.level !== lvl || lvl.__at2ui !== ui) return;
            flash(lvl, "\u042F +" + e.cores, COL.gold);
            try {
                var p = e.enemy && e.enemy.position;
                if (p && lvl.starEmitter) {
                    lvl.starEmitter.emitParticle(p.x, p.y, "game.png", "game/particles/star_object.png");
                }
            } catch (err) { }
        });
        M.on("levelComplete", function (e) {
            if (!e || e.level !== lvl || lvl.__at2ui !== ui) return;
            flash(lvl, "ЗАЧИСТКА: \u042F +" + e.cores, COL.ok);
            try { lvl.camera.flash(0xddbb00, 320); } catch (err) { }
            ui.cAmt = e.cores;
        });
    }

    /* Покадровый уход за боевым интерфейсом: ресайз, подсветка активного ствола. */
    function tickBattle(lvl) {
        var ui = lvl.__at2ui;
        if (!ui) return;
        var g = lvl.game;
        if (ui._w !== g.width || ui._h !== g.height) {
            ui._w = g.width;
            ui._h = g.height;
            layoutBattle(lvl);
        }
        var p = lvl.player;
        if (p && ui.slots.length) {
            var cur = -1;
            for (var i = 0; i < ui.slots.length; i++) {
                if (idxOf(ui.slots[i].__id) === p.weaponIndex) cur = i;
            }
            if (cur !== ui._cur) {
                ui._cur = cur;
                ui.slots.forEach(function (b, j) {
                    redrawBox(b.gfx, 34, 30, 7, N.panel, j === cur ? N.accent : N.dim);
                });
            }
        }
        if (ui.panel && ui.panel.visible) {
            ui._t = (ui._t || 0) + (g.time.physicsElapsed || 0);
            if (ui._t >= .25) { ui._t = 0; refreshPanel(lvl); }
        }
    }

    function idxOf(id) {
        var list = (M.arsenal && M.arsenal.list()) || [];
        for (var i = 0; i < list.length; i++) if (list[i].id === id) return M.arsenal.firstIndex + i;
        return 0;
    }

    function layoutBattle(lvl) {
        var ui = lvl.__at2ui;
        if (!ui || !ui.coreBg) return;
        var w = lvl.game.width;

        ui.coreBg.position.set(10, 10);
        ui.coreT.position.set(22, 19);

        var n = ui.slots.length + 1;
        var x = w - 12 - n * 38;
        ui.slots.forEach(function (b, i) {
            var sx = x + i * 38;
            b.position.set(sx, 10);
            b.gfx.position.set(sx, 10);
            if (b.labelText) b.labelText.position.set(sx + 17, 25);
        });
        var px = x + ui.slots.length * 38;
        ui.panelBtn.position.set(px, 10);
        ui.panelBtn.gfx.position.set(px, 10);
        if (ui.panelBtn.labelText) ui.panelBtn.labelText.position.set(px + 17, 25);

        var pw = Math.min(440, w - 24);
        ui.panel.position.set((w - pw) / 2, 50);
        if (ui.panelT) ui.panelT.position.set((w - pw) / 2 + 14, 62);
        if (ui.closeBtn) ui.closeBtn.position.set((w - pw) / 2 + 420 - 14, 50 + 16);
    }

    function hitMine(lvl, id) {
        var ui = lvl.__at2ui;
        if (!ui) return false;
        for (var i = 0; i < ui.items.length; i++) {
            var it = ui.items[i];
            if (it && it.visible !== false && it.input && it.input.pointerOver && it.input.pointerOver(id)) return true;
        }
        return false;
    }

    function togglePanel(lvl) {
        var ui = lvl.__at2ui;
        if (!ui || !ui.panel) return;
        var on = !ui.panel.visible;
        ui.panel.visible = ui.panelT.visible = on;
        if (ui.closeBtn) ui.closeBtn.visible = on;
        if (on) {
            refreshPanel(lvl);
            try {
                ui.panel.alpha = .2;
                lvl.game.add.tween(ui.panel).to({ alpha: 1 }, 160, Phaser.Easing.Linear.None, true);
            } catch (e) { }
        }
    }

    function refreshPanel(lvl) {
        var ui = lvl.__at2ui;
        if (!ui || !ui.panelT) return;
        var lines = [];
        lines.push("AWESOME TANKS 2.0 — ядер: " + cores() + ",  денег: $ " + moneyFmt(money()));
        lines.push("");

        var mods = (M.mods && M.mods.list()) || [];
        var act = mods.filter(function (m) { return m.owned && m.kind === "active"; });
        var pas = mods.filter(function (m) { return m.owned && m.kind === "passive"; });
        lines.push("АКТИВНЫЕ (клавиша — перезарядка):");
        if (act.length) {
            act.forEach(function (m) {
                lines.push("   " + (m.key || "-") + "  " + m.name + (m.cooldown > 0 ? "   [перезарядка " + m.cooldown + " с]" : "   [готово]"));
            });
        } else {
            lines.push("   ничего не куплено — загляните в хаб");
        }
        lines.push("");
        lines.push("ПАССИВНЫЕ: " + (pas.length ? pas.map(function (m) { return m.name; }).join(", ") : "нет"));
        lines.push("");
        var ars = (M.arsenal && M.arsenal.list().filter(function (a) { return a.owned; })) || [];
        lines.push("СТВОЛЫ 2.0: " + (ars.length ? ars.map(function (a) { return a.key + " " + a.name; }).join("   ") : "нет"));
        lines.push("");
        lines.push("M — закрыть.  Купить модификаторы и стволы можно в хабе 2.0.");
        ui.panelT.text = lines.join("\n");
    }

    var flashes = [];
    function flash(lvl, str, color) {
        var ui = lvl.__at2ui;
        if (!ui) return;
        var g = lvl.game;
        try {
            var t = txt(g, 22, 46, str, 17, color || COL.gold);
            lvl.__at2layer.add(t);
            var tw = g.add.tween(t.position).to({ y: 76 }, 900, Phaser.Easing.Cubic.Out, true);
            tw.onComplete.add(function () {
                try { lvl.__at2layer.remove(t); t.destroy(); } catch (e) { }
            });
        } catch (e) { }
    }

    /* =============================== ПАК =============================== */

    M.registerPack({
        id: "at2-ui",
        name: "Awesome Tanks 2.0 — интерфейс",
        version: "3.0.0",
        onReady: function () {
            var registered = false;
            var setup = function () {
                var g = window.AT && window.AT.game;
                if (g && g.state && !registered) {
                    var there = false;
                    try { there = !!(g.state.checkState && g.state.checkState("AT2Hub")); } catch (e) { }
                    if (!there) {
                        try {
                            g.state.add("AT2Hub", new Hub());
                            M.log("хаб 2.0 зарегистрирован (кнопки play ведут в AT2Hub)");
                        } catch (e) { M.warn("не удалось зарегистрировать хаб:", e); }
                    }
                    registered = true;
                }
                hookMenus();
            };
            setup();
            /* меню/уровни могут понадобиться и позже — setup идемпотентен */
            if (M.keepTrying) M.keepTrying(setup, 60);
        }
    });

    /* Бой: HUD 2.0 на каждом уровне + приветственная подсказка один раз. */
    M.on("levelCreate", function (lvl) {
        try { installBattle(lvl); } catch (e) { M.warn("бой-интерфейс 2.0:", e); }
    });

    M.ui = {
        hub: function () { try { window.AT.game.state.start("AT2Hub"); } catch (e) { } },
        panel: function () { var l = M.state(); if (l) togglePanel(l); }
    };
    M.Hub = Hub;
})();
