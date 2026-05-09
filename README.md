# MATCH 57

Web-app + Telegram bot для знакомств школьников 57-й. Один бэкенд, одна база
данных, два интерфейса.

## Что внутри

```
match57/
├── backend/          FastAPI, переиспользует логику бота (Database + do_like + ...)
│   ├── app/
│   │   ├── db.py              ← Database, вынесенный 1:1 из bot.py
│   │   ├── auth.py            ← Telegram Login Widget verify (HMAC-SHA256) + JWT cookie
│   │   ├── middleware.py      ← ban + rate-limit (0.7s) — те же ограничения, что в боте
│   │   ├── bot_client.py      ← Telegram Bot API клиент для уведомлений и медиа
│   │   ├── routers/           ← REST: auth, registration, profile, browse, messages, ...
│   │   └── services/          ← do_like, фильтры, админ-агрегации, рефералы
│   ├── tests/                 ← 13 тестов (БД, лайки, browse, smoke API)
│   └── pyproject.toml
├── frontend/         Next.js 14 + TypeScript + Tailwind + Framer Motion
│   ├── app/                   ← страницы (App Router)
│   │   ├── page.tsx           ← landing с Telegram Login Widget + параллакс
│   │   ├── register/          ← 9-шаговый wizard регистрации
│   │   ├── (app)/             ← аутентифицированная зона (BottomNav)
│   │   │   ├── swipe/         ← swipe deck (Framer Motion drag + 3D tilt)
│   │   │   ├── likes/         ← входящие лайки
│   │   │   ├── matches/       ← мэтчи + контакты
│   │   │   ├── skipped/       ← отвергнутые (вернуть)
│   │   │   ├── profile/       ← свой профиль + edit
│   │   │   ├── settings/      ← рефералы / скрыть / выйти
│   │   │   └── admin/         ← полная админ-панель (8 разделов, 16 действий)
│   │   └── globals.css
│   ├── components/            ← SwipeCard, PhotoCarousel, BottomNav, Toaster, …
│   ├── lib/                   ← API-клиент, типы
│   └── tailwind.config.ts     ← кастомные цвета (ink / ember / rose / gold) + glassmorphism
└── bot.py            ← оригинальный бот, изменилось 2 импорта
                       (Database и do_like теперь приходят из backend/app)
```

## База данных

Файл `data/users_db.json` (тот же, что у бота). Ничего не мигрировалось,
ничего не пересоздавалось. И бот, и веб читают/пишут одну и ту же базу через
общий класс `Database`.

```jsonc
{
  "users":     { "<id>": { ... } },
  "profiles":  [ ... ],          // зеркало users.values()
  "banned":    [<id>, ...],
  "reports":   [{ from, on, reason, at, resolved }, ...]
}
```

## Как поднять локально

```bash
# 0. одна .env-файлина на всё
cp backend/.env.example backend/.env  # заполнить TELEGRAM_BOT_TOKEN, JWT_SECRET, BOT_USERNAME

# 1. backend
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -e .[dev]
uvicorn app.main:app --reload --port 8000

# 2. frontend
cd ../frontend
cp .env.local.example .env.local  # NEXT_PUBLIC_API_URL=http://localhost:8000
npm install
npm run dev   # http://localhost:3000

# 3. бот (опционально, для уведомлений и легаси-юзеров)
cd ..
python bot.py
```

## Auth

Используется **Telegram Login Widget**. Юзер логинится через свой Telegram-аккаунт
(тот же `user_id`), сайт верифицирует HMAC-подпись через `BOT_TOKEN`, выдаёт
stateless JWT-cookie. Никаких паролей, никаких миграций.

## Медиа

Фото и видео хранятся как и раньше — Telegram `file_id`. Фронтенд получает их
через прокси `/api/media/{file_id}` (бот проксирует, бэкенд кэширует).

При загрузке нового фото/видео через сайт — оно отправляется через бот,
получает свой `file_id`, и сохраняется в анкете точно в том же формате,
что и раньше.

## Команды

```bash
# Backend
cd backend
ruff check . && ruff format --check .
mypy app
pytest

# Frontend
cd frontend
npm run lint
npx tsc --noEmit
npm run build
```
