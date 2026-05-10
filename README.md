# MATCH 57

Самостоятельный web-app для знакомств школы №57: анкеты, свайпы, лайки, мэтчи и
**встроенный realtime-мессенджер** с голосовыми/видеосообщениями, фото, файлами,
реакциями, read-receipts, online/typing — всё внутри сайта, без Telegram.

> Telegram-бот старой версии лежит в [`legacy/bot.py`](legacy/bot.py) — он не
> часть v2. Главный продукт теперь — этот сайт.

## Что внутри

```
match57/
├── backend/                FastAPI 0.115 + SQLAlchemy 2.0 (async) + SQLite
│   ├── app/
│   │   ├── db/             ORM-модели: User, Photo, Like, Match,
│   │   │                   Conversation, Message, MessageReaction,
│   │   │                   MessageRead, Report
│   │   ├── auth.py         bcrypt(12) + JWT-cookie (httpOnly, 30 дней)
│   │   ├── deps.py         FastAPI dependencies: AsyncSession, current user
│   │   ├── middleware.py   ban-чек + 0.7s rate-limit (как в v1)
│   │   ├── routers/
│   │   │   ├── auth.py            register, login, logout, me,
│   │   │   │                       resend-verify, verify-email
│   │   │   ├── profile.py         my profile, update, photos add/del
│   │   │   ├── browse.py          стек кандидатов с фильтрами
│   │   │   ├── likes.py           like / dislike, входящие лайки, мэтчи
│   │   │   ├── skipped.py         список skipped + undo
│   │   │   ├── conversations.py   список чатов, история, mark-read
│   │   │   ├── messages.py        send (text + attachment), react, delete
│   │   │   ├── media.py           upload + раздача файлов
│   │   │   ├── reports.py         жалобы (для админов)
│   │   │   ├── referrals.py       реферальная статистика
│   │   │   └── admin.py           stats / users / reports / broadcast / топы
│   │   ├── realtime/
│   │   │   ├── manager.py  ConnectionManager (user_id → set[WebSocket])
│   │   │   ├── events.py   типы WS-событий
│   │   │   └── ws.py       /api/ws — единственный WS-эндпоинт
│   │   └── services/       бизнес-логика (likes, profiles, messaging, uploads,
│   │                       email, admin)
│   ├── scripts/
│   │   └── migrate_json_to_sqlite.py   one-shot миграция users_db.json → SQLite
│   ├── tests/              14 тестов (auth, browse, likes/match, messaging)
│   └── pyproject.toml
├── frontend/               Next.js 14 (App Router) + TypeScript + Tailwind +
│   │                       Framer Motion + SWR
│   ├── app/
│   │   ├── page.tsx                лендинг (параллакс, плавающие карты)
│   │   ├── login/page.tsx          email + пароль
│   │   ├── register/page.tsx       8-шаговый wizard
│   │   ├── verify-email/page.tsx   подтверждение по ссылке
│   │   └── (app)/                  authed-зона (BottomNav)
│   │       ├── swipe/              swipe deck (3D-tilt, drag)
│   │       ├── likes/              входящие лайки
│   │       ├── matches/            мэтчи (online-индикатор, кнопка «чат»)
│   │       ├── skipped/            отвергнутые + undo
│   │       ├── chats/              список чатов
│   │       ├── chat/page.tsx       окно диалога (?id=N): история, typing,
│   │       │                       read-receipts, реакции, голос/видео-запись
│   │       ├── profile/            свой профиль + edit (3 фото слота)
│   │       ├── settings/           скрыть анкету, web-push, выход
│   │       └── admin/              stats / users / reports / broadcast / топы
│   ├── components/
│   │   ├── chat/
│   │   │   ├── MessageBubble.tsx   text/photo/video/voice/file + реакции
│   │   │   └── Composer.tsx        ввод + MediaRecorder (audio/video) + аплоад
│   │   ├── providers/
│   │   │   ├── AuthProvider.tsx        me, login, logout, refresh
│   │   │   ├── RealtimeProvider.tsx    WebSocket клиент + presence
│   │   │   └── NotificationProvider.tsx тосты, звук, web-Notification
│   │   ├── BottomNav, SwipeCard, PhotoCarousel, Toaster, ReportDialog, Modal
│   ├── lib/                api-client, типы, mediaUrl
│   └── tailwind.config.ts  glassmorphism, dark mode, ember/ink/rose палитра
└── legacy/
    └── bot.py              старая Telegram-версия (не часть v2)
```

