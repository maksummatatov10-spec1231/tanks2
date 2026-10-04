# Awesome Tanks 2 — локальная сборка и разбор

В репозитории лежит скачанная HTML5-версия игры **Awesome Tanks 2**
(Phaser 2.6.2 + Box2D) вместе с рекламной обвязкой портала.

* **[ANALYSIS.md](ANALYSIS.md)** — полный анализ: что за файлы, как устроен код,
  вся игровая математика (оружие, апгрейды, враги, экономика), формат уровней,
  найденные баги и список того, что можно менять.
* **[mods/README.md](mods/README.md)** — мод-кит: установка, формат паков, свои уровни.
* **[PUBLISHING.md](PUBLISHING.md)** — как выложить мод так, чтобы ничего не нарушить
  (что можно и нельзя класть в релиз, три схемы публикации, шаблоны).

## Мод-кит

Всё, что нужно для своей модификации и её публикации:

| Файл | Назначение |
|---|---|
| `mods/mod-loader.js` | ядро: перехватывает `AT.SETTINGS` / `AT.LEVELS`, даёт команды `MOD.*` |
| `mods/packs/demo-pack.js` | пример пака: 3 свои карты + ребаланс (подключён в `index.html`) |
| `mods/install/index-template.html` | чистая страница запуска для установщика |
| `mods/userscript/awesome-tanks-2-modkit.user.js` | версия для Tampermonkey (без установки файлов) |
| `tools/at2-mod-installer.js` | установщик/деинсталлятор мода в копию игры |
| `tools/test-modkit.js` | тесты ядра (нужен `npm i jsdom`) |

```bash
node tools/at2-mod-installer.js --game "/путь/к/копии/игры"   # поставить
node tools/at2-mod-installer.js --game "..." --uninstall      # откатить
```

В консоли игры после запуска: `MOD.help()`. Паки пишутся как `MOD.registerPack({...})` —
подробности и правила карт в [mods/README.md](mods/README.md).

## Запуск

```bash
python3 -m http.server 8080
# открыть http://localhost:8080/
```

Открывать именно `index.html` (чистая локальная версия), а не `(index)` —
последний тянет рекламный SDK и логотип игрового портала.

> Запускать нужно через http-сервер. При открытии `file://` браузер заблокирует
> загрузку JSON-атласов, и игра застрянет на экране загрузки.

## Структура

| Путь | Что это |
|---|---|
| `index.html` | локальный запуск игры (без рекламы/аналитики) |
| `(index)` | оригинальная страница CoolMath Games + врезки портала igroutka.ru |
| `awesome_tanks_2.js` | сама игра (весь код + движок в одном файле) |
| `sdk.js` | рекламный SDK GameMonetize (игрой не используется) |
| `_anonymous code_` | бандл эмулятора Flash Ruffle (не используется) |
| `mods/mod-loader.js` | точка расширения: правки настроек/уровней и консольные команды `MOD.*` |
| `tools/make-help-placeholders.sh` | генератор недостающих картинок помощи (нужен ImageMagick) |
| `images/ sounds/ scripts/ styles/ fonts/` | ассеты игры (в `.gitignore`, в Git не коммитятся) |

## Быстрый чит-лист

С чистым `index.html` в консоли браузера доступно:

```js
MOD.help();          // все команды
MOD.money(999999);
MOD.unlockAll();
MOD.maxWeapons(5);
MOD.maxUpgrades();
MOD.god(true);
```

Без мод-лоадера: `AT.profile.current.game.money = 1e6; AT.profile.save();`

## Правовая заметка

Игра и ассеты принадлежат правообладателям (Coolmath Games; автор оригинала —
*emittercritter*, HTML5-порт — Mad Buffer). Ассеты исключены из репозитория
через `.gitignore` — публикуйте только код правок, без графики, музыки и шрифтов.
