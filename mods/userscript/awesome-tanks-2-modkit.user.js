// ==UserScript==
// @name         Awesome Tanks 2.0 — Mod Kit (unofficial)
// @name:ru      Awesome Tanks 2.0 — мод-кит (неофициальный)
// @namespace    at2-modkit
// @version      3.0.0
// @description  Unofficial 2.0 mod for Awesome Tanks 2: better menu, smoother physics, 15 extra maps alongside the original ones, 6 new weapons, 20 purchasable modifiers and a second currency. Ships no game files.
// @description:ru Неофициальный мод 2.0 для Awesome Tanks 2: новое меню, приятнее физика, 15 новых карт в дополнение к старым, 6 новых пушек, 20 покупаемых модификаторов и вторая валюта. Файлов игры не содержит.
// @author       you
// @license      MIT
// @homepageURL  https://example.invalid/at2-modkit
// @supportURL   https://example.invalid/at2-modkit/issues
// @run-at       document-start
// @grant        none
//
// Мод грузится из этого же репозитория: скрипт лишь подключает те же файлы,
// что и обычная установка (mods/*.js). Если делаешь форк — замени USER/REPO
// или укажи свой тег вместо main (например @v3.0.0).
//
// @require      https://raw.githubusercontent.com/maksummatatov10-spec1231/tanks2/main/mods/mod-loader.js
// @require      https://raw.githubusercontent.com/maksummatatov10-spec1231/tanks2/main/mods/packs/at2-core.js
// @require      https://raw.githubusercontent.com/maksummatatov10-spec1231/tanks2/main/mods/packs/at2-campaign.js
// @require      https://raw.githubusercontent.com/maksummatatov10-spec1231/tanks2/main/mods/packs/at2-weapons.js
// @require      https://raw.githubusercontent.com/maksummatatov10-spec1231/tanks2/main/mods/packs/at2-modifiers.js
// @require      https://raw.githubusercontent.com/maksummatatov10-spec1231/tanks2/main/mods/packs/at2-ui.js
//
// @match        *://*.coolmathgames.com/*
// @match        *://*.coolmath.com/*
// @match        *://*.crazygames.com/*
// @match        *://*.gamemonetize.com/*
// @match        *://*.igroutka.ru/*
//
// Если игра открывается на другом домене — добавь свою строку @match.
//
// ВАЖНО: это неофициальный мод, не связанный с Coolmath Games и автором игры
// (emittercritter). Игра и её материалы принадлежат правообладателям и здесь
// не распространяются: скрипт лишь достраивает поведение на стороне игрока.
// ===================================================================
// Что даёт (после установки файлов выше):
//   * новое меню: хаб 2.0 вместо ванильного выбора уровня (кнопка play ведёт в него);
//   * 15 новых карт (уровни 16..30) в дополнение к 15 оригинальным;
//   * 6 новых стволов: Z X C V B N;
//   * 20 модификаторов (ноуклип, щит, рывок, гусеницы «Вихрь» и т.д.) за ядра — вторую валюту;
//   * физика с инерцией, ядра за убийства и зачистку, панель мода по клавише M;
//   * консольные команды window.MOD (деньги, уровни, ядра, модификаторы).
//
// Если менеджер юзерскриптов не умеет @require с raw.githubusercontent.com,
// поставь мод обычным способом: node tools/at2-mod-installer.js --game "<папка игры>".
// ===================================================================
(function () {
    "use strict";

    // Ничего не делаем, если сам мод-кит не подгрузился (@require мог не сработать).
    function boot() {
        if (!window.MOD) {
            console.warn("[at2] мод-кит не загрузился: проверь @require или поставь мод установщиком");
            return;
        }
        console.log("[at2] Awesome Tanks 2.0 — мод-кит v" + window.MOD.version + " готов. Команды: MOD.help()");

        // Необязательные подарки: правь здесь, если хочется начать с запасом.
        // window.MOD.CONFIG.startMoney = 5000;
        // window.MOD.CONFIG.unlockLevels = 15;
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", boot);
    } else {
        boot();
    }
})();
