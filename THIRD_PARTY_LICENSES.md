# THIRD_PARTY_LICENSES

Политика (plan-4 §205): в коммерческий продукт встраиваются только
permissive-зависимости — MIT, Apache-2.0, BSD-2/3-Clause, ISC, 0BSD,
Unlicense, CC0-1.0. GPL/AGPL/LGPL/MPL/SSPL/BSL, fair-code и source-available
исключены без отдельного юридического решения.

## Как это проверяется

```bash
npm run licenses        # = node scripts/check-licenses.mjs
npm run check           # typecheck + tests + license gate
```

Скрипт сканирует ВСЕ установленные пакеты (включая транзитивные) по
`node_modules/.package-lock.json`, сверяет SPDX-идентификатор с allowlist и
падает с ненулевым кодом при нарушении. Актуальный машинный манифест:
`third-party-licenses.json` (перегенерируется при каждом запуске).

## Исключения (каждое — с причиной, план-4 §205)

| Пакет | Лицензия | Причина |
|---|---|---|
| `@img/sharp-win32-x64` | Apache-2.0 AND LGPL-3.0-or-later | нативный бинарник libvips, ставится Next.js для оптимизации изображений; используется немодифицированным на сервере, не распространяется как наш код (см. §207/§249) |
| `caniuse-lite` | CC-BY-4.0 | таблицы данных browserslist, не исполняемый код |
| `lightningcss` (+ win32-binary) | MPL-2.0 | dev-only инструмент сборки Tailwind, в продукт не попадает |
| `lru-cache` | BlueOak-1.0.0 | современная permissive-лицензия, эквивалент MIT; dev-only (toolchain) |

## Ключевые прямые зависимости (все permissive)

| Пакет | Лицензия | Назначение |
|---|---|---|
| next, react, react-dom | MIT | фреймворк/UI |
| @supabase/supabase-js, @supabase/auth-helpers-nextjs | MIT | backend/данные |
| @radix-ui/* (30 пакетов) | MIT | UI-примитивы |
| tailwindcss, tailwind-merge, clsx, class-variance-authority | MIT/Apache-2.0 | стили |
| lucide-react | ISC | иконки |
| cmdk, sonner | MIT | UI |
| recharts | MIT | графики |
| zod, react-hook-form | MIT | валидация/формы |
| lz-string, uuid | MIT | сжатие localStorage / идентификаторы |
| vitest, @vitest/*, playwright | Apache-2.0/MIT | тесты (dev) |

Полный список — в `third-party-licenses.json`.

## Правила изменений

1. Новая зависимость → прогнать `npm run licenses`, добавить в таблицу выше.
2. Новое исключение → только с причиной в `scripts/check-licenses.mjs`
   (LICENSE_EXCEPTIONS) и дублем в этой таблице.
3. Исключения пересматриваются при каждом обновлении plan-4 §205.
