# План: Homework 1 — Banking Transactions API (Node.js + Option A)

## Context
Потрібно виконати [TASKS.md](../TASKS.md): REST API для банківських транзакцій з in-memory сховищем, валідацією, фільтрацією і додатковою функцією **Option A — Transaction Summary**. Здаємо через PR у форк (`homework-1-submission` → `main`, рев'юер `Alexey-Popov`). PR без детального опису і скріншотів відхиляють. Документація використання AI становить 25% оцінки, тому план передбачає скріншоти і лог промптів на кожному кроці.

Поточний стан: у `homework-1/` є лише шаблони `README.md` і `HOWTORUN.md`, порожні `src/` і `docs/screenshots/`, папки `demo/` немає. Готового коду для перевикористання немає. Node v26, npm 11. Кореневий `.gitignore` уже виключає `node_modules/`, `.env` і `coverage/`, але за вимогою додамо ще й локальний `homework-1/.gitignore`.

## Технічні рішення
- **Стек:** Node.js + Express 4, CommonJS, без TypeScript, щоб не ускладнювати. Порт `3000`, його можна змінити через `PORT`.
- **Сховище:** модуль `src/store/transactionStore.js` з масивом у пам'яті та методами `add`, `getAll`, `getById`, `reset` (`reset` потрібен для тестів). ID генеруємо через `crypto.randomUUID()`, без зовнішніх залежностей.
- **Початковий стан:** у demo перший рахунок поповнюється через `deposit`, щоб можна було перевірити `withdrawal` і `transfer`. Окремих початкових балансів або депозитів поза API не передбачено.
- **Як рахується баланс (рахуються лише `completed` транзакції):**
  - `deposit`: зарахування на `toAccount`;
  - `withdrawal`: списання з `fromAccount`;
  - `transfer`: списання з `fromAccount` і зарахування на `toAccount`.
- **Статус транзакції:**
  - успішна транзакція зберігається зі `status: "completed"`;
  - недостатньо коштів — зі `status: "failed"` і повертається з кодом 201;
  - невалідна транзакція (400) не зберігається взагалі;
  - транзакції незмінні після створення: ендпоінтів для зміни статусу немає;
  - `pending` у цій реалізації не використовується.
- **Достатність коштів:** перевіряється лише для `withdrawal` і `transfer` (`deposit` завжди `completed`). Порядок: спочатку валідація (400), потім перевірка балансу у валюті транзакції; кошти в інших валютах на цей рахунок не впливають.
- **Обов'язкові поля залежно від типу:**
  - `deposit` вимагає `toAccount`;
  - `withdrawal` вимагає `fromAccount`;
  - `transfer` вимагає обидва рахунки, і вони мають бути різними.
- **Чому `failed`, а не 400:** запит коректний, але бізнес-операція не вдалася. Тому поле `status` має реальний сенс, а це рішення опишемо в README як архітектурне.
- **Валюти:** баланс і summary рахуються окремо для кожної валюти, у вигляді `{ USD: 100.5, EUR: 20 }`, щоб не додавати долари до євро. Список кодів ISO 4217 беремо з вбудованого `Intl.supportedValuesOf('currency')`, без зовнішніх залежностей. Код валюти має бути у верхньому регістрі.
- **Гроші:** кількість знаків після коми для валюти беремо з `new Intl.NumberFormat('en', { style: 'currency', currency }).resolvedOptions().maximumFractionDigits` (USD → 2, JPY → 0, KWD → 3). Дозволено не більше `min(2, знаки валюти)`, щоб виконати вимогу Task 2 «maximum 2 decimal places»: для JPY `100.5` дасть 400, для KWD максимум 2 знаки. Для збереження і розрахунків суму переводимо в цілі мінорні одиниці (USD → cents), щоб уникнути похибок float. Суму перевіряємо до конвертації, а в API повертаємо число в основних одиницях (`100.5`, а не `10050`).
- **Валідація тіла:**
  - тіло має бути JSON-об'єктом;
  - `amount` має бути числом, а не рядком (`"100"` дає 400);
  - `deposit` забороняє `fromAccount`, `withdrawal` забороняє `toAccount`;
  - `id`, `timestamp` і `status` генерує сервер; якщо клієнт їх передасть, це невідомі поля;
  - невідомі поля не ігноруємо: повертаємо 400 у форматі `Validation failed`;
  - номер рахунку (у тілі та в `:accountId`) перевіряємо за `^ACC-[A-Za-z0-9]{5}$`.
- **Формат помилок:**
  - валідація (400): `{ error: "Validation failed", details: [{ field, message }] }`;
  - не знайдено (404): `{ error: "Transaction not found" }`;
  - невідомий маршрут: 404;
  - невалідний JSON: 400;
  - решта: 500 через централізований error handler.
- **Контракт balance:** `GET /accounts/:accountId/balance` повертає `{ accountId, balance: { USD: 100.5, EUR: 20 } }`. Для рахунку без транзакцій повертається `{ accountId, balance: {} }`.
- **Контракт summary:** повертає `{ accountId, totalDeposits: { USD: 100.5 }, totalWithdrawals: { USD: 50 }, transactionCount: 3, mostRecentTransactionDate: "2024-01-31T12:00:00.000Z" }`. Усі суми розраховуються тільки для `completed` транзакцій. `transactionCount` рахується за всіма операціями рахунку зі статусом `completed`, а дата береться з останньої такої транзакції. Для transfer вхідні кошти додаються до `totalDeposits`, вихідні — до `totalWithdrawals`. Додатково повертаємо `failedCount` (кількість `failed` транзакцій рахунку), щоб нічого не губилося; підрахунок лише `completed` у `transactionCount` опишемо в README як рішення. У рахунку без транзакцій `totalDeposits` та `totalWithdrawals` — порожні об'єкти, `transactionCount: 0`, `mostRecentTransactionDate: null`.
- **Параметри фільтрації:** query-параметри `accountId`, `type`, `from`, `to` мають бути скалярними рядками; повторні або масивоподібні значення повертають 400. `from` і `to` приймають повний ISO 8601 або дату `YYYY-MM-DD` (за UTC). Дату `to` без часу включаємо до кінця дня `23:59:59.999Z`.
- **Невідомі query-параметри:** невідомі параметри повертають 400 як помилку конфігурації запиту, щоб уникнути опечаток і прихованої поведінки.
- **Тести:** Jest + supertest. TASKS.md їх не вимагає, але вони підвищують оцінку за якість коду і дають скріншот результатів.

## Структура
```
homework-1/
├── package.json, .gitignore
├── src/
│   ├── app.js                  # express app (без listen, для тестів)
│   ├── server.js               # app.listen(PORT)
│   ├── routes/transactions.js  # POST/GET /transactions, GET /transactions/:id
│   ├── routes/accounts.js      # /accounts/:id/balance, /accounts/:id/summary
│   ├── store/transactionStore.js
│   ├── validators/transactionValidator.js
│   ├── services/accountService.js   # balance + summary
│   ├── middleware/errorHandler.js
│   └── utils/constants.js      # CURRENCIES, TYPES, STATUSES, ACCOUNT_REGEX
├── tests/ (transactions.test.js, validation.test.js, filters.test.js, accounts.test.js)
├── demo/ (run.sh, sample-requests.http, sample-requests.sh, sample-data.json, seed.sh)
├── docs/screenshots/, docs/AI_USAGE_LOG.md
├── README.md, HOWTORUN.md
```

## Робота по блоках
Кожен блок закінчується тим, що ви перевіряєте результат і робимо коміт. Позначка 📸 означає, що в цьому місці я нагадаю зробити скріншот.

**Блок 0. Каркас проєкту**
- Найперший крок: зберегти цей план у репозиторій як `homework-1/docs/IMPLEMENTATION_PLAN.md`. Це артефакт для рев'юера, і на нього буде посилання з README та PR.
- `npm init`, встановлення `express` та dev-залежностей `jest`, `supertest`, `nodemon`.
- Скрипти `start`, `dev`, `test`.
- Файли `app.js` і `server.js` з ендпоінтом `GET /health`, а також `.gitignore`.
- Створюємо `docs/AI_USAGE_LOG.md` і далі записуємо туди ключові промпти: що просили, що дав AI, що виправили.
- 📸 промпт плану і перший запуск сервера.

**Блок 1. Task 1: основні ендпоінти**
- Сховище в пам'яті.
- `POST /transactions` повертає 201, ставить `id`, `timestamp` і `status`.
- `GET /transactions` повертає 200.
- `GET /transactions/:id` повертає 200 або 404.
- `GET /accounts/:accountId/balance` рахує баланс через `accountService`. Якщо по рахунку немає транзакцій, повертаємо `200 { accountId, balance: {} }` (див. контракт balance).
- Error handler для невалідного JSON і 500.
- 📸 промпт і запити через curl або Postman: створення транзакції та баланс.

**Блок 2. Task 2: валідація**
- `transactionValidator.validate(body)` повертає масив помилок усіх полів одразу, а не лише першої.
- Правила:
  - сума: число, більше 0, не більше `min(2, знаки валюти)` знаків після коми;
  - рахунок: `^ACC-[A-Za-z0-9]{5}$`;
  - валюта: з whitelist, у верхньому регістрі;
  - тип: з enum;
  - обов'язкові рахунки залежно від типу.
- Перевіряємо і `accountId` у шляху `/accounts/:accountId/...`: якщо формат неправильний, повертаємо 400.
- 📸 відповідь 400 зі списком помилок у `details`. Якщо AI запропонує цікавий edge case, наприклад `0.1 + 0.2` чи `"100"` як рядок, теж зробимо скріншот.

**Блок 3. Task 3: фільтри**
- Параметри `GET /transactions`:
  - `accountId`: збіг з `fromAccount` або `toAccount`;
  - `type`;
  - `from` і `to`: ISO-дати, де `to` включає весь день, якщо передано лише дату.
- Фільтри можна комбінувати через AND.
- Невалідні параметри (тип, дата, `from > to`) дають 400 у тому ж форматі помилок.
- 📸 запит з комбінованими фільтрами.

**Блок 4. Task 4, Option A: summary**
- `GET /accounts/:accountId/summary` повертає `{ accountId, totalDeposits, totalWithdrawals, transactionCount, failedCount, mostRecentTransactionDate }`.
- Суми рахуються окремо для кожної валюти.
- Як рахується transfer: вхідний переказ іде в deposits, вихідний у withdrawals. Цю семантику опишемо в README.
- 📸 відповідь summary.

**Блок 5. Тести**
- Тести через Jest + supertest на всі ендпоінти, валідацію, фільтри, summary і граничні випадки:
  - 404 для неіснуючої transaction; 200 з порожнім balance/summary для рахунку без транзакцій; 400 для невалідного формату `accountId`;
  - JPY з дробовою сумою (400), KWD з 3 знаками (400);
  - передані клієнтом `id`/`status`/`timestamp` (400), `fromAccount` у deposit (400);
  - failed через нестачу коштів у тому самому рахунку і валюті;
  - withdrawal і transfer із мішаними валютами;
  - суми `0.1 + 0.2`, рядковий `amount: "100"` і більше двох знаків;
  - повторні query-параметри, невідомі поля, невідомі query-параметри;
  - датний діапазон, включно з днем `to=2024-01-31`;
  - transfer у balance і summary як вхід/вихід.
- `npm test -- --coverage`.
- 📸 зелений прогін тестів і coverage.

**Блок 6. Демо**
- `demo/run.sh`: встановлює залежності й запускає сервер.
- `sample-requests.http` для REST Client і `sample-requests.sh` з curl: усі ендпоінти, включно з помилковими запитами.
- `sample-data.json` разом із `seed.sh`, який засіває дані через POST.
- 📸 вивід `sample-requests.sh`.

**Блок 7. Документація**
- `README.md`: автор, дата, AI-інструменти, огляд, функції, архітектурні рішення (баланс, failed, валюти), API reference, розділ про використання AI з посиланням на лог.
- `HOWTORUN.md`: передумови, встановлення, запуск, змінні середовища, тестування, демо.

**Блок 8. PR**
- Перевіряємо, що всі скріншоти лежать у `docs/screenshots/` і мають зрозумілі назви.
- Робимо push і пишемо текст PR із розділами Summary, AI tools, Challenges, How to verify та 3–5 вбудованими скріншотами.
- Створюємо PR через `gh pr create --repo rityamba/... --base main --reviewer Alexey-Popov`.
- Перед push і створенням PR я окремо спитаю підтвердження.

## Перевірка
- `npm test`: усі тести мають пройти.
- `npm start`, потім `bash demo/sample-requests.sh`: вручну перевіряємо коди 200, 201, 400 і 404 та вміст відповідей.
- Перевіряємо, що `git status` не містить `node_modules`.
- Перед PR проходимо чекліст із пам'яті `homework-submission-requirements`.