## База данных

SQLite (`data/match57.db`, создаётся автоматически при первом старте бэка).
Таблицы: `users`, `photos`, `likes`, `matches`, `conversations`, `messages`,
`message_reactions`, `message_reads`, `reports`. Все relations и каскадные
удаления настроены через SQLAlchemy.

Никаких Telegram `file_id` — фото/видео/голосовые лежат на диске под
`data/uploads/<user_id>/<uuid>.<ext>` и раздаются через `/api/media/{user_id}/{filename}`.

## Realtime-мессенджер

Один WebSocket-эндпоинт `/api/ws`. После handshake клиент подписан на 5 типов
событий:

| Событие     | Когда срабатывает |
|-------------|-------------------|
| `message`   | новое / отредактированное / удалённое сообщение |
| `typing`    | кто-то печатает в чате (с TTL ~4с на клиенте) |
| `read`      | кто-то прочитал сообщения в чате |
| `reaction`  | реакция добавлена / снята |
| `presence`  | юзер пришёл / ушёл онлайн |

`ConnectionManager` хранит `user_id → set[WebSocket]` (поддержка нескольких
вкладок) и шлёт события через `asyncio.create_task` (не блокирует HTTP).

Поддерживаемые типы сообщений: `text`, `voice` (audio/webm), `video`
(video/webm с записью с камеры), `photo` (image/*), `file` (любой).

## Как запустить локально

### 1. Backend

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -e .[dev]
cp .env.example .env  # отредактируй JWT_SECRET и (опц.) SMTP_*
uvicorn app.main:app --reload --port 8000
```

При первом старте создастся `data/match57.db` со всеми таблицами.

### 2. Frontend

```bash
cd frontend
npm install
cp .env.local.example .env.local   # оставь NEXT_PUBLIC_API_BASE пустым
npm run dev   # → http://localhost:3000
```

В dev режиме фронт проксирует `/api/*` и `/api/ws` на `localhost:8000`
(см. `next.config.js`).

### Production deploy → GitHub Pages + Fly.io

Подробный гайд: [`DEPLOYMENT.md`](DEPLOYMENT.md).

Коротко: бэк деплоится на Fly.io (`flyctl deploy` из `backend/`), фронт
собирается в статический экспорт (`STATIC_EXPORT=1 npm run build`) и
автодеплоится на GitHub Pages через `.github/workflows/pages.yml` при пуше
в `trunk`. Прод-URL: <https://kr3ch.github.io/match57/>.

### 3. (опц.) Миграция со старого users_db.json

Положи `users_db.json` в `data/` и запусти:

```bash
cd backend
source .venv/bin/activate
python -m scripts.migrate_json_to_sqlite
```

Скрипт идемпотентен: повторный запуск ничего не сломает. Email мигрированных
юзеров — `<telegram_id>@match57.local`, временные пароли пишутся в
`data/migration_temp_passwords.txt`.

## Email-верификация

Два режима, переключение через `.env`:

* **dev (по умолчанию):** ссылка для подтверждения пишется в stdout бэка.
  Скопируй `http://localhost:3000/verify-email?token=...` и открой в браузере.
* **prod:** если в `.env` заданы `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`,
  `SMTP_PASS`, `SMTP_FROM` — отправится настоящее письмо.

Аккаунт работает и без подтверждения, но в профиле висит индикатор
«email не подтверждён».

## Тесты / линтер / типы

```bash
# backend
cd backend && source .venv/bin/activate
pytest                  # 14 тестов
ruff check && ruff format --check
mypy app

# frontend
cd ../frontend
npm run build           # 20 страниц prerender
npm run lint
npx tsc --noEmit
```

## Стек

* **backend:** Python 3.12, FastAPI, SQLAlchemy 2.0 (async), aiosqlite,
  bcrypt, PyJWT, Pillow, websockets
* **frontend:** Next.js 14 App Router, TypeScript strict, Tailwind, Framer
  Motion, SWR
* **БД:** SQLite (для прода легко мигрируется на Postgres — заменить
  `aiosqlite` на `asyncpg` в `app/db/__init__.py`)

## Производство

* `JWT_SECRET` — обязательно случайная строка (≥32 байта).
* HTTPS обязателен (cookie с `secure=True` в проде).
* Для Web-Push (когда добавим) понадобятся VAPID-ключи.
* `data/` — единственная stateful директория; бекапь её.
