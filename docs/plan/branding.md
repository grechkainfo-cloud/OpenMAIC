# Фаза 1. Брендирование — план

Статус: **план утверждён, реализован.** Инструкция по применению —
[`docs/branding.md`](../branding.md).
Дата: 2026-09-18. Базовый коммит: `a8726ec`.

Что из §7 сделано и что осознанно отложено:

| # | Шаг | Статус |
|---|---|---|
| 1 | Схема конфига, `brand-server.ts`, реэкспорт `configs/brand.ts` | сделано |
| 2 | Генерируемый `app/brand-tokens.css` + импорт из `globals.css` | сделано |
| 3 | UI-места переведены на `useBrand()` / `useBrandLogo()` / `brand-server` | сделано |
| 4 | Бренд вынесен из переводов в `{{brand}}` / `{{brandAgent}}` | сделано |
| 5 | Ассеты переехали в `public/brand/`; тёмный логотип, manifest, OG-картинка | частично — нужны сами файлы бренда |
| 6 | Палитра в промптах генерации | **отложено до фазы 2.5** (переписать промпты один раз, язык + палитра) |
| 7 | PPTX-шрифт из конфига | сделано (`Segoe UI` вместо `Microsoft YaHei`) |
| 7б | Корпоративная тема в `PRESET_THEMES` | **не делалось**: список не используется ни одним потребителем, см. `docs/branding.md` §7 |
| 8 | Решение по `renderer/fonts.css` (внешний CDN) | **требует вашего решения** |
| 9 | Скрипты контраста и покрытия кириллицы | сделано |
| 10 | Lint-правило на литералы бренда и цвета | сделано |
| 11 | Скриншотные e2e | сделано (4 базовых снимка) |
| 12 | `docs/branding.md` | сделано |

---

## 1. Резюме

В репозитории **уже есть зачаток единого источника истины** — `lib/brand/brand-config.ts`
(`DEFAULT_BRAND`) и `lib/brand/brand-context.tsx` (`useBrand()`). Но им пользуются
ровно три компонента (Pro-воркбенч и рельс редактора). Все «классические» поверхности
— главная, класс, ввод кода доступа, PBL-воркспейс, метаданные Next.js — берут
название и пути к логотипам напрямую из литералов.

Поэтому задача не «построить конфиг с нуля», а **достроить существующий и перевести
на него всех потребителей**. Это заметно дешевле, чем выглядит из постановки.

Три вещи, которые конфигом не решаются и требуют отдельного решения:

1. `packages/@openmaic/renderer/fonts.css` тянет шрифты с внешнего CDN
   `https://file.maic.chat/fonts/*.woff2` — **в закрытом контуре это мёртвая ссылка**.
2. Экспорт PPTX жёстко прибит к `Microsoft YaHei` (`lib/export/use-export-pptx.ts:46`).
3. В системном промпте генерации слайдов зашиты 25 hex-цветов
   (`packages/@openmaic/generation/templates/slide-content/system.md`) — модель
   раскрашивает слайды чужой палитрой независимо от темы приложения.

---

## 2. Что уже работает как источник истины

| Файл | Что даёт |
|---|---|
| `lib/brand/brand-config.ts` | `productName`, `shortName`, `logoSrc`, `logoHasWordmark`, `markSrc`, `themeColor` |
| `lib/brand/brand-context.tsx` | `BrandProvider`, `useBrand()`, `useIsDesktop()` |

Потребители `useBrand()` на сегодня — всего три:

- `components/workbench/workspace/WorkspaceHome.tsx:65`
- `components/workbench/workspace/WorkspaceRail.tsx:234`
- `components/edit/SlideNavRail/SlideNavRail.tsx:54`

Поле `themeColor` объявлено, но **не читается нигде**: `<meta name="theme-color">`
в приложении отсутствует, web manifest тоже отсутствует. Это мёртвый код — оживить
или убрать.

---

## 3. Инвентаризация: где сейчас зашит бренд

