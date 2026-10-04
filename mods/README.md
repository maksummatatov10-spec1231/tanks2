# Awesome Tanks 2 — Mod Kit

Мод-кит для HTML5-версии **Awesome Tanks 2**: новые уровни, ребаланс, свои
команды и инструменты. **В ките нет ни одного файла игры** — только собственный
код и собственные карты, поэтому его можно публиковать, не нарушая авторские права.
Как это правильно выложить — см. [../PUBLISHING.md](../PUBLISHING.md).

## Состав

```
mods/
├── mod-loader.js                     ядро: подключается к игре и даёт API
├── packs/
│   └── demo-pack.js                  пример пака: 3 свои карты + баланс
├── install/
│   └── index-template.html           чистая страница запуска (для установщика)
├── userscript/
│   └── awesome-tanks-2-modkit.user.js   версия для Tampermonkey (без установки)
├── LICENSE                           MIT — только на код кита
└── README.md                         этот файл
```

Ядро (`mod-loader.js`) перехватывает `window.AT.SETTINGS` и `window.AT.LEVELS` —
то есть правит настоящие данные игры в момент их создания, а не копию.
После старта игры появляется объект `window.MOD` с командами.

---

## Установка

### Вариант 1. Вручную (30 секунд)

В своей копии игры открой `index.html` и добавь **одну строку** перед
подключением игры:

```html
<script src="mods/mod-loader.js"></script>
<script src="mods/packs/demo-pack.js"></script>   <!-- если нужен пак -->
<script src="awesome_tanks_2.js"></script>
```

Скопируй папку `mods/` рядом с `awesome_tanks_2.js`. Всё.

### Вариант 2. Установщиком

```bash
node tools/at2-mod-installer.js --game "/путь/к/папке/с/игрой"
node tools/at2-mod-installer.js --game "..." --packs demo-pack     # только один пак
node tools/at2-mod-installer.js --game "..." --dry-run             # посмотреть план
node tools/at2-mod-installer.js --game "..." --uninstall           # откатить
```

Установщик сам копирует `mods/`, аккуратно вставляет блок между маркерами
`<!-- AT2MOD:BEGIN --> … <!-- AT2MOD:END -->` в `index.html`, делает бэкап
`.at2mod.bak` и умеет полностью откатывать изменения. Если `index.html` в копии
игры нет, он создаст его из чистого шаблона `mods/install/index-template.html`.

### Вариант 3. Userscript (ничего не устанавливается вообще)

Файл `userscript/awesome-tanks-2-modkit.user.js` — самодостаточная версия кита.
Ставится в Tampermonkey/Greasemonkey и работает прямо на странице игры
(CoolMath, CrazyGames и др. — список доменов в `@match`).
Это самый «чистый» способ публикации: ты не распространяешь ни файлов игры,
ни её копий — только свой скрипт.

---

## Что умеет `window.MOD`

```js
MOD.help();                 // список команд
MOD.money(500000);          // поставить деньги
MOD.addMoney(10000);
MOD.unlockAll();            // открыть все 15 уровней
MOD.setLevels(7);
MOD.setDifficulty(2);       // 0 легко, 1 средне, 2 сложно
MOD.maxWeapons(5);          // все пушки 5 ур. + полный боезапас
MOD.maxUpgrades();          // корпус/башня/обзор/скорость на максимум
MOD.refillAmmo();
MOD.ammo("rockets", 45);
MOD.god(true);              // бессмертие (false — выключить)
MOD.heal(); MOD.killAll();
MOD.listLevels();           // 42 карты, включая служебные
MOD.playLevel(34);          // прыгнуть на уровень («Bosses: Shotgun»)
MOD.toMenu();
MOD.reset();                // стереть сохранение
MOD.profile(); MOD.state(); // сохранение и текущее состояние игры
```

Всё это работает в консоли браузера (F12) на запущенной игре.

---

## Как написать свой пак

Пак — обычный JS-файл, который регистрируется в ядре:

```js
(function () {
    var MOD = window.MOD;
    MOD.registerPack({
        id: "my-mod",                   // уникальный идентификатор
        name: "Моя кампания",
        version: "1.0.0",
        author: "ты",

        // 1) правка баланса: цены, патроны, достижения
        patchSettings: function (S) {
            S.PRICES.armor = [100, 200, 300, 400, 500];
            S.AMMO_LIMITS.shotgun = 500;
        },

        // 2) замена карт кампании (levels[0..14] — 15 уровней меню)
        patchLevels: function (levels) {
            levels[0] = ["Мой уровень", "snow",
                "█████████████",
                "█ ☻   ○    █",
                "█  1   2   █",
                "█     □    █",
                "█████████████"];
        },

        // 3) команды после старта игры
        onReady: function (MOD) {
            MOD.myCommand = function () { console.log("работает"); };
        }
    });
})();
```

Подключение пака — строка в `index.html` после ядра:

```html
<script src="mods/mod-loader.js"></script>
<script src="mods/packs/my-mod.js"></script>
```

или списком в конфиге ядра: `CONFIG.packs = ["mods/packs/my-mod.js"]`.

### Правила карт

* Формат: `["Имя", "terrain", "строка", "строка", …]`, terrain — `grass` / `snow` / `desert`.
* Ровно **один** `☻` — точка старта игрока.
* Минимум один враг/спавнер: победа = не осталось живых врагов.
* Рамка из `█` по периметру, удобнее держать все строки одной длины.
* Легенда: `█` стена, `░▒` кирпичи, `#` дерево, `○` бочка, `□` ящик,
  `◘` ворота, `▓` секретная стена, `1…7` спавнеры (тир 1 — самый слабый),
  турели `m s c r l f x t`, боссы `S C R L T F X`, танки `❶…❾`, пробел — земля.
* Незнакомый символ превращается в траву, игра не падает.
* Меню уровней жёстко рисует **15** кнопок — поэтому паки меняют существующие
  15 карт; добавить 16-й уровень в кампанию можно, но придётся править меню
  и атлас кнопок.

Быстрая проверка своей карты (связность и старт):

```bash
python3 - <<'PY'
# вставь свой список строк между тройными кавычками
rows = """
█████████
█ ☻   1 █
█       █
█████████""".strip("\n").split("\n")
from collections import deque
g = [list(r) for r in rows]; H, W = len(g), len(g[0])
start = next(((x, y) for y in range(H) for x in range(W) if g[y][x] == "☻"), None)
seen = {start}; q = deque([start])
while q:
    x, y = q.popleft()
    for dx, dy in ((1,0),(-1,0),(0,1),(0,-1)):
        nx, ny = x+dx, y+dy
        if 0 <= nx < W and 0 <= ny < H and (nx,ny) not in seen and g[ny][nx] != "█":
            seen.add((nx,ny)); q.append((nx,ny))
bad = [(x,y,c) for y in range(H) for x in range(W)
       if (c := g[y][x]) not in " █░▒#○□◘▓☻1234567mcrlsfxtSRLTFCX❶❷❸❹❺❻❼❽❾"]
print("старт:", start, "| недостижимые цели:",
      [(x,y) for y in range(H) for x in range(W)
       if g[y][x] in "1234567mcrlsfxtSRLTFCX❶❷❸❹❺❻❼❽❾" and (x,y) not in seen] or "нет")
print("неизвестные символы:", bad or "нет")
PY
```

### Полезные точки для правок (по файлу `awesome_tanks_2.js`)

| Что | Где |
|---|---|
| Цены, лимиты патронов, достижения | `AT.SETTINGS` (через `patchSettings`) |
| Карты уровней | `AT.LEVELS` (через `patchLevels`) |
| Урон/темп оружия | массивы в конструкторе `Player` |
| Здоровье и зрение врагов | конструкторы танков, `spawnTypes` у спавнеров |
| Цена монеты | формула в `Level.collect` |
| Подробный разбор | [../ANALYSIS.md](../ANALYSIS.md) |

---

## Проверка кита

```bash
npm i jsdom            # один раз, для тестов ядра
npm test               # или вручную:
node tools/test-modkit.js      # 42 проверки: перехват AT, правки, команды MOD
bash tools/test-installer.sh   # 17 проверок: установка, повтор, откат, шаблон
```

Тесты работают без самой игры: подделывают `window.AT` в jsdom и проверяют, что
ядро и паки правильно применяют правки к данным игры.

## Отладка

| Симптом | Причина / решение |
|---|---|
| Пустой экран, игра не стартует | открыто через `file://` — нужен http-сервер (`python3 -m http.server 8080`) |
| `ReferenceError: showBanner is not defined` | страница игры не объявляет заглушку; ядро делает это само, проверь, что оно подключено раньше игры |
| `[modkit] не удалось загрузить пак` | неверный путь в `CONFIG.packs` |
| Правки не видны | пак загрузился **после** `window.AT.SETTINGS` был присвоен; тем не менее ядро применяет паки задним числом — проверь консоль на ошибку в паке |
| Изображения «missing texture» | отсутствует файл ассета в папке игры (см. `MenuLoading.loadAssets`) |
| В меню уровней нестандартная карта | пак заменил карту — так и задумано; `MOD.playLevel(16..42)` откроет служебные карты |

Консоль браузера — основной инструмент: ядро и паки пишут туда всё, что делают.

---

## Лицензия

Код кита — MIT (`LICENSE`). Игра «Awesome Tanks 2», её графика, звук, шрифт и
сборка принадлежат правообладателям (Coolmath Games; автор оригинала —
*emittercritter*, HTML5-порт — Mad Buffer) и в состав кита не входят.
Публикация мода — [../PUBLISHING.md](../PUBLISHING.md).