### 3.1 Интерфейс (обязательно перевести на конфиг)

| Место | Файл:строка | Что зашито | Действие |
|---|---|---|---|
| Метаданные страницы | `app/layout.tsx:32-35` | `title: 'OpenMAIC'`, английский `description` | из конфига + i18n |
| Атрибут `<html lang>` | `app/layout.tsx:42` | `lang="en"` жёстко | из выбранной локали (фаза 2) |
| Логотип на главной | `app/page.tsx:836-837` | `src="/logo-horizontal.png"`, `alt="OpenMAIC"` | `useBrand()` |
| Слоган на главной | `app/page.tsx:865`, ключ `home.slogan` | название внутри перевода | интерполяция `{{brand}}` |
| Футер главной | `app/page.tsx:1349` | `OpenMAIC Open Source Project` | из конфига или убрать |
| Модалка кода доступа | `components/access-code-modal.tsx:121` | `OpenMAIC` | `useBrand()` |
| Сайдбар класса | `components/stage/scene-sidebar.tsx:134` | `/logo-horizontal.png`, `alt="OpenMAIC"` | `useBrand()` |
| PBL-воркспейс | `components/scene-renderers/pbl/v2/workspace.tsx:445-446` | `/openmaic-mark.png`, `alt="OpenMAIC"` | `useBrand()` |
| Слоган в воркбенче | `components/workbench/workspace/WorkspaceHome.tsx:161` | ключ `home.slogan` | интерполяция |
| Заголовки вкладок | — | per-page `title` отсутствует | шаблон из конфига |

### 3.2 Строки локализации

| Файл | Вхождений | Где | Комментарий |
|---|---|---|---|
| `lib/i18n/locales/*.json` (12 файлов) | 2 на файл | `…emptyHint` («MAIC Agent»), `skills.builtinDetailNote` («ships with OpenMAIC») | вынести бренд в `{{brand}}` |
| `lib/i18n/workbench-locales/*.json` (10 файлов) | 1 на файл | `…officialDownload` | то же |
| `lib/i18n/workbench.ts:110,412` | 2 | hardcoded en/zh карта | то же |
| `lib/i18n/locales/ru-RU.json` → `home.slogan` | 1 | значение равно английскому оригиналу | слоган переезжает в конфиг бренда |

Правило: **бренд никогда не лежит в теле перевода**. В JSON остаётся
`"Официальный навык {{brand}}"`, значение подставляется из конфига.

### 3.3 Статические файлы

| Путь | Что это | Замена |
|---|---|---|
| `public/logo-horizontal.png` | горизонтальный логотип с вордмарком, 144 КБ | да |
| `public/openmaic-mark.png` | квадратный знак, 15 КБ | да |
| `app/favicon.ico` | фавикон | да |
| `app/apple-icon.png` | иконка iOS | да |
| `assets/logo-horizontal.png`, `assets/banner.png` | только для README | да, либо выкинуть README-маркетинг |
| `assets/*.gif` (≈60 МБ), `assets/voxcpm/*.png`, `assets/feishu-qrcode.png` | демо апстрима для README | удалить из форка |
| `public/avatars/*` (32 файла) | аватары агентов, нейтральные | оставить |
| `public/logos/*` (34 файла) | логотипы **сторонних** провайдеров (OpenAI, Qwen, FunASR…) | оставить, это не наш бренд |

**Отсутствуют и должны появиться:** тёмный вариант логотипа, SVG-версии,
`app/icon.png` (Next.js генерирует по нему набор иконок), `manifest.webmanifest`,
`app/opengraph-image.*`.

### 3.4 Экспорт и рендер

| Место | Файл:строка | Что зашито | Действие |
|---|---|---|---|
| PPTX, шрифт по умолчанию | `lib/export/use-export-pptx.ts:46` | `DEFAULT_FONT_FAMILY = 'Microsoft YaHei'` | из конфига, см. §6.3 |
| Видеоэкспорт, markdown | `lib/video-export/emit-hyperframes/index.ts:1163` | `— OpenMAIC video export` | из конфига |
| Видеоэкспорт, `<title>` | `lib/video-export/emit-hyperframes/index.ts:1312` | `— OpenMAIC video` | из конфига |
| Имена font-family в видео | `lib/video-export/emit-hyperframes/noto-*-assets.ts`, `scripts/generate-video-export-noto-*.mjs` | `OpenMAIC Noto Sans Cyrillic` и т. п. | внутренние идентификаторы; генератор один, переименование дёшево, но не обязательно |
| Шрифты рендерера слайдов | `packages/@openmaic/renderer/fonts.css` | 6 `@font-face` на `https://file.maic.chat/…` | **блокер офлайна**, см. §6.5 |

### 3.5 Инфраструктура и служебные заголовки

| Место | Что зашито | Действие |
|---|---|---|
| `package.json:2` | `"name": "openmaic"` | переименовать |
| `docker-compose.yml` | сервис `openmaic`, тома `openmaic-data` / `openmaic-postgres`, `POSTGRES_DB/USER=openmaic` | переименовать осознанно: смена имени тома на живом стенде = потеря данных |
| `render-service/package.json:6` | описание с «OpenMAIC issue #866» | косметика |
| `packages/docs/lib/shared.ts:1,9` | `appName = 'OpenMAIC'`, `repo: 'OpenMAIC'` | сайт документации; решить, нужен ли форку |
| `lib/web-search/searxng.ts:17` | `User-Agent: … OpenMAIC/1.0; +https://github.com/THU-MAIC/OpenMAIC` | заменить на свой UA |
| `lib/web-search/minimax.ts:76` | заголовок `MM-API-Source: OpenMAIC` | внешний провайдер, в контуре не используется — оставить |
| `lib/chat/pi/element-reference.ts:111` | `X-OpenMAIC-Element-Reference-Accepted` | **не трогать**: идентификатор протокола, завязан на `components/chat/element-reference-receipt.ts` и e2e |
| `.github/**` | workflow апстрима (`THU-MAIC/OpenMAIC`, publish-skill) | вычистить из форка отдельной задачей |
| `e2e/pages/home.page.ts:11` | локатор `img[alt="OpenMAIC"]` | перевести на `data-testid`, а не на `alt` |
| `skills/openmaic/SKILL.md` | пакет навыка для внешних воркбенчей | в закрытом контуре не нужен, решить судьбу |

### 3.6 Чего в проекте нет (проверено, отсутствует)

- писем и шаблонов рассылки;
- текстов шаринга и OG-разметки;
- web manifest и `<meta name="theme-color">`;
- страницы входа как таковой — есть только модалка `ACCESS_CODE`; настоящая страница
  появится в фазе 5, брендировать её будем там.

---

## 4. Предлагаемая архитектура

### 4.1 Расположение

Постановка предлагает `configs/brand.ts`. Рекомендую **оставить модуль в `lib/brand/`**
и расширить его, а не заводить второй источник истины:

- `lib/brand/brand-config.ts` — схема и значения (уже есть, дописать поля);
- `lib/brand/brand-context.tsx` — React-доступ (уже есть);
- `lib/brand/brand-server.ts` — **новый**, синхронный доступ для `generateMetadata`,
  серверных роутов и экспорта, где React-контекст недоступен;
- `configs/brand.ts` — тонкий реэкспорт, если формулировка «конфиг лежит в `configs/`»
  принципиальна.

### 4.2 Схема

```ts
export interface BrandConfig {
  productName: string;          // полное название
  shortName: string;            // для узких мест
  slogan: string;               // переезжает из home.slogan
  legalFooter?: string;         // заменяет «OpenMAIC Open Source Project»
  supportContact: string;       // почта или телефон техподдержки
  logo: {
    light: string;
    dark: string;
    mark: string;
    hasWordmark: boolean;
  };
  favicon: string;
  themeColor: string;           // оживить: <meta name="theme-color">
  palette: { primary: string; primaryForeground: string; accent: string /* … */ };
  fonts: {
    ui: string;                 // CSS font-family интерфейса
    slideDefault: string;       // дефолт рендерера слайдов
    pptxExport: string;         // имя шрифта в .pptx
    slidePromptFamily: string;  // что подставляем в промпт генерации
  };
  userAgent: string;            // для исходящих запросов
}
```

### 4.3 Как значения доезжают до каждого слоя

| Слой | Механизм |
|---|---|
| React-компоненты | `useBrand()` |
| `generateMetadata`, серверные роуты | импорт из `lib/brand/brand-server.ts` |
| i18n | `i18next` уже настроен на `{{…}}` (`lib/i18n/config.ts`); добавить `brand` как глобальную переменную интерполяции |
| Tailwind / CSS | генерируемый на билде `app/brand-tokens.css` с `:root` и `.dark`; `app/globals.css` его импортирует |
| Промпты генерации | палитра подставляется в шаблон переменной — движок `{{…}}` уже есть (`lib/prompts/loader.ts`, `packages/@openmaic/generation/src/prompts/loader.ts`) |
| PPTX и видеоэкспорт | импорт из `brand-server.ts` |

**Критерий «смена бренда не требует правок в `components/` и `app/`» формулируется
как lint-правило:** запретить литерал названия и hex-литералы вне `lib/brand/`,
`app/brand-tokens.css` и явного списка исключений (логотипы сторонних провайдеров,
офисные палитры `PRESET_THEMES`). Иначе критерий останется декларацией.

---

## 5. Тема, палитра, контраст

Сейчас токены живут в `app/globals.css` (`@theme inline` + `:root` + `.dark`);
`--primary` = `#722ed1` в светлой теме и `#8b47ea` в тёмной, остальное — нейтральный
shadcn-набор в `oklch`. База нормальная, архитектуру менять не нужно — нужно вынести
значения в генерируемый файл.

Отдельно проверить и починить:

1. **Рендерер слайдов** (`components/slide-renderer/`) берёт цвета из DSL-элементов,
   а не из CSS-переменных. Палитра слайдов приходит из `configs/theme.ts`
   (`PRESET_THEMES`, 16 тем, у всех `fontname: ''`). Добавить корпоративную тему
   первой в список и сделать её дефолтом.
2. **Сгенерированные слайды и интерактивные сцены.** Hex-литералы в промптах:
   `slide-content/system.md` — 25, `visualization3d-content/system.md` — 17,
   `procedural-skill-content/system.md` — 13, плюс по 3 в `slide-content/user.md`
   и `procedural-skill-content/user.md` и 1 в `game-content/system.md`.
   Это и есть «чужая палитра, зашитая в промпт».
3. **Доска.** `lib/prompts/snippets/whiteboard-reference.md` содержит `#333333`,
   `#5b9bd5`, `#000000` в примерах для модели — тоже подстановка.
4. **Графики.** `configs/chart.ts` и `--chart-1..5` в `globals.css` — две палитры,
   свести к одной.
5. **WCAG AA.** Проверить скриптом на `tinycolor2` (уже в зависимостях) пары
   `foreground/background`, `primary-foreground/primary`, `muted-foreground/background`,
   `destructive-foreground/destructive` в обеих темах. Текущий
   `--muted-foreground: oklch(0.556 0 0)` на белом даёт около 4.6:1 — для обычного
   текста проходит, но под новую палитру это надо пересчитать, а не унаследовать на веру.

---

## 6. Шрифты — решение принимается здесь, с учётом фазы 2

### 6.1 Что уже сделано правильно

`app/layout.tsx:16-29` содержит развёрнутый комментарий: `next/font` подгружал
**только latin-субсет**, и кириллица уезжала в системный фолбэк — разной гарнитурой
посреди слова. Починено переходом на `@fontsource-variable/inter`, который отдаёт
по одному `@font-face` на `unicode-range`. Инвариант уже зафиксирован в коде —
его нельзя сломать при смене шрифта.

### 6.2 Рекомендация

| Путь вывода | Шрифт | Обоснование |
|---|---|---|
| Веб-интерфейс | **Inter Variable** (`@fontsource-variable/inter`, уже стоит) | вариативный, поэтому кириллица есть во всех весах по построению, а не «только в regular»; ставится из npm, интернет в рантайме не нужен |
| Рендерер слайдов, дефолт | Inter | одна типографика с интерфейсом |
| Экспорт PPTX | **не `Microsoft YaHei`**, см. §6.3 | |
| Видеоэкспорт | Noto Sans Cyrillic (инлайнится) + `fonts-noto-core` в образе | уже есть, см. §6.4 |

Если корпоративный шрифт задан регламентом, он проходит **только** при наличии
кириллицы во всех используемых начертаниях, и проверка обязана быть автоматической:
скрипт на `fontkit` (уже в devDependencies) читает `cmap` каждого файла и требует
покрытия U+0410–U+044F, U+0401, U+0451.

Шрифты из `configs/font.ts`, предлагаемые в пикере редактора: Roboto, Open Sans,
Montserrat, Source Sans 3, Merriweather, Literata, Source Serif 4, JetBrains Mono.
Все восемь в версиях `@fontsource` имеют кириллические субсеты, но
`app/editor-fonts.ts` импортирует только `400.css` и `700.css` — надо прогнать
скриптом покрытия и вычистить те, где кириллицы нет, иначе пользователь выберет
шрифт и получит подмену гарнитуры.

### 6.3 PPTX — отдельное решение, нужен ваш выбор

`pptxgenjs` **не встраивает шрифты** в файл. Значит, шрифт обязан присутствовать
на машине, где файл откроют. Варианты:

- **Segoe UI** — есть на любой Windows начиная с Vista, полная кириллица. Наименьший риск.
- **Calibri / Arial** — то же, выглядят «по-офисному».
- **Корпоративный шрифт** — только если он раскатан групповой политикой на все рабочие места.
- `Microsoft YaHei` (текущее) — кириллицу формально содержит, но это китайская
  гарнитура, русский текст в ней выглядит чужеродно.

Проверяется только открытием реального `.pptx` в PowerPoint на типовой рабочей
станции. Из кода это не проверить.

### 6.4 Что уже готово к кириллице (проверено в коде)

- `lib/video-export/emit-hyperframes/noto-script-font-assets.ts:8` инлайнит
  `OpenMAIC Noto Sans Cyrillic` с явным `unicode-range` на U+0400-045F, U+0490-0491,
  U+04B0-04B1, U+2116 плюс расширенный блок; там же (строка 37) есть проверочная
  строка `requiredFontLoads: [{ family: …, text: 'Привет Ёж Ԁ' }]`.
- `render-service/Dockerfile` ставит `fonts-noto-core` — кириллица в контейнере есть.
- `lib/export/inline-assets.ts:265-354` при инлайне HTML предпочитает woff2 и
  отбрасывает woff/ttf-сиблинги, но **не режет `unicode-range`**. Автоматического
  сабсеттинга, который выкусывает кириллицу, в коде нет.

Вывод: пункт 2.3 постановки во многом уже закрыт апстримом. Проверять на собранных
артефактах всё равно надо, но переписывать нечего.

### 6.5 Блокер офлайна

`packages/@openmaic/renderer/fonts.css` — шесть `@font-face` на
`https://file.maic.chat/fonts/*.woff2`. Файл генерируемый (`fonts.config.mjs`,
`pnpm run genfonts`). В закрытом контуре эти шрифты не загрузятся никогда.
Решить: либо вендорить woff2 в `public/fonts/` и перегенерировать CSS на локальные
пути, либо выкинуть блок целиком — эти шрифты нужны только для слайдов,
импортированных из китайских PPTX.

Отдельно: `render-service/Dockerfile` собирается из `snapshot.debian.org`, то есть
**сборка образа требует интернета**. Для контура нужен либо внутренний зеркальный
репозиторий, либо сборка снаружи и перенос образа.

---

## 7. План работ

| # | Шаг | Результат |
|---|---|---|
| 1 | Расширить `BrandConfig`, добавить `brand-server.ts`, реэкспорт `configs/brand.ts` | схема готова |
| 2 | Генерируемый `app/brand-tokens.css`, импорт из `globals.css` | палитра в одном месте |
| 3 | Перевести 8 мест из §3.1 на `useBrand()` / `brand-server` | нет литералов в UI |
| 4 | Вынести бренд из переводов в `{{brand}}`, слоган — в конфиг | i18n чист |
| 5 | Заменить ассеты, добавить тёмный логотип, `icon.png`, manifest, OG-картинку | бренд виден |
| 6 | Подстановка палитры в промпты (slide / 3d / procedural / whiteboard) | сцены в нашей палитре |
| 7 | PPTX-шрифт и корпоративная тема первой в `PRESET_THEMES` | экспорт в бренде |
| 8 | Решение по `renderer/fonts.css` — вендорить или удалить | офлайн работает |
| 9 | Скрипты проверки: контраст WCAG AA, покрытие кириллицы через `fontkit` | автоматика |
| 10 | Lint-правило на литералы бренда и hex вне разрешённых путей | защита от регресса |
| 11 | Скриншотные e2e: главная, класс, страница входа, обе темы | приёмка |
| 12 | `docs/branding.md` — инструкция по смене бренда | сдача |

Шаги 1–5 и 11–12 от фазы 2 не зависят. Шаг 6 лучше делать **после** фазы 2.5,
чтобы переписать промпты один раз (язык и палитра вместе), а не два.

---

## 8. Приёмка

- Смена названия, палитры и логотипов делается правкой `lib/brand/brand-config.ts`
  и заменой файлов в `public/brand/`; `git diff` не задевает `components/` и `app/`
  (кроме сгенерированного `app/brand-tokens.css`).
- Скриншотные e2e через `toHaveScreenshot()`. **В проекте сейчас нет ни одного
  скриншотного теста** — инфраструктуру заводим с нуля; `playwright.config.ts` уже
  настроен на один проект chromium и порт 3002.
- Скрипт контраста проходит для всех пар в светлой и тёмной теме.
- Скрипт покрытия кириллицы проходит для всех начертаний выбранного шрифта.

---

## 9. Что я не могу проверить — нужно ваше решение или доступ

1. **Собственно бренд.** Название, короткое название, слоган, палитра, шрифт,
   контакт поддержки, юридическая строка футера — этих данных у меня нет.
2. **Корпоративный шрифт:** существует ли, лицензирован ли для веб-встраивания,
   раскатан ли на рабочие станции групповой политикой. Последнее критично для PPTX.
3. **PPTX в реальном PowerPoint** — проверяется только открытием файла на типовой
   рабочей станции, из кода не оценивается.
4. ~~**Судьба апстрим-артефактов.**~~ Решено и выполнено: удалены `packages/docs`,
   `skills/openmaic`, `assets/` (демо-GIF, ~83 МБ), `community/`, `README-zh.md`,
   `CONTRIBUTING.md`, `SECURITY.md`, шаблоны issue и PR, триаж, workflow публикации
   в npm и ClawHub. `README.md` переписан под форк. В `.github/workflows` оставлены
   `ci.yml` (без задачи `issue-triage`) и `storage-pg-contract.yml`: форку нужен
   собственный прогон тестов, а контракт хранилища понадобится в фазе 4.
5. **Переименование в `docker-compose.yml`:** смена имён томов на существующем стенде
   равна потере данных. Если стенд уже поднят — нужна процедура миграции.
6. **`LICENSE` и авторские уведомления в исходниках сохраняются без изменений** —
   этого требует MIT, и смена бренда этого не отменяет. В список на удаление они не входят.
