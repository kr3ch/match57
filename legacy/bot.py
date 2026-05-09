import asyncio
import json
import os
import time
from datetime import datetime
from aiogram import Bot, Dispatcher, F, Router
from aiogram.filters import Command
from aiogram.fsm.context import FSMContext
from aiogram.fsm.state import State, StatesGroup
from aiogram.fsm.storage.memory import MemoryStorage
from aiogram.types import (
    Message, CallbackQuery,
    ReplyKeyboardMarkup, KeyboardButton, ReplyKeyboardRemove,
    InlineKeyboardMarkup, InlineKeyboardButton
)
BOT_TOKEN = os.environ.get("BOT_TOKEN")
DB_FILE = "/data/users_db.json"
ADMIN_IDS = [752355263]
SUPPORT_USERNAME = "@sneakerdash_manager"

bot = Bot(token=BOT_TOKEN)
storage = MemoryStorage()
dp = Dispatcher(storage=storage)
router = Router()

user_last_message = {}
RATE_LIMIT_SECONDS = 0.7

async def is_rate_limited(user_id: int) -> bool:
    now = time.time()
    last = user_last_message.get(user_id, 0)
    if now - last < RATE_LIMIT_SECONDS:
        return True
    user_last_message[user_id] = now
    return False

class Registration(StatesGroup):
    start_agreement = State()
    privacy_agreement = State()
    age = State()
    gender = State()
    looking_for = State()
    name = State()
    description = State()
    photo = State()
    phone = State()
    confirmation = State()
    edit_photo = State()
    edit_description = State()

class Viewing(StatesGroup):
    browsing = State()
    sending_message = State()
    menu = State()
    checking_likes = State()
    skipped = State()
    skipped_action = State()
    reporting = State()

class Admin(StatesGroup):
    panel = State()
    broadcast = State()
    search_user = State()
    delete_user = State()
    browsing_profiles = State()
    messaging_user = State()
    user_list = State()
    user_list_action = State()
    user_list_messaging = State()
    ban_user = State()
    unban_user = State()
    direct_message_id = State()
    direct_message_text = State()
    report_action = State()

# --- shared modules used by both this bot and the FastAPI web backend ---
# The Database class and do_like() were extracted from this file into
# backend/app/ so that the web app and the bot read/write the SAME
# users_db.json with identical semantics. Behaviour is byte-for-byte
# equivalent to the original inline implementations.
import sys as _sys, os as _os
_BACKEND_PATH = _os.path.join(_os.path.dirname(_os.path.abspath(__file__)), 'backend')
if _BACKEND_PATH not in _sys.path:
    _sys.path.insert(0, _BACKEND_PATH)
from app.db import Database  # noqa: E402  (extracted from this file)
from app.services.likes import do_like as _do_like_impl  # noqa: E402

db = Database(DB_FILE)

async def check_banned_and_rate(message: Message) -> bool:
    if db.is_banned(message.from_user.id):
        await message.answer("🚫 Твой аккаунт заблокирован. Если считаешь это ошибкой — пиши @sneakerdash_manager")
        return True
    if await is_rate_limited(message.from_user.id):
        await message.answer("🛑 Не спамь, подожди секунду.")
        return True
    return False

async def delete_admin_prompt(state: FSMContext, chat_id: int):
    data = await state.get_data()
    msg_id = data.get("admin_prompt_msg_id")
    if msg_id:
        try:
            await bot.delete_message(chat_id, msg_id)
        except Exception:
            pass
        await state.update_data(admin_prompt_msg_id=None)

# ===== КЛАВИАТУРЫ =====

def get_start_keyboard():
    return ReplyKeyboardMarkup(keyboard=[[KeyboardButton(text="Давай начнём")]], resize_keyboard=True)

def get_ok_keyboard():
    return ReplyKeyboardMarkup(keyboard=[[KeyboardButton(text="Ок")]], resize_keyboard=True)

def get_gender_keyboard():
    return ReplyKeyboardMarkup(keyboard=[[KeyboardButton(text="Я девушка")], [KeyboardButton(text="Я парень")]], resize_keyboard=True)

def get_looking_for_keyboard():
    return ReplyKeyboardMarkup(keyboard=[[KeyboardButton(text="Девушки")], [KeyboardButton(text="Парни")], [KeyboardButton(text="Все равно")]], resize_keyboard=True)

def get_name_keyboard(first_name):
    return ReplyKeyboardMarkup(keyboard=[[KeyboardButton(text=first_name)]], resize_keyboard=True)

def get_skip_keyboard():
    return ReplyKeyboardMarkup(keyboard=[[KeyboardButton(text="Пропустить")]], resize_keyboard=True)

def get_save_photo_keyboard():
    return ReplyKeyboardMarkup(keyboard=[[KeyboardButton(text="Это все, сохранить фото")]], resize_keyboard=True)

def get_phone_keyboard():
    return ReplyKeyboardMarkup(keyboard=[[KeyboardButton(text="📱 Отправить мой номер телефона", request_contact=True)]], resize_keyboard=True)

def get_confirmation_keyboard():
    return ReplyKeyboardMarkup(keyboard=[[KeyboardButton(text="Да")], [KeyboardButton(text="Изменить анкету")]], resize_keyboard=True)

def get_browsing_keyboard():
    keyboard = [
        [KeyboardButton(text="❤️"), KeyboardButton(text="💌/📹")],
        [KeyboardButton(text="👎"), KeyboardButton(text="💤")],
        [KeyboardButton(text="⚠️ Пожаловаться"), KeyboardButton(text="👀 Отвергнутые")]
    ]
    return ReplyKeyboardMarkup(keyboard=keyboard, resize_keyboard=True)

def get_empty_profiles_keyboard():
    keyboard = [
        [KeyboardButton(text="👀 Посмотреть отвергнутых")],
        [KeyboardButton(text="💤 В меню")]
    ]
    return ReplyKeyboardMarkup(keyboard=keyboard, resize_keyboard=True)

def get_back_keyboard():
    return ReplyKeyboardMarkup(keyboard=[[KeyboardButton(text="Вернуться назад")]], resize_keyboard=True)

def get_check_likes_keyboard():
    return ReplyKeyboardMarkup(keyboard=[[KeyboardButton(text="Проверить")]], resize_keyboard=True)

MENU_TEXT = "Выбери пункт меню 👇"

def get_menu_keyboard():
    keyboard = [
        [KeyboardButton(text="🔍 Смотреть анкеты"), KeyboardButton(text="👤 Моя анкета")],
        [KeyboardButton(text="🚪 Я больше не хочу никого искать")],
        [KeyboardButton(text="🎁 Пригласи друзей"), KeyboardButton(text="🆘 Поддержка")]
    ]
    return ReplyKeyboardMarkup(keyboard=keyboard, resize_keyboard=True)

def get_profile_menu_keyboard():
    keyboard = [
        [KeyboardButton(text="🔍 Смотреть анкеты")],
        [KeyboardButton(text="✏️ Заполнить анкету заново")],
        [KeyboardButton(text="🖼 Изменить фото/видео")],
        [KeyboardButton(text="📝 Изменить текст анкеты")]
    ]
    return ReplyKeyboardMarkup(keyboard=keyboard, resize_keyboard=True)

def get_skipped_action_keyboard():
    keyboard = [
        [KeyboardButton(text="❤️ Лайкнуть"), KeyboardButton(text="💌 Написать")],
        [KeyboardButton(text="➡️ Следующий"), KeyboardButton(text="🔙 В меню")],
        [KeyboardButton(text="🗑️ Очистить отвергнутых")]
    ]
    return ReplyKeyboardMarkup(keyboard=keyboard, resize_keyboard=True)

def get_skipped_message_keyboard():
    return ReplyKeyboardMarkup(keyboard=[[KeyboardButton(text="Отмена")]], resize_keyboard=True)

def get_report_reason_keyboard():
    keyboard = [
        [KeyboardButton(text="🔞 Неприемлемый контент")],
        [KeyboardButton(text="🤡 Фейковая анкета")],
        [KeyboardButton(text="😡 Оскорбления/угрозы")],
        [KeyboardButton(text="❌ Отмена жалобы")]
    ]
    return ReplyKeyboardMarkup(keyboard=keyboard, resize_keyboard=True)

def get_confirm_clear_keyboard():
    keyboard = [
        [KeyboardButton(text="✅ Да, очистить")],
        [KeyboardButton(text="❌ Нет, отмена")]
    ]
    return ReplyKeyboardMarkup(keyboard=keyboard, resize_keyboard=True)

def get_cancel_keyboard():
    return ReplyKeyboardMarkup(keyboard=[[KeyboardButton(text="🔙 Отмена")]], resize_keyboard=True)

def format_contact(profile):
    username = profile.get("username")
    name = profile.get("name", "Пользователь")
    if username:
        return f"@{username} ({name})"
    return f"{name} (попроси написать первым — у него нет username)"

# ===== ИНЛАЙН КЛАВИАТУРЫ АДМИНКИ =====

def get_admin_inline():
    return InlineKeyboardMarkup(inline_keyboard=[
        [
            InlineKeyboardButton(text="📊 Статистика", callback_data="adm_stats"),
            InlineKeyboardButton(text="🔥 Топ активных", callback_data="adm_top")
        ],
        [
            InlineKeyboardButton(text="👥 Все анкеты", callback_data="adm_userlist"),
            InlineKeyboardButton(text="💔 Одиночки", callback_data="adm_loners")
        ],
        [
            InlineKeyboardButton(text="📢 Рассылка", callback_data="adm_broadcast"),
            InlineKeyboardButton(text="🗑️ Удалить анкету", callback_data="adm_delete")
        ],
        [
            InlineKeyboardButton(text="🏆 Топ рефералов", callback_data="adm_toprefs"),
            InlineKeyboardButton(text="🕵️ Поиск юзера", callback_data="adm_search")
        ],
        [
            InlineKeyboardButton(text="📸 Просмотр анкет", callback_data="adm_browse"),
            InlineKeyboardButton(text="🆕 Новые сегодня", callback_data="adm_newtoday")
        ],
        [
            InlineKeyboardButton(text="🚫 Забанить", callback_data="adm_ban"),
            InlineKeyboardButton(text="✅ Разбанить", callback_data="adm_unban")
        ],
        [
            InlineKeyboardButton(text="⚠️ Жалобы", callback_data="adm_reports"),
            InlineKeyboardButton(text="🏅 Топ по лайкам", callback_data="adm_toplikes")
        ],
        [
            InlineKeyboardButton(text="📩 Написать юзеру", callback_data="adm_dm"),
            InlineKeyboardButton(text="🚪 Выйти из админки", callback_data="adm_exit")
        ]
    ])

# FIX: Added "◀️ Предыдущая" button to admin browse keyboard
def get_admin_browse_inline(user_id: int):
    return InlineKeyboardMarkup(inline_keyboard=[
        [
            InlineKeyboardButton(text="◀️ Предыдущая", callback_data="admbr_prev"),
            InlineKeyboardButton(text="➡️ Следующая", callback_data="admbr_next"),
        ],
        [
            InlineKeyboardButton(text="🗑️ Удалить", callback_data="admbr_delete"),
            InlineKeyboardButton(text="🚫 Забанить", callback_data="admbr_ban")
        ],
        [
            InlineKeyboardButton(text="📨 Написать", callback_data="admbr_msg"),
            InlineKeyboardButton(text="📊 Активность", callback_data="admbr_activity")
        ],
        [
            InlineKeyboardButton(text="🔙 В админку", callback_data="admbr_back")
        ]
    ])

def get_admin_userlist_inline(users_list: list, page: int, page_size: int = 10):
    start = page * page_size
    end = min(start + page_size, len(users_list))
    page_users = users_list[start:end]
    banned = db.data.get("banned", [])
    rows = []
    text = f"👥 Все пользователи (стр. {page + 1}, всего {len(users_list)}):\n\n"
    for i, (uid, u) in enumerate(page_users, start=start + 1):
        username = f"@{u['username']}" if u.get("username") else "без @"
        gender_icon = "👧" if u.get("gender") == "Девушка" else "👦"
        ban_mark = " 🚫" if u.get("user_id") in banned else ""
        match_count = len(u.get("matches", []))
        match_mark = f" 💞{match_count}" if match_count > 0 else ""
        hidden_mark = " 🙈" if u.get("hidden") else ""
        text += f"{i}. {gender_icon} {u.get('name', '?')}, {u.get('age', '?')} — {username}{ban_mark}{match_mark}{hidden_mark}\n"
        rows.append([InlineKeyboardButton(
            text=f"{i}. {u.get('name', '?')}, {u.get('age', '?')} {gender_icon}{ban_mark}{hidden_mark}",
            callback_data=f"adm_ul_select_{u.get('user_id')}"
        )])
    nav_row = []
    if page > 0:
        nav_row.append(InlineKeyboardButton(text="◀️ Назад", callback_data=f"adm_ul_page_{page - 1}"))
    if end < len(users_list):
        nav_row.append(InlineKeyboardButton(text="▶️ Вперёд", callback_data=f"adm_ul_page_{page + 1}"))
    if nav_row:
        rows.append(nav_row)
    rows.append([InlineKeyboardButton(text="🔙 В админку", callback_data="adm_ul_back")])
    return text, InlineKeyboardMarkup(inline_keyboard=rows)

def get_admin_user_action_inline(user_id: int):
    return InlineKeyboardMarkup(inline_keyboard=[
        [
            InlineKeyboardButton(text="📨 Написать", callback_data=f"adm_ua_msg_{user_id}"),
            InlineKeyboardButton(text="🗑️ Удалить", callback_data=f"adm_ua_del_{user_id}")
        ],
        [
            InlineKeyboardButton(text="🚫 Забанить", callback_data=f"adm_ua_ban_{user_id}"),
            InlineKeyboardButton(text="📊 Активность", callback_data=f"adm_ua_act_{user_id}")
        ],
        [InlineKeyboardButton(text="🔙 К списку", callback_data="adm_ua_back")]
    ])

def get_report_action_inline():
    return InlineKeyboardMarkup(inline_keyboard=[
        [
            InlineKeyboardButton(text="🚫 Забанить", callback_data="adm_rep_ban"),
            InlineKeyboardButton(text="🗑️ Удалить анкету", callback_data="adm_rep_del")
        ],
        [
            InlineKeyboardButton(text="✅ Обработано", callback_data="adm_rep_resolve"),
            InlineKeyboardButton(text="➡️ Следующая", callback_data="adm_rep_next")
        ],
        [InlineKeyboardButton(text="🔙 В админку", callback_data="adm_rep_back")]
    ])

def build_admin_caption(u, index=None, total=None) -> str:
    username = f"@{u['username']}" if u.get("username") else "без username"
    banned = db.is_banned(u.get("user_id"))
    ban_status = "🚫 ЗАБЛОКИРОВАН" if banned else "✅ Активен"
    hidden_status = " | 🙈 СКРЫТ" if u.get("hidden") else ""
    caption = (
        f"👤 {u.get('name', '?')}, {u.get('age', '?')}, {u.get('gender', '?')}\n"
        f"🔗 {username} | 📞 {u.get('phone', '—')}\n"
        f"Статус: {ban_status}{hidden_status}\n"
        f"❤️ Отправил: {len(u.get('likes_sent', []))} | 💌 Получил: {len(u.get('likes_received', []))}\n"
        f"🤝 Симпатий: {len(u.get('matches', []))} | 👎 Отверг: {len(u.get('dislikes', []))}\n"
        f"🔗 Рефералов: {len(u.get('referrals', []))} | 🆔 ID: {u.get('user_id', '?')}\n"
    )
    matches = u.get("matches", [])
    if matches:
        match_names = []
        for mid in matches:
            mu = db.get_user(mid)
            if mu:
                uname = f"@{mu['username']}" if mu.get("username") else mu.get("name", "?")
                match_names.append(uname)
        if match_names:
            caption += f"💞 Матчи: {', '.join(match_names)}\n"
    if u.get("description"):
        caption += f"\n📝 {u['description']}\n"
    if index is not None and total is not None:
        caption += f"\n[{index + 1} из {total}]"
    return caption

def build_admin_interactions_text(u) -> str:
    likes_sent = u.get("likes_sent", [])
    dislikes = u.get("dislikes", [])
    matches = u.get("matches", [])
    likes_received = u.get("likes_received", [])
    text = f"📊 Активность: {u.get('name', '?')} (ID: {u.get('user_id', '?')})\n\n"
    text += f"❤️ Лайкнул ({len(likes_sent)}):\n"
    if likes_sent:
        for uid in likes_sent[:20]:
            p = db.get_user(uid)
            if p:
                uname = f"@{p['username']}" if p.get("username") else "без @"
                match_mark = " 💞" if uid in matches else ""
                text += f"  • {p.get('name','?')}, {p.get('age','?')} — {uname}{match_mark}\n"
            else:
                text += f"  • [удалён] ID: {uid}\n"
        if len(likes_sent) > 20:
            text += f"  ... и ещё {len(likes_sent) - 20}\n"
    else:
        text += "  Никого ещё не лайкал\n"
    text += f"\n👎 Отверг ({len(dislikes)}):\n"
    if dislikes:
        for uid in dislikes[:20]:
            p = db.get_user(uid)
            if p:
                uname = f"@{p['username']}" if p.get("username") else "без @"
                text += f"  • {p.get('name','?')}, {p.get('age','?')} — {uname}\n"
            else:
                text += f"  • [удалён] ID: {uid}\n"
        if len(dislikes) > 20:
            text += f"  ... и ещё {len(dislikes) - 20}\n"
    else:
        text += "  Никого не отвергал\n"
    text += f"\n💌 Получил лайков ({len(likes_received)}):\n"
    if likes_received:
        for uid in likes_received[:10]:
            p = db.get_user(uid)
            if p:
                uname = f"@{p['username']}" if p.get("username") else "без @"
                match_mark = " 💞" if uid in matches else ""
                text += f"  • {p.get('name','?')}, {p.get('age','?')} — {uname}{match_mark}\n"
            else:
                text += f"  • [удалён] ID: {uid}\n"
        if len(likes_received) > 10:
            text += f"  ... и ещё {len(likes_received) - 10}\n"
    else:
        text += "  Лайков не получал\n"
    return text

# ===== РЕГИСТРАЦИЯ =====

@router.message(F.text == "🆘 Поддержка")
async def process_support(message: Message, state: FSMContext):
    if await check_banned_and_rate(message): return
    await message.answer("Если возникли проблемы или вопросы — пиши сюда:\n@sneakerdash_manager", reply_markup=get_menu_keyboard())

@router.message(Command("start"))
async def cmd_start(message: Message, state: FSMContext):
    if db.is_banned(message.from_user.id):
        await message.answer("🚫 Твой аккаунт заблокирован. Если считаешь это ошибкой — пиши @sneakerdash_manager")
        return
    user = db.get_user(message.from_user.id)
    args = message.text.split()
    if len(args) > 1 and args[1].startswith("ref"):
        referrer_id = int(args[1][3:])
        if referrer_id != message.from_user.id and not user:
            referrer = db.get_user(referrer_id)
            if referrer:
                referrer.setdefault("referrals", [])
                if message.from_user.id not in referrer["referrals"]:
                    referrer["referrals"].append(message.from_user.id)
                    db.update_user(referrer_id, referrer)
                    try:
                        await bot.send_message(referrer_id, "По твоей ссылке зарегистрировался новый пользователь! 🎉")
                    except Exception:
                        pass
    if user:
        # FIX: If user was hidden (quit), unhide them on /start so they appear in browsing again
        if user.get("hidden", False):
            user["hidden"] = False
            db.update_user(message.from_user.id, user)
            await state.set_state(Viewing.menu)
            await message.answer("С возвращением! 🎉 Твоя анкета снова видна всем.\n\n" + MENU_TEXT, reply_markup=get_menu_keyboard())
        else:
            await state.set_state(Viewing.menu)
            await message.answer(MENU_TEXT, reply_markup=get_menu_keyboard())
    else:
        await state.set_state(Registration.start_agreement)
        await message.answer(
            "Уже вся 57-я школа знакомится в нашем тиндере-боте MATCH 😍\n\nЯ помогу найти тебе пару или просто друзей 👫",
            reply_markup=get_start_keyboard()
        )

@router.message(Registration.start_agreement, F.text == "Давай начнём")
async def process_start(message: Message, state: FSMContext):
    if await check_banned_and_rate(message): return
    await state.set_state(Registration.privacy_agreement)
    await message.answer(
        "❗️ Помните, что в интернете люди могут выдавать себя за других.\n\n"
        "Бот не запрашивает личные данные и не идентифицирует пользователей по каким-либо документам.\n\n"
        "Продолжая, вы принимаете пользовательское соглашение и политику конфиденциальности.",
        reply_markup=get_ok_keyboard()
    )

@router.message(Registration.privacy_agreement, F.text == "Ок")
async def process_privacy(message: Message, state: FSMContext):
    if await check_banned_and_rate(message): return
    await state.set_state(Registration.age)
    await message.answer("Сколько тебе лет?", reply_markup=ReplyKeyboardRemove())

@router.message(Registration.age)
async def process_age(message: Message, state: FSMContext):
    if await check_banned_and_rate(message): return
    try:
        age = int(message.text)
        if age < 14 or age > 100:
            await message.answer("Пожалуйста, введи корректный возраст (от 14 до 100 лет)")
            return
        await state.update_data(age=age)
        await state.set_state(Registration.gender)
        await message.answer("Теперь определимся с полом", reply_markup=get_gender_keyboard())
    except ValueError:
        await message.answer("Пожалуйста, введи число")

@router.message(Registration.gender)
async def process_gender(message: Message, state: FSMContext):
    if await check_banned_and_rate(message): return
    gender = "Девушка" if message.text == "Я девушка" else "Парень"
    await state.update_data(gender=gender)
    await state.set_state(Registration.looking_for)
    await message.answer("Кого ты хочешь найти?", reply_markup=get_looking_for_keyboard())

@router.message(Registration.looking_for)
async def process_looking_for(message: Message, state: FSMContext):
    if await check_banned_and_rate(message): return
    if message.text not in ["Девушки", "Парни", "Все равно"]:
        await message.answer("Выбери один из вариантов 👇", reply_markup=get_looking_for_keyboard())
        return
    await state.update_data(looking_for=message.text)
    await state.set_state(Registration.name)
    await message.answer("Как мне тебя называть?", reply_markup=get_name_keyboard(message.from_user.first_name))

@router.message(Registration.name)
async def process_name(message: Message, state: FSMContext):
    if await check_banned_and_rate(message): return
    await state.update_data(name=message.text)
    await state.set_state(Registration.description)
    await message.answer("Расскажи о себе и кого хочешь найти, чем предлагаешь заняться.", reply_markup=get_skip_keyboard())

@router.message(Registration.description)
async def process_description(message: Message, state: FSMContext):
    if await check_banned_and_rate(message): return
    description = "" if message.text == "Пропустить" else message.text
    await state.update_data(description=description, photo_count=0, photos=[])
    await state.set_state(Registration.photo)
    await message.answer("Теперь пришли фото или запиши видео (до 15 сек)", reply_markup=ReplyKeyboardRemove())

@router.message(Registration.photo, F.photo | F.video)
async def process_photo(message: Message, state: FSMContext):
    if await check_banned_and_rate(message): return
    data = await state.get_data()
    photos = data.get("photos", [])
    photo_count = data.get("photo_count", 0)
    if message.photo:
        photos.append({"type": "photo", "file_id": message.photo[-1].file_id})
    elif message.video:
        photos.append({"type": "video", "file_id": message.video.file_id})
    photo_count += 1
    await state.update_data(photos=photos, photo_count=photo_count)
    if photo_count < 3:
        await message.answer(f"Фото добавлено – {photo_count} из 3. Еще одно?", reply_markup=get_save_photo_keyboard())
    else:
        await state.set_state(Registration.phone)
        await message.answer("Мне нужен твой номер телефона для подтверждения анкеты. Его не увидят другие.", reply_markup=get_phone_keyboard())

@router.message(Registration.photo, F.text == "Это все, сохранить фото")
async def process_save_photos(message: Message, state: FSMContext):
    if await check_banned_and_rate(message): return
    data = await state.get_data()
    if not data.get("photos"):
        await message.answer("Сначала отправь хотя бы одно фото или видео!")
        return
    await state.set_state(Registration.phone)
    await message.answer("Мне нужен твой номер телефона для подтверждения анкеты. Его не увидят другие.", reply_markup=get_phone_keyboard())

@router.message(Registration.photo)
async def process_photo_wrong(message: Message, state: FSMContext):
    if await check_banned_and_rate(message): return
    await message.answer("Пожалуйста, отправь фото или видео (до 15 сек) 📸")

@router.message(Registration.phone, ~F.contact)
async def process_phone_wrong(message: Message, state: FSMContext):
    if await check_banned_and_rate(message): return
    await message.answer(
        "Нажми кнопку ниже 👇 чтобы отправить номер телефона.\n\n"
        "Если кнопка не видна — нажми на квадратик справа снизу от поля ввода.",
        reply_markup=get_phone_keyboard()
    )
@router.message(Registration.phone, F.contact)
async def process_phone(message: Message, state: FSMContext):
    if await check_banned_and_rate(message): return
    await state.update_data(phone=message.contact.phone_number)
    data = await state.get_data()
    await state.set_state(Registration.confirmation)
    await message.answer("Так выглядит твоя анкета:", reply_markup=ReplyKeyboardRemove())
    if data["photos"]:
        media_item = data["photos"][0]
        caption = f"{data['name']}, {data['age']}"
        if data.get("description"):
            caption += f"\n\n{data['description']}"
        if media_item["type"] == "photo":
            await message.answer_photo(photo=media_item["file_id"], caption=caption)
        else:
            await message.answer_video(video=media_item["file_id"], caption=caption)
    await message.answer("Все верно?", reply_markup=get_confirmation_keyboard())

@router.message(Registration.confirmation, F.text == "Да")
async def process_confirmation(message: Message, state: FSMContext):
    if await check_banned_and_rate(message): return
    data = await state.get_data()
    profile = {
        "user_id": message.from_user.id,
        "username": message.from_user.username,
        "age": data["age"],
        "gender": data["gender"],
        "looking_for": data["looking_for"],
        "name": data["name"],
        "description": data.get("description", ""),
        "photos": data["photos"],
        "phone": data["phone"],
        "created_at": datetime.now().isoformat(),
        "likes_sent": [],
        "likes_received": [],
        "matches": [],
        "dislikes": [],
        "hidden": False
    }
    db.add_user(message.from_user.id, profile)
    await state.set_state(Viewing.menu)
    await state.update_data(current_profile_index=0, viewing_user_id=None)
    await message.answer("Анкета сохранена! 🎉\n\n" + MENU_TEXT, reply_markup=get_menu_keyboard())

@router.message(Registration.confirmation, F.text == "Изменить анкету")
async def process_edit(message: Message, state: FSMContext):
    if await check_banned_and_rate(message): return
    await state.set_state(Registration.age)
    await message.answer("Давай начнем заново. Сколько тебе лет?", reply_markup=ReplyKeyboardRemove())

# ===== ЛАЙК =====

async def do_like(from_user_id: int, to_user_id: int) -> bool:
    """Thin wrapper around the shared implementation.

    Behaviour identical to the original inline definition: same checks,
    same database mutations, same return value.
    """
    return _do_like_impl(db, from_user_id, to_user_id)


# ===== ПРОСМОТР АНКЕТ =====

async def show_next_profile(message: Message, state: FSMContext):
    user_profile = db.get_user(message.from_user.id)
    all_profiles = db.get_all_profiles(message.from_user.id)
    looking_for = user_profile.get("looking_for", "Все равно")
    if looking_for == "Девушки":
        profiles = [p for p in all_profiles if p.get("gender") == "Девушка"]
    elif looking_for == "Парни":
        profiles = [p for p in all_profiles if p.get("gender") == "Парень"]
    else:
        profiles = all_profiles
    already_seen = set(user_profile.get("likes_sent", [])) | set(user_profile.get("dislikes", []))
    profiles = [p for p in profiles if p["user_id"] not in already_seen]
    data = await state.get_data()
    index = data.get("current_profile_index", 0)
    if index >= len(profiles):
        index = 0
        await state.update_data(current_profile_index=0)
    if not profiles:
        await state.set_state(Viewing.browsing)
        await message.answer(
            "Ты уже оценил все анкеты! Загляни позже — или пересмотри тех кого отверг 👀",
            reply_markup=get_empty_profiles_keyboard()
        )
        return
    profile = profiles[index]
    await state.update_data(current_profile_index=index + 1, viewing_user_id=profile["user_id"])
    caption = f"{profile['name']}, {profile['age']}"
    if profile.get("description"):
        caption += f"\n\n{profile['description']}"
    if profile["photos"]:
        media_item = profile["photos"][0]
        if media_item["type"] == "photo":
            await message.answer_photo(photo=media_item["file_id"], caption=caption, reply_markup=get_browsing_keyboard())
        else:
            await message.answer_video(video=media_item["file_id"], caption=caption, reply_markup=get_browsing_keyboard())
    else:
        await message.answer(caption, reply_markup=get_browsing_keyboard())

@router.message(Viewing.browsing, F.text == "👀 Посмотреть отвергнутых")
async def process_go_to_skipped_from_empty(message: Message, state: FSMContext):
    if await check_banned_and_rate(message): return
    user_profile = db.get_user(message.from_user.id)
    dislikes = user_profile.get("dislikes", [])
    likes_sent = set(user_profile.get("likes_sent", []))
    valid = [uid for uid in dislikes if db.get_user(uid) and uid not in likes_sent]
    if not valid:
        await message.answer("Ты никого не отвергал 😇", reply_markup=get_empty_profiles_keyboard())
        return
    await state.set_state(Viewing.skipped)
    await state.update_data(skipped_index=0)
    await message.answer("👀 Анкеты, которые ты отверг:", reply_markup=ReplyKeyboardRemove())
    await show_skipped_profile(message, state)

@router.message(Viewing.browsing, F.text == "💤 В меню")
async def process_go_to_menu_from_empty(message: Message, state: FSMContext):
    if await check_banned_and_rate(message): return
    await state.set_state(Viewing.menu)
    await message.answer(MENU_TEXT, reply_markup=get_menu_keyboard())

@router.message(Viewing.browsing, F.text == "❤️")
async def process_like(message: Message, state: FSMContext):
    if await check_banned_and_rate(message): return
    data = await state.get_data()
    viewing_user_id = data.get("viewing_user_id")
    if viewing_user_id:
        is_match = await do_like(message.from_user.id, viewing_user_id)
        user_profile = db.get_user(message.from_user.id)
        viewed_profile = db.get_user(viewing_user_id)
        if is_match:
            try:
                await bot.send_message(viewing_user_id, f"❤️ Взаимная симпатия!\n\nПиши: {format_contact(user_profile)}")
            except Exception: pass
            await message.answer(f"❤️ Взаимная симпатия!\n\nПиши: {format_contact(viewed_profile)}")
        else:
            try:
                await bot.send_message(viewing_user_id, "Заканчивай с просмотром анкет, ты кому-то понравился", reply_markup=get_check_likes_keyboard())
            except Exception: pass
    await message.answer("✨🔍", reply_markup=ReplyKeyboardRemove())
    await show_next_profile(message, state)

@router.message(Viewing.browsing, F.text == "👎")
async def process_dislike(message: Message, state: FSMContext):
    if await check_banned_and_rate(message): return
    data = await state.get_data()
    viewing_user_id = data.get("viewing_user_id")
    if viewing_user_id:
        user_profile = db.get_user(message.from_user.id)
        user_profile.setdefault("dislikes", [])
        if viewing_user_id not in user_profile["dislikes"]:
            user_profile["dislikes"].append(viewing_user_id)
            db.update_user(message.from_user.id, user_profile)
    await message.answer("✨🔍", reply_markup=ReplyKeyboardRemove())
    await show_next_profile(message, state)

@router.message(Viewing.browsing, F.text == "⚠️ Пожаловаться")
async def process_report_start(message: Message, state: FSMContext):
    if await check_banned_and_rate(message): return
    data = await state.get_data()
    if not data.get("viewing_user_id"):
        await message.answer("Сначала открой чью-нибудь анкету.", reply_markup=get_browsing_keyboard())
        return
    await state.set_state(Viewing.reporting)
    await message.answer("Выбери причину жалобы:", reply_markup=get_report_reason_keyboard())

@router.message(Viewing.reporting, F.text == "❌ Отмена жалобы")
async def process_report_cancel(message: Message, state: FSMContext):
    if await check_banned_and_rate(message): return
    await state.set_state(Viewing.browsing)
    await message.answer("Жалоба отменена.", reply_markup=get_browsing_keyboard())

@router.message(Viewing.reporting, F.text.in_(["🔞 Неприемлемый контент", "🤡 Фейковая анкета", "😡 Оскорбления/угрозы"]))
async def process_report_reason(message: Message, state: FSMContext):
    if await check_banned_and_rate(message): return
    data = await state.get_data()
    viewing_user_id = data.get("viewing_user_id")
    db.add_report(from_user_id=message.from_user.id, on_user_id=viewing_user_id, reason=message.text)
    reported_profile = db.get_user(viewing_user_id)
    reporter_profile = db.get_user(message.from_user.id)
    reported_name = reported_profile.get("name", "?") if reported_profile else "?"
    reporter_name = reporter_profile.get("name", "?") if reporter_profile else "?"
    reported_username = f"@{reported_profile['username']}" if reported_profile and reported_profile.get("username") else f"ID:{viewing_user_id}"
    for admin_id in ADMIN_IDS:
        try:
            await bot.send_message(admin_id,
                f"⚠️ Новая жалоба!\n\n"
                f"На кого: {reported_name} ({reported_username}) ID: {viewing_user_id}\n"
                f"От кого: {reporter_name} (ID: {message.from_user.id})\n"
                f"Причина: {message.text}\n\n"
                f"Обработать: /admin → ⚠️ Жалобы")
        except Exception: pass
    await message.answer("✅ Жалоба отправлена. Мы проверим анкету.", reply_markup=ReplyKeyboardRemove())
    await state.set_state(Viewing.browsing)
    await show_next_profile(message, state)

@router.message(Viewing.browsing, F.text == "💌/📹")
async def process_message_request(message: Message, state: FSMContext):
    if await check_banned_and_rate(message): return
    data = await state.get_data()
    if not data.get("viewing_user_id"):
        await message.answer("Сначала открой чью-нибудь анкету.", reply_markup=get_browsing_keyboard())
        return
    await state.set_state(Viewing.sending_message)
    await message.answer("Напиши сообщение или запиши короткое видео (до 15 сек) — отправим вместе с лайком:", reply_markup=get_back_keyboard())

@router.message(Viewing.sending_message, F.text == "Вернуться назад")
async def process_back(message: Message, state: FSMContext):
    if await check_banned_and_rate(message): return
    await state.set_state(Viewing.browsing)
    await message.answer("Возвращаемся...", reply_markup=get_browsing_keyboard())

@router.message(Viewing.sending_message, F.text | F.photo | F.video | F.video_note | F.voice)
async def process_send_message(message: Message, state: FSMContext):
    if await check_banned_and_rate(message): return
    data = await state.get_data()
    viewing_user_id = data.get("viewing_user_id")
    if not viewing_user_id:
        await state.set_state(Viewing.browsing)
        await message.answer("Что-то пошло не так.", reply_markup=get_browsing_keyboard())
        return
    user_profile = db.get_user(message.from_user.id)
    sender_name = user_profile.get("name", "Кто-то")
    sender_contact = format_contact(user_profile)
    intro = f"💌 {sender_name} написал(а) тебе:\n\n"
    message_sent = False
    try:
        if message.text:
            await bot.send_message(viewing_user_id, f"{intro}{message.text}\n\n— {sender_contact}")
        elif message.photo:
            await bot.send_photo(viewing_user_id, message.photo[-1].file_id, caption=f"{intro}— {sender_contact}")
        elif message.video:
            await bot.send_video(viewing_user_id, message.video.file_id, caption=f"{intro}— {sender_contact}")
        elif message.video_note:
            await bot.send_message(viewing_user_id, f"{intro}— {sender_contact}")
            await bot.send_video_note(viewing_user_id, message.video_note.file_id)
        elif message.voice:
            await bot.send_message(viewing_user_id, f"{intro}— {sender_contact}")
            await bot.send_voice(viewing_user_id, message.voice.file_id)
        message_sent = True
    except Exception as e:
        print(f"❌ {e}")
    is_match = await do_like(message.from_user.id, viewing_user_id)
    user_profile = db.get_user(message.from_user.id)
    viewed_profile = db.get_user(viewing_user_id)
    if is_match:
        try:
            await bot.send_message(viewing_user_id, f"❤️ Взаимная симпатия!\n\nПиши: {format_contact(user_profile)}")
        except Exception: pass
        await message.answer(f"✅ Сообщение отправлено!\n\n❤️ Взаимная симпатия!\n\nПиши: {format_contact(viewed_profile)}")
    else:
        if not message_sent:
            await message.answer("❌ Не удалось доставить — пользователь мог заблокировать бота.")
        else:
            await message.answer("✅ Сообщение отправлено! Ждём ответа.")
        try:
            await bot.send_message(viewing_user_id, "Заканчивай с просмотром анкет, ты кому-то понравился", reply_markup=get_check_likes_keyboard())
        except Exception: pass
    await state.set_state(Viewing.browsing)
    await message.answer("✨🔍", reply_markup=ReplyKeyboardRemove())
    await show_next_profile(message, state)

@router.message(Viewing.browsing, F.text == "💤")
async def process_sleep(message: Message, state: FSMContext):
    if await check_banned_and_rate(message): return
    await state.set_state(Viewing.menu)
    await message.answer("Подождем пока кто-то увидит твою анкету", reply_markup=ReplyKeyboardRemove())
    await message.answer(MENU_TEXT, reply_markup=get_menu_keyboard())

@router.message(Viewing.browsing, F.text == "👀 Отвергнутые")
async def process_browsing_skipped(message: Message, state: FSMContext):
    if await check_banned_and_rate(message): return
    user_profile = db.get_user(message.from_user.id)
    dislikes = user_profile.get("dislikes", [])
    likes_sent = set(user_profile.get("likes_sent", []))
    valid = [uid for uid in dislikes if db.get_user(uid) and uid not in likes_sent]
    if not valid:
        await message.answer("Ты никого не отвергал 😇", reply_markup=get_browsing_keyboard())
        return
    await state.set_state(Viewing.skipped)
    await state.update_data(skipped_index=0)
    await message.answer("👀 Анкеты, которые ты отверг:", reply_markup=ReplyKeyboardRemove())
    await show_skipped_profile(message, state)

async def show_skipped_profile(message: Message, state: FSMContext):
    user_profile = db.get_user(message.from_user.id)
    dislikes = user_profile.get("dislikes", [])
    data = await state.get_data()
    skipped_index = data.get("skipped_index", 0)
    valid_skipped = []
    for uid in dislikes:
        p = db.get_user(uid)
        if p and uid not in user_profile.get("likes_sent", []):
            valid_skipped.append((uid, p))
    if not valid_skipped:
        await message.answer("Отвергнутых анкет больше нет 😎", reply_markup=get_browsing_keyboard())
        await state.set_state(Viewing.browsing)
        return
    if skipped_index >= len(valid_skipped):
        skipped_index = 0
        await state.update_data(skipped_index=0)
    uid, profile = valid_skipped[skipped_index]
    await state.update_data(skipped_index=skipped_index, skipped_viewing_user_id=uid)
    caption = f"{profile['name']}, {profile['age']}"
    if profile.get("description"):
        caption += f"\n\n{profile['description']}"
    caption += f"\n\n({skipped_index + 1} из {len(valid_skipped)})"
    if profile.get("photos"):
        media_item = profile["photos"][0]
        if media_item["type"] == "photo":
            await message.answer_photo(photo=media_item["file_id"], caption=caption, reply_markup=get_skipped_action_keyboard())
        else:
            await message.answer_video(video=media_item["file_id"], caption=caption, reply_markup=get_skipped_action_keyboard())
    else:
        await message.answer(caption, reply_markup=get_skipped_action_keyboard())

@router.message(Viewing.skipped, F.text == "❤️ Лайкнуть")
async def skipped_like(message: Message, state: FSMContext):
    if await check_banned_and_rate(message): return
    data = await state.get_data()
    uid = data.get("skipped_viewing_user_id")
    if not uid:
        await show_skipped_profile(message, state)
        return
    user_profile = db.get_user(message.from_user.id)
    if uid in user_profile.get("dislikes", []):
        user_profile["dislikes"].remove(uid)
        db.update_user(message.from_user.id, user_profile)
    is_match = await do_like(message.from_user.id, uid)
    user_profile = db.get_user(message.from_user.id)
    viewed_profile = db.get_user(uid)
    if is_match:
        try:
            await bot.send_message(uid, f"❤️ Взаимная симпатия!\n\nПиши: {format_contact(user_profile)}")
        except Exception: pass
        await message.answer(f"❤️ Взаимная симпатия!\n\nПиши: {format_contact(viewed_profile)}")
    else:
        try:
            await bot.send_message(uid, "Заканчивай с просмотром анкет, ты кому-то понравился", reply_markup=get_check_likes_keyboard())
        except Exception: pass
        await message.answer("Лайк отправлен! ❤️")
    await state.update_data(skipped_index=data.get("skipped_index", 0))
    await show_skipped_profile(message, state)

@router.message(Viewing.skipped, F.text == "💌 Написать")
async def skipped_write(message: Message, state: FSMContext):
    if await check_banned_and_rate(message): return
    await state.set_state(Viewing.skipped_action)
    await message.answer("Напиши сообщение или запиши видео:", reply_markup=get_skipped_message_keyboard())

@router.message(Viewing.skipped_action, F.text == "Отмена")
async def skipped_action_cancel(message: Message, state: FSMContext):
    if await check_banned_and_rate(message): return
    await state.set_state(Viewing.skipped)
    await show_skipped_profile(message, state)

@router.message(Viewing.skipped_action, F.text | F.photo | F.video | F.video_note | F.voice)
async def skipped_send_message(message: Message, state: FSMContext):
    if await check_banned_and_rate(message): return
    data = await state.get_data()
    uid = data.get("skipped_viewing_user_id")
    if not uid:
        await state.set_state(Viewing.skipped)
        await show_skipped_profile(message, state)
        return
    user_profile = db.get_user(message.from_user.id)
    sender_contact = format_contact(user_profile)
    sender_name = user_profile.get("name", "Кто-то")
    intro = f"💌 {sender_name} написал(а) тебе:\n\n"
    try:
        if message.text:
            await bot.send_message(uid, f"{intro}{message.text}\n\n— {sender_contact}")
        elif message.photo:
            await bot.send_photo(uid, message.photo[-1].file_id, caption=f"{intro}— {sender_contact}")
        elif message.video:
            await bot.send_video(uid, message.video.file_id, caption=f"{intro}— {sender_contact}")
        elif message.video_note:
            await bot.send_message(uid, f"{intro}— {sender_contact}")
            await bot.send_video_note(uid, message.video_note.file_id)
        elif message.voice:
            await bot.send_message(uid, f"{intro}— {sender_contact}")
            await bot.send_voice(uid, message.voice.file_id)
        await message.answer("✅ Сообщение отправлено!")
    except Exception as e:
        print(f"❌ {e}")
        await message.answer("❌ Не удалось доставить — пользователь мог заблокировать бота.")
    user_profile = db.get_user(message.from_user.id)
    if uid in user_profile.get("dislikes", []):
        user_profile["dislikes"].remove(uid)
        db.update_user(message.from_user.id, user_profile)
    is_match = await do_like(message.from_user.id, uid)
    user_profile = db.get_user(message.from_user.id)
    viewed_profile = db.get_user(uid)
    if is_match:
        try:
            await bot.send_message(uid, f"❤️ Взаимная симпатия!\n\nПиши: {format_contact(user_profile)}")
        except Exception: pass
        await message.answer(f"❤️ Взаимная симпатия!\n\nПиши: {format_contact(viewed_profile)}")
    await state.set_state(Viewing.skipped)
    await show_skipped_profile(message, state)

@router.message(Viewing.skipped, F.text == "➡️ Следующий")
async def skipped_next(message: Message, state: FSMContext):
    if await check_banned_and_rate(message): return
    data = await state.get_data()
    await state.update_data(skipped_index=data.get("skipped_index", 0) + 1)
    await show_skipped_profile(message, state)

@router.message(Viewing.skipped, F.text == "🔙 В меню")
async def skipped_back_to_menu(message: Message, state: FSMContext):
    if await check_banned_and_rate(message): return
    await state.set_state(Viewing.browsing)
    await message.answer("Возвращаемся к просмотру анкет 🔍", reply_markup=get_browsing_keyboard())
    await show_next_profile(message, state)

@router.message(Viewing.skipped, F.text == "🗑️ Очистить отвергнутых")
async def skipped_clear_confirm(message: Message, state: FSMContext):
    if await check_banned_and_rate(message): return
    user_profile = db.get_user(message.from_user.id)
    dislike_count = len(user_profile.get("dislikes", []))
    await message.answer(
        f"Ты собираешься очистить список отвергнутых ({dislike_count} чел.).\n\n"
        f"После этого они снова будут попадаться тебе в анкетах. Точно очистить?",
        reply_markup=get_confirm_clear_keyboard()
    )

@router.message(Viewing.skipped, F.text == "✅ Да, очистить")
async def skipped_clear_execute(message: Message, state: FSMContext):
    if await check_banned_and_rate(message): return
    user_profile = db.get_user(message.from_user.id)
    cleared_count = len(user_profile.get("dislikes", []))
    user_profile["dislikes"] = []
    db.update_user(message.from_user.id, user_profile)
    await state.set_state(Viewing.menu)
    await message.answer(
        f"🗑️ Готово! {cleared_count} отвергнутых анкет очищено.\n\nТеперь они снова будут попадаться при просмотре.",
        reply_markup=get_menu_keyboard()
    )

@router.message(Viewing.skipped, F.text == "❌ Нет, отмена")
async def skipped_clear_cancel(message: Message, state: FSMContext):
    if await check_banned_and_rate(message): return
    await show_skipped_profile(message, state)

# ===== МЕНЮ =====

@router.message(Viewing.menu, F.text == "🔍 Смотреть анкеты")
async def process_menu_browse(message: Message, state: FSMContext):
    if await check_banned_and_rate(message): return
    await state.set_state(Viewing.browsing)
    await state.update_data(current_profile_index=0)
    await message.answer("✨🔍", reply_markup=ReplyKeyboardRemove())
    await show_next_profile(message, state)

@router.message(Viewing.menu, F.text == "👤 Моя анкета")
async def process_menu_profile(message: Message, state: FSMContext):
    if await check_banned_and_rate(message): return
    user_profile = db.get_user(message.from_user.id)
    await message.answer("Так выглядит твоя анкета:", reply_markup=ReplyKeyboardRemove())
    if user_profile["photos"]:
        media_item = user_profile["photos"][0]
        caption = f"{user_profile['name']}, {user_profile['age']}"
        if user_profile.get("description"):
            caption += f"\n\n{user_profile['description']}"
        if media_item["type"] == "photo":
            await message.answer_photo(photo=media_item["file_id"], caption=caption)
        else:
            await message.answer_video(video=media_item["file_id"], caption=caption)
    await message.answer("Что хочешь сделать? 👇", reply_markup=get_profile_menu_keyboard())

# FIX: "Я больше не хочу никого искать" now hides profile instead of clearing state
@router.message(Viewing.menu, F.text == "🚪 Я больше не хочу никого искать")
async def process_menu_stop(message: Message, state: FSMContext):
    if await check_banned_and_rate(message): return
    user_profile = db.get_user(message.from_user.id)
    if user_profile:
        user_profile["hidden"] = True
        db.update_user(message.from_user.id, user_profile)
    await message.answer(
        "Твоя анкета скрыта — другие тебя не увидят 🙈\n\n"
        "Если захочешь вернуться, просто напиши /start — анкета снова станет видна.",
        reply_markup=ReplyKeyboardRemove()
    )
    await state.clear()

@router.message(Viewing.menu, F.text == "🎁 Пригласи друзей")
async def process_menu_invite(message: Message, state: FSMContext):
    if await check_banned_and_rate(message): return
    user_profile = db.get_user(message.from_user.id)
    referral_count = len(user_profile.get("referrals", []))
    bot_info = await bot.get_me()
    ref_link = f"https://t.me/{bot_info.username}?start=ref{message.from_user.id}"
    if referral_count == 0:
        bonuses = "Пригласи 1 друга — твою анкету увидит больше людей 👀"
    elif referral_count < 3:
        bonuses = f"Ты пригласил {referral_count} друга(-ов). Ещё {3 - referral_count} — и твоя анкета поднимется в топ! 🚀"
    else:
        bonuses = f"Ты пригласил {referral_count} друзей. Твоя анкета в топе! 🔥"
    await message.answer(f"Пригласи друзей — получи больше лайков! 😎\n\nТвоя ссылка:\n{ref_link}\n\n{bonuses}", reply_markup=get_menu_keyboard())

# ===== РЕДАКТИРОВАНИЕ =====

@router.message(F.text == "🔍 Смотреть анкеты")
async def process_profile_menu_browse(message: Message, state: FSMContext):
    if await check_banned_and_rate(message): return
    await state.set_state(Viewing.browsing)
    await state.update_data(current_profile_index=0)
    await message.answer("✨🔍", reply_markup=ReplyKeyboardRemove())
    await show_next_profile(message, state)

@router.message(F.text == "✏️ Заполнить анкету заново")
async def process_profile_menu_refill(message: Message, state: FSMContext):
    if await check_banned_and_rate(message): return
    await state.set_state(Registration.age)
    await message.answer("Давай начнем заново. Сколько тебе лет?", reply_markup=ReplyKeyboardRemove())

@router.message(F.text == "🖼 Изменить фото/видео")
async def process_profile_menu_edit_photo(message: Message, state: FSMContext):
    if await check_banned_and_rate(message): return
    await state.update_data(photos=[], photo_count=0)
    await state.set_state(Registration.edit_photo)
    await message.answer("Отправь новое фото или видео (до 15 сек). Можно до 3 штук.", reply_markup=ReplyKeyboardRemove())

@router.message(Registration.edit_photo, F.photo | F.video)
async def process_edit_photo(message: Message, state: FSMContext):
    if await check_banned_and_rate(message): return
    data = await state.get_data()
    photos = data.get("photos", [])
    photo_count = data.get("photo_count", 0)
    if message.photo:
        photos.append({"type": "photo", "file_id": message.photo[-1].file_id})
    elif message.video:
        photos.append({"type": "video", "file_id": message.video.file_id})
    photo_count += 1
    await state.update_data(photos=photos, photo_count=photo_count)
    if photo_count < 3:
        await message.answer(f"Фото добавлено – {photo_count} из 3. Ещё одно?", reply_markup=get_save_photo_keyboard())
    else:
        user_profile = db.get_user(message.from_user.id)
        user_profile["photos"] = photos
        db.update_user(message.from_user.id, user_profile)
        await state.set_state(Viewing.menu)
        await message.answer("Фото обновлено! ✅", reply_markup=get_menu_keyboard())

@router.message(Registration.edit_photo, F.text == "Это все, сохранить фото")
async def process_edit_photo_save(message: Message, state: FSMContext):
    if await check_banned_and_rate(message): return
    data = await state.get_data()
    photos = data.get("photos", [])
    if not photos:
        await message.answer("Сначала отправь хотя бы одно фото или видео!")
        return
    user_profile = db.get_user(message.from_user.id)
    user_profile["photos"] = photos
    db.update_user(message.from_user.id, user_profile)
    await state.set_state(Viewing.menu)
    await message.answer("Фото обновлено! ✅", reply_markup=get_menu_keyboard())

@router.message(Registration.edit_photo)
async def process_edit_photo_wrong(message: Message, state: FSMContext):
    if await check_banned_and_rate(message): return
    await message.answer("Пожалуйста, отправь фото или видео (до 15 сек) 📸")

@router.message(F.text == "📝 Изменить текст анкеты")
async def process_profile_menu_edit_desc(message: Message, state: FSMContext):
    if await check_banned_and_rate(message): return
    await state.set_state(Registration.edit_description)
    await message.answer("Напиши новый текст анкеты:", reply_markup=get_skip_keyboard())

@router.message(Registration.edit_description)
async def process_edit_description(message: Message, state: FSMContext):
    if await check_banned_and_rate(message): return
    description = "" if message.text == "Пропустить" else message.text
    user_profile = db.get_user(message.from_user.id)
    user_profile["description"] = description
    db.update_user(message.from_user.id, user_profile)
    await state.set_state(Viewing.menu)
    await message.answer("Текст анкеты обновлён! ✅", reply_markup=get_menu_keyboard())

# ===== ПРОВЕРИТЬ ЛАЙКИ =====

@router.message(F.text.in_(["Узнать кто там", "Проверить"]))
async def process_check_likes(message: Message, state: FSMContext):
    if await check_banned_and_rate(message): return
    user_profile = db.get_user(message.from_user.id)
    likes_received = user_profile.get("likes_received", [])
    if likes_received:
        liker_id = likes_received[0]
        liker_profile = db.get_user(liker_id)
        if liker_profile:
            await state.set_state(Viewing.browsing)
            await state.update_data(viewing_user_id=liker_id, current_profile_index=0)
            caption = f"{liker_profile['name']}, {liker_profile['age']}"
            if liker_profile.get("description"):
                caption += f"\n\n{liker_profile['description']}"
            if liker_profile.get("photos"):
                media_item = liker_profile["photos"][0]
                if media_item["type"] == "photo":
                    await message.answer_photo(photo=media_item["file_id"], caption=caption, reply_markup=get_browsing_keyboard())
                else:
                    await message.answer_video(video=media_item["file_id"], caption=caption, reply_markup=get_browsing_keyboard())
            else:
                await message.answer(caption, reply_markup=get_browsing_keyboard())
    else:
        await message.answer("Пока никто не оценил твою анкету 😔", reply_markup=get_menu_keyboard())
        await state.set_state(Viewing.menu)

# ===== ВХОД В АДМИНКУ =====

@router.message(Command("admin"))
async def cmd_admin(message: Message, state: FSMContext):
    if message.from_user.id not in ADMIN_IDS:
        await message.answer("🚫 Сюда нельзя.")
        return
    await state.set_state(Admin.panel)
    banned_count = len(db.data.get("banned", []))
    new_today = db.get_new_today_count()
    unresolved = len(db.get_unresolved_reports())
    reports_count = len(db.get_reports())
    await message.answer(
        f"Добро пожаловать в админ-панель 👑\n\n"
        f"👤 Всего: {len(db.data['users'])} | 🆕 Сегодня: {new_today}\n"
        f"🚫 Забанено: {banned_count} | ⚠️ Жалоб: {reports_count} (необработанных: {unresolved})",
        reply_markup=get_admin_inline()
    )

async def send_admin_panel(target, state: FSMContext, edit: bool = False):
    await state.set_state(Admin.panel)
    banned_count = len(db.data.get("banned", []))
    new_today = db.get_new_today_count()
    unresolved = len(db.get_unresolved_reports())
    reports_count = len(db.get_reports())
    text = (
        f"Админ-панель 👑\n\n"
        f"👤 Всего: {len(db.data['users'])} | 🆕 Сегодня: {new_today}\n"
        f"🚫 Забанено: {banned_count} | ⚠️ Жалоб: {reports_count} (необработанных: {unresolved})"
    )
    if edit and isinstance(target, CallbackQuery):
        try:
            await target.message.edit_text(text, reply_markup=get_admin_inline())
        except Exception:
            await target.message.answer(text, reply_markup=get_admin_inline())
    else:
        msg = target.message if isinstance(target, CallbackQuery) else target
        await msg.answer(text, reply_markup=get_admin_inline())

# ===== ИНЛАЙН ОБРАБОТЧИКИ АДМИНКИ =====

@router.callback_query(F.data == "adm_stats")
async def adm_stats(cb: CallbackQuery, state: FSMContext):
    users = db.data["users"]
    total = len(users)
    guys = sum(1 for u in users.values() if u.get("gender") == "Парень")
    girls = sum(1 for u in users.values() if u.get("gender") == "Девушка")
    total_matches = sum(len(u.get("matches", [])) for u in users.values()) // 2
    total_likes = sum(len(u.get("likes_sent", [])) for u in users.values())
    total_referrals = sum(len(u.get("referrals", [])) for u in users.values())
    loners = sum(1 for u in users.values() if len(u.get("matches", [])) == 0)
    matched = sum(1 for u in users.values() if len(u.get("matches", [])) > 0)
    hidden_count = sum(1 for u in users.values() if u.get("hidden", False))
    new_today = db.get_new_today_count()
    banned_count = len(db.data.get("banned", []))
    reports_count = len(db.get_reports())
    unresolved = len(db.get_unresolved_reports())
    text = (
        f"📊 Статистика бота\n\n"
        f"👤 Всего: {total} | 👦 Парней: {guys} | 👧 Девушек: {girls}\n"
        f"🆕 Новых сегодня: {new_today} | 🚫 Заблокировано: {banned_count}\n"
        f"🙈 Скрытых анкет: {hidden_count}\n\n"
        f"❤️ Всего лайков: {total_likes}\n"
        f"🤝 Взаимных симпатий: {total_matches}\n"
        f"💔 Без симпатий: {loners} | 💞 С симпатиями: {matched}\n"
        f"🔗 Рефералов: {total_referrals}\n"
        f"⚠️ Жалоб: {reports_count} (необработанных: {unresolved})\n\n"
        f"📈 Конверсия: {round(total_matches / total_likes * 100, 1) if total_likes else 0}%"
    )
    back_kb = InlineKeyboardMarkup(inline_keyboard=[[InlineKeyboardButton(text="🔙 Назад", callback_data="adm_back")]])
    await cb.message.edit_text(text, reply_markup=back_kb)
    await cb.answer()

@router.callback_query(F.data == "adm_top")
async def adm_top(cb: CallbackQuery, state: FSMContext):
    users = db.data["users"]
    if not users:
        await cb.answer("Нет пользователей", show_alert=True)
        return
    sorted_users = sorted(users.values(), key=lambda u: len(u.get("likes_sent", [])) + len(u.get("matches", [])) * 2, reverse=True)[:10]
    medals = ["🥇","🥈","🥉","4️⃣","5️⃣","6️⃣","7️⃣","8️⃣","9️⃣","🔟"]
    text = "🔥 Топ-10 активных:\n\n"
    for i, u in enumerate(sorted_users):
        text += f"{medals[i]} {u.get('name','?')} — ❤️{len(u.get('likes_sent',[]))} 🤝{len(u.get('matches',[]))}\n"
    back_kb = InlineKeyboardMarkup(inline_keyboard=[[InlineKeyboardButton(text="🔙 Назад", callback_data="adm_back")]])
    await cb.message.edit_text(text, reply_markup=back_kb)
    await cb.answer()

@router.callback_query(F.data == "adm_loners")
async def adm_loners(cb: CallbackQuery, state: FSMContext):
    loners = [u for u in db.data["users"].values() if len(u.get("matches", [])) == 0]
    if not loners:
        await cb.answer("Одиночек нет 🎉", show_alert=True)
        return
    text = f"💔 Без симпатий: {len(loners)}\n\n"
    for u in loners[:15]:
        username = f"@{u['username']}" if u.get("username") else "без @"
        text += f"• {u.get('name','?')}, {u.get('age','?')} — {username}\n"
    back_kb = InlineKeyboardMarkup(inline_keyboard=[[InlineKeyboardButton(text="🔙 Назад", callback_data="adm_back")]])
    await cb.message.edit_text(text, reply_markup=back_kb)
    await cb.answer()

@router.callback_query(F.data == "adm_toplikes")
async def adm_toplikes(cb: CallbackQuery, state: FSMContext):
    users = db.data["users"]
    if not users:
        await cb.answer("Нет пользователей", show_alert=True)
        return
    sorted_users = sorted(users.values(), key=lambda u: len(u.get("likes_received", [])), reverse=True)[:10]
    medals = ["🥇","🥈","🥉","4️⃣","5️⃣","6️⃣","7️⃣","8️⃣","9️⃣","🔟"]
    text = "🏅 Топ-10 популярных:\n\n"
    for i, u in enumerate(sorted_users):
        gender_icon = "👧" if u.get("gender") == "Девушка" else "👦"
        text += f"{medals[i]} {gender_icon} {u.get('name','?')}, {u.get('age','?')} — ❤️{len(u.get('likes_received',[]))} 🤝{len(u.get('matches',[]))}\n"
    back_kb = InlineKeyboardMarkup(inline_keyboard=[[InlineKeyboardButton(text="🔙 Назад", callback_data="adm_back")]])
    await cb.message.edit_text(text, reply_markup=back_kb)
    await cb.answer()

@router.callback_query(F.data == "adm_toprefs")
async def adm_toprefs(cb: CallbackQuery, state: FSMContext):
    sorted_users = sorted(db.data["users"].values(), key=lambda u: len(u.get("referrals", [])), reverse=True)[:10]
    text = "🏆 Топ по рефералам:\n\n"
    has_any = False
    for i, u in enumerate(sorted_users, 1):
        ref_count = len(u.get("referrals", []))
        if ref_count == 0:
            break
        has_any = True
        text += f"{i}. {u.get('name','?')} — {ref_count} приглашённых\n"
    if not has_any:
        text += "Пока никто не приглашал друзей 😢"
    back_kb = InlineKeyboardMarkup(inline_keyboard=[[InlineKeyboardButton(text="🔙 Назад", callback_data="adm_back")]])
    await cb.message.edit_text(text, reply_markup=back_kb)
    await cb.answer()

@router.callback_query(F.data == "adm_newtoday")
async def adm_newtoday(cb: CallbackQuery, state: FSMContext):
    today = datetime.now().date()
    new_users = []
    for uid, u in db.data["users"].items():
        try:
            if datetime.fromisoformat(u.get("created_at", "")).date() == today:
                new_users.append(u)
        except Exception:
            pass
    if not new_users:
        await cb.answer("Сегодня новых нет", show_alert=True)
        return
    text = f"🆕 Новые сегодня ({len(new_users)}):\n\n"
    for u in new_users:
        username = f"@{u['username']}" if u.get("username") else "без @"
        gender_icon = "👧" if u.get("gender") == "Девушка" else "👦"
        time_str = u.get("created_at", "")[:16].replace("T", " ")
        text += f"{gender_icon} {u.get('name','?')}, {u.get('age','?')} — {username} [{time_str}]\n"
    back_kb = InlineKeyboardMarkup(inline_keyboard=[[InlineKeyboardButton(text="🔙 Назад", callback_data="adm_back")]])
    await cb.message.edit_text(text, reply_markup=back_kb)
    await cb.answer()

@router.callback_query(F.data == "adm_back")
async def adm_back(cb: CallbackQuery, state: FSMContext):
    await send_admin_panel(cb, state, edit=True)
    await cb.answer()

# ===== ПРОСМОТР АНКЕТ АДМИНИСТРАТОРОМ =====

@router.callback_query(F.data == "adm_browse")
async def adm_browse_start(cb: CallbackQuery, state: FSMContext):
    users = list(db.data["users"].values())
    if not users:
        await cb.answer("Анкет пока нет", show_alert=True)
        return
    await state.set_state(Admin.browsing_profiles)
    await state.update_data(admin_browse_index=0)
    await cb.message.delete()
    await adm_show_profile_msg(cb.message, state)
    await cb.answer()

async def adm_show_profile_msg(message: Message, state: FSMContext):
    users = list(db.data["users"].values())
    data = await state.get_data()
    index = data.get("admin_browse_index", 0)
    if not users:
        await message.answer("Анкет нет.")
        await send_admin_panel(message, state)
        return
    # Wrap around
    if index < 0:
        index = len(users) - 1
    if index >= len(users):
        index = 0
    await state.update_data(admin_browse_index=index, admin_viewing_user_id=users[index].get("user_id"))
    u = users[index]
    caption = build_admin_caption(u, index=index, total=len(users))
    kb = get_admin_browse_inline(u.get("user_id"))
    if u.get("photos"):
        media_item = u["photos"][0]
        try:
            if media_item["type"] == "photo":
                await message.answer_photo(photo=media_item["file_id"], caption=caption, reply_markup=kb)
            else:
                await message.answer_video(video=media_item["file_id"], caption=caption, reply_markup=kb)
            return
        except Exception:
            pass
    await message.answer(caption, reply_markup=kb)

# FIX: Added "previous" button handler for admin browse
@router.callback_query(Admin.browsing_profiles, F.data == "admbr_prev")
async def admbr_prev(cb: CallbackQuery, state: FSMContext):
    data = await state.get_data()
    await state.update_data(admin_browse_index=data.get("admin_browse_index", 0) - 1)
    await cb.message.delete()
    await adm_show_profile_msg(cb.message, state)
    await cb.answer()

@router.callback_query(Admin.browsing_profiles, F.data == "admbr_next")
async def admbr_next(cb: CallbackQuery, state: FSMContext):
    data = await state.get_data()
    await state.update_data(admin_browse_index=data.get("admin_browse_index", 0) + 1)
    await cb.message.delete()
    await adm_show_profile_msg(cb.message, state)
    await cb.answer()

@router.callback_query(Admin.browsing_profiles, F.data == "admbr_delete")
async def admbr_delete(cb: CallbackQuery, state: FSMContext):
    data = await state.get_data()
    uid = data.get("admin_viewing_user_id")
    if uid:
        u = db.get_user(uid)
        name = u.get("name", "?") if u else "?"
        db.delete_user(uid)
        await cb.answer(f"✅ {name} удалён", show_alert=True)
    await cb.message.delete()
    await adm_show_profile_msg(cb.message, state)

@router.callback_query(Admin.browsing_profiles, F.data == "admbr_ban")
async def admbr_ban(cb: CallbackQuery, state: FSMContext):
    data = await state.get_data()
    uid = data.get("admin_viewing_user_id")
    if uid:
        u = db.get_user(uid)
        name = u.get("name", "?") if u else "?"
        db.ban_user(uid)
        try:
            await bot.send_message(uid, f"🚫 Твой аккаунт заблокирован.\n\nЕсли ошибка — пиши {SUPPORT_USERNAME}")
        except Exception: pass
        await cb.answer(f"✅ {name} заблокирован", show_alert=True)
    await cb.message.delete()
    await adm_show_profile_msg(cb.message, state)

@router.callback_query(Admin.browsing_profiles, F.data == "admbr_activity")
async def admbr_activity(cb: CallbackQuery, state: FSMContext):
    data = await state.get_data()
    uid = data.get("admin_viewing_user_id")
    u = db.get_user(uid) if uid else None
    if not u:
        await cb.answer("Не найден", show_alert=True)
        return
    text = build_admin_interactions_text(u)
    back_kb = InlineKeyboardMarkup(inline_keyboard=[[InlineKeyboardButton(text="🔙 Назад к анкете", callback_data="admbr_act_back")]])
    await cb.message.delete()
    await cb.message.answer(text, reply_markup=back_kb)
    await cb.answer()

@router.callback_query(Admin.browsing_profiles, F.data == "admbr_act_back")
async def admbr_act_back(cb: CallbackQuery, state: FSMContext):
    await cb.message.delete()
    await adm_show_profile_msg(cb.message, state)
    await cb.answer()

@router.callback_query(Admin.browsing_profiles, F.data == "admbr_msg")
async def admbr_msg_start(cb: CallbackQuery, state: FSMContext):
    await state.set_state(Admin.messaging_user)
    await cb.message.delete()
    sent = await cb.message.answer("✏️ Напиши сообщение:", reply_markup=get_cancel_keyboard())
    await state.update_data(admin_prompt_msg_id=sent.message_id)
    await cb.answer()

@router.message(Admin.messaging_user, F.text == "🔙 Отмена")
async def admbr_msg_cancel(message: Message, state: FSMContext):
    await delete_admin_prompt(state, message.chat.id)
    await state.set_state(Admin.browsing_profiles)
    await adm_show_profile_msg(message, state)

@router.message(Admin.messaging_user)
async def admbr_msg_send(message: Message, state: FSMContext):
    await delete_admin_prompt(state, message.chat.id)
    data = await state.get_data()
    uid = data.get("admin_viewing_user_id")
    if uid:
        try:
            await bot.send_message(uid, f"📨 Сообщение от администратора:\n\n{message.text}")
            await message.answer("✅ Доставлено.", reply_markup=ReplyKeyboardRemove())
        except Exception:
            await message.answer("❌ Не удалось.", reply_markup=ReplyKeyboardRemove())
    await state.set_state(Admin.browsing_profiles)
    await adm_show_profile_msg(message, state)

@router.callback_query(Admin.browsing_profiles, F.data == "admbr_back")
async def admbr_back(cb: CallbackQuery, state: FSMContext):
    await cb.message.delete()
    await send_admin_panel(cb, state)
    await cb.answer()

# ===== СПИСОК ПОЛЬЗОВАТЕЛЕЙ =====

@router.callback_query(F.data == "adm_userlist")
async def adm_userlist(cb: CallbackQuery, state: FSMContext):
    users = db.data["users"]
    if not users:
        await cb.answer("Анкет нет", show_alert=True)
        return
    await state.set_state(Admin.user_list)
    await state.update_data(user_list_page=0)
    text, kb = get_admin_userlist_inline(list(users.items()), 0)
    await cb.message.edit_text(text, reply_markup=kb)
    await cb.answer()

@router.callback_query(Admin.user_list, F.data.startswith("adm_ul_page_"))
async def adm_ul_page(cb: CallbackQuery, state: FSMContext):
    page = int(cb.data.split("_")[-1])
    await state.update_data(user_list_page=page)
    text, kb = get_admin_userlist_inline(list(db.data["users"].items()), page)
    await cb.message.edit_text(text, reply_markup=kb)
    await cb.answer()

@router.callback_query(Admin.user_list, F.data.startswith("adm_ul_select_"))
async def adm_ul_select(cb: CallbackQuery, state: FSMContext):
    uid = int(cb.data.split("_")[-1])
    u = db.get_user(uid)
    if not u:
        await cb.answer("Не найден", show_alert=True)
        return
    await state.update_data(admin_selected_user_id=uid)
    await state.set_state(Admin.user_list_action)
    caption = build_admin_caption(u)
    kb = get_admin_user_action_inline(uid)
    if u.get("photos"):
        media_item = u["photos"][0]
        try:
            await cb.message.delete()
            if media_item["type"] == "photo":
                await cb.message.answer_photo(photo=media_item["file_id"], caption=caption, reply_markup=kb)
            else:
                await cb.message.answer_video(video=media_item["file_id"], caption=caption, reply_markup=kb)
            await cb.answer()
            return
        except Exception:
            pass
    await cb.message.edit_text(caption, reply_markup=kb)
    await cb.answer()

@router.callback_query(Admin.user_list, F.data == "adm_ul_back")
async def adm_ul_back(cb: CallbackQuery, state: FSMContext):
    await send_admin_panel(cb, state, edit=True)
    await cb.answer()

@router.callback_query(Admin.user_list_action, F.data.startswith("adm_ua_act_"))
async def adm_ua_activity(cb: CallbackQuery, state: FSMContext):
    uid = int(cb.data.split("_")[-1])
    u = db.get_user(uid)
    if not u:
        await cb.answer("Не найден", show_alert=True)
        return
    text = build_admin_interactions_text(u)
    back_kb = InlineKeyboardMarkup(inline_keyboard=[[InlineKeyboardButton(text="🔙 Назад", callback_data=f"adm_ua_actback_{uid}")]])
    await cb.message.delete()
    await cb.message.answer(text, reply_markup=back_kb)
    await cb.answer()

@router.callback_query(F.data.startswith("adm_ua_actback_"))
async def adm_ua_actback(cb: CallbackQuery, state: FSMContext):
    uid = int(cb.data.split("_")[-1])
    u = db.get_user(uid)
    await cb.message.delete()
    if u:
        caption = build_admin_caption(u)
        kb = get_admin_user_action_inline(uid)
        if u.get("photos"):
            media_item = u["photos"][0]
            try:
                if media_item["type"] == "photo":
                    await cb.message.answer_photo(photo=media_item["file_id"], caption=caption, reply_markup=kb)
                else:
                    await cb.message.answer_video(video=media_item["file_id"], caption=caption, reply_markup=kb)
                await cb.answer()
                return
            except Exception:
                pass
        await cb.message.answer(caption, reply_markup=kb)
    await cb.answer()

@router.callback_query(Admin.user_list_action, F.data.startswith("adm_ua_del_"))
async def adm_ua_delete(cb: CallbackQuery, state: FSMContext):
    uid = int(cb.data.split("_")[-1])
    u = db.get_user(uid)
    name = u.get("name", "?") if u else "?"
    db.delete_user(uid)
    await cb.answer(f"✅ {name} удалён", show_alert=True)
    await state.set_state(Admin.user_list)
    await state.update_data(user_list_page=0)
    text, kb = get_admin_userlist_inline(list(db.data["users"].items()), 0)
    try:
        await cb.message.delete()
    except Exception:
        pass
    await cb.message.answer(text, reply_markup=kb)

@router.callback_query(Admin.user_list_action, F.data.startswith("adm_ua_ban_"))
async def adm_ua_ban(cb: CallbackQuery, state: FSMContext):
    uid = int(cb.data.split("_")[-1])
    u = db.get_user(uid)
    name = u.get("name", "?") if u else "?"
    db.ban_user(uid)
    try:
        await bot.send_message(uid, f"🚫 Твой аккаунт заблокирован.\n\nЕсли ошибка — пиши {SUPPORT_USERNAME}")
    except Exception: pass
    await cb.answer(f"✅ {name} заблокирован", show_alert=True)
    await state.set_state(Admin.user_list)
    data = await state.get_data()
    page = data.get("user_list_page", 0)
    text, kb = get_admin_userlist_inline(list(db.data["users"].items()), page)
    try:
        await cb.message.delete()
    except Exception:
        pass
    await cb.message.answer(text, reply_markup=kb)

@router.callback_query(Admin.user_list_action, F.data.startswith("adm_ua_msg_"))
async def adm_ua_msg_start(cb: CallbackQuery, state: FSMContext):
    await state.set_state(Admin.user_list_messaging)
    await cb.message.delete()
    sent = await cb.message.answer("✏️ Напиши сообщение:", reply_markup=get_cancel_keyboard())
    await state.update_data(admin_prompt_msg_id=sent.message_id)
    await cb.answer()

@router.message(Admin.user_list_messaging, F.text == "🔙 Отмена")
async def adm_ua_msg_cancel(message: Message, state: FSMContext):
    await delete_admin_prompt(state, message.chat.id)
    data = await state.get_data()
    uid = data.get("admin_selected_user_id")
    await state.set_state(Admin.user_list_action)
    u = db.get_user(uid) if uid else None
    if u:
        caption = build_admin_caption(u)
        kb = get_admin_user_action_inline(uid)
        if u.get("photos"):
            media_item = u["photos"][0]
            try:
                if media_item["type"] == "photo":
                    await message.answer_photo(photo=media_item["file_id"], caption=caption, reply_markup=kb)
                else:
                    await message.answer_video(video=media_item["file_id"], caption=caption, reply_markup=kb)
                return
            except Exception:
                pass
        await message.answer(caption, reply_markup=kb)

@router.message(Admin.user_list_messaging)
async def adm_ua_msg_send(message: Message, state: FSMContext):
    await delete_admin_prompt(state, message.chat.id)
    data = await state.get_data()
    uid = data.get("admin_selected_user_id")
    if uid:
        try:
            await bot.send_message(uid, f"📨 Сообщение от администратора:\n\n{message.text}")
            await message.answer("✅ Доставлено.", reply_markup=ReplyKeyboardRemove())
        except Exception:
            await message.answer("❌ Не удалось.", reply_markup=ReplyKeyboardRemove())
    await state.set_state(Admin.user_list_action)
    u = db.get_user(uid) if uid else None
    if u:
        caption = build_admin_caption(u)
        kb = get_admin_user_action_inline(uid)
        if u.get("photos"):
            media_item = u["photos"][0]
            try:
                if media_item["type"] == "photo":
                    await message.answer_photo(photo=media_item["file_id"], caption=caption, reply_markup=kb)
                else:
                    await message.answer_video(video=media_item["file_id"], caption=caption, reply_markup=kb)
                return
            except Exception:
                pass
        await message.answer(caption, reply_markup=kb)

@router.callback_query(Admin.user_list_action, F.data == "adm_ua_back")
async def adm_ua_back(cb: CallbackQuery, state: FSMContext):
    await state.set_state(Admin.user_list)
    data = await state.get_data()
    page = data.get("user_list_page", 0)
    text, kb = get_admin_userlist_inline(list(db.data["users"].items()), page)
    try:
        await cb.message.delete()
    except Exception:
        pass
    await cb.message.answer(text, reply_markup=kb)
    await cb.answer()

# ===== ЖАЛОБЫ =====

async def show_report_inline(cb_or_msg, state: FSMContext):
    data = await state.get_data()
    report_index = data.get("report_index", 0)
    all_reports = db.get_reports()
    unresolved_with_idx = [(i, r) for i, r in enumerate(all_reports) if not r.get("resolved", False)]
    is_cb = isinstance(cb_or_msg, CallbackQuery)
    msg = cb_or_msg.message if is_cb else cb_or_msg
    if not unresolved_with_idx:
        await state.set_state(Admin.panel)
        await msg.answer("✅ Все жалобы обработаны!")
        await send_admin_panel(msg, state)
        return
    if report_index >= len(unresolved_with_idx):
        report_index = 0
        await state.update_data(report_index=0)
    actual_idx, report = unresolved_with_idx[report_index]
    await state.update_data(report_index=report_index, report_actual_index=actual_idx, report_on_user_id=report["on"])
    on_user = db.get_user(report["on"])
    from_user_obj = db.get_user(report["from"])
    on_name = on_user.get("name", "?") if on_user else "?"
    on_username = f"@{on_user['username']}" if on_user and on_user.get("username") else f"ID:{report['on']}"
    from_name = from_user_obj.get("name", "?") if from_user_obj else "?"
    time_str = report.get("at", "")[:16].replace("T", " ")
    banned_mark = " 🚫 УЖЕ ЗАБАНЕН" if on_user and db.is_banned(on_user.get("user_id")) else ""
    text = (
        f"⚠️ Жалоба {report_index + 1} из {len(unresolved_with_idx)}\n\n"
        f"На кого: {on_name} ({on_username}) ID: {report['on']}{banned_mark}\n"
        f"От кого: {from_name}\n"
        f"Причина: {report['reason']}\n"
        f"Время: {time_str}\n"
    )
    if on_user and on_user.get("description"):
        text += f"\nОписание: {on_user['description'][:100]}\n"
    kb = get_report_action_inline()
    if on_user and on_user.get("photos"):
        media_item = on_user["photos"][0]
        try:
            if media_item["type"] == "photo":
                await msg.answer_photo(photo=media_item["file_id"], caption=text, reply_markup=kb)
            else:
                await msg.answer_video(video=media_item["file_id"], caption=text, reply_markup=kb)
            return
        except Exception:
            pass
    await msg.answer(text, reply_markup=kb)

@router.callback_query(F.data == "adm_reports")
async def adm_reports(cb: CallbackQuery, state: FSMContext):
    unresolved = db.get_unresolved_reports()
    if not unresolved:
        await cb.answer("Необработанных жалоб нет ✅", show_alert=True)
        return
    await state.set_state(Admin.report_action)
    await state.update_data(report_index=0)
    await cb.message.delete()
    await show_report_inline(cb, state)
    await cb.answer()

@router.callback_query(Admin.report_action, F.data == "adm_rep_resolve")
async def adm_rep_resolve(cb: CallbackQuery, state: FSMContext):
    data = await state.get_data()
    actual_idx = data.get("report_actual_index")
    if actual_idx is not None:
        db.resolve_report(actual_idx)
    await cb.answer("✅ Обработано")
    await cb.message.delete()
    await show_report_inline(cb, state)

@router.callback_query(Admin.report_action, F.data == "adm_rep_next")
async def adm_rep_next(cb: CallbackQuery, state: FSMContext):
    data = await state.get_data()
    await state.update_data(report_index=data.get("report_index", 0) + 1)
    await cb.message.delete()
    await show_report_inline(cb, state)
    await cb.answer()

@router.callback_query(Admin.report_action, F.data == "adm_rep_ban")
async def adm_rep_ban(cb: CallbackQuery, state: FSMContext):
    data = await state.get_data()
    uid = data.get("report_on_user_id")
    actual_idx = data.get("report_actual_index")
    if uid:
        u = db.get_user(uid)
        name = u.get("name", "?") if u else "?"
        db.ban_user(uid)
        try:
            await bot.send_message(uid, f"🚫 Твой аккаунт заблокирован.\n\nЕсли ошибка — пиши {SUPPORT_USERNAME}")
        except Exception: pass
        if actual_idx is not None:
            db.resolve_report(actual_idx)
        await cb.answer(f"✅ {name} заблокирован", show_alert=True)
    await cb.message.delete()
    await show_report_inline(cb, state)

@router.callback_query(Admin.report_action, F.data == "adm_rep_del")
async def adm_rep_del(cb: CallbackQuery, state: FSMContext):
    data = await state.get_data()
    uid = data.get("report_on_user_id")
    actual_idx = data.get("report_actual_index")
    if uid:
        u = db.get_user(uid)
        name = u.get("name", "?") if u else "?"
        db.delete_user(uid)
        if actual_idx is not None:
            db.resolve_report(actual_idx)
        await cb.answer(f"✅ {name} удалён", show_alert=True)
    await cb.message.delete()
    await show_report_inline(cb, state)

@router.callback_query(Admin.report_action, F.data == "adm_rep_back")
async def adm_rep_back(cb: CallbackQuery, state: FSMContext):
    await cb.message.delete()
    await send_admin_panel(cb, state)
    await cb.answer()

# ===== РАССЫЛКА =====

@router.callback_query(F.data == "adm_broadcast")
async def adm_broadcast_start(cb: CallbackQuery, state: FSMContext):
    await state.set_state(Admin.broadcast)
    await cb.message.delete()
    sent = await cb.message.answer("📢 Напиши сообщение для рассылки. Для отмены — /cancel", reply_markup=get_cancel_keyboard())
    await state.update_data(admin_prompt_msg_id=sent.message_id)
    await cb.answer()

@router.message(Admin.broadcast, F.text == "🔙 Отмена")
async def adm_broadcast_cancel_btn(message: Message, state: FSMContext):
    await delete_admin_prompt(state, message.chat.id)
    await send_admin_panel(message, state)

@router.message(Admin.broadcast, Command("cancel"))
async def adm_broadcast_cancel(message: Message, state: FSMContext):
    await delete_admin_prompt(state, message.chat.id)
    await send_admin_panel(message, state)

@router.message(Admin.broadcast)
async def adm_broadcast_send(message: Message, state: FSMContext):
    await delete_admin_prompt(state, message.chat.id)
    users = db.data["users"]
    sent = 0
    failed = 0
    for uid in users:
        try:
            await bot.send_message(int(uid), f"📢 Сообщение от администрации:\n\n{message.text}")
            sent += 1
        except Exception:
            failed += 1
    await message.answer(f"✅ Рассылка завершена!\nДоставлено: {sent} | Не доставлено: {failed}", reply_markup=ReplyKeyboardRemove())
    await send_admin_panel(message, state)

# ===== ПОИСК =====

@router.callback_query(F.data == "adm_search")
async def adm_search_start(cb: CallbackQuery, state: FSMContext):
    await state.set_state(Admin.search_user)
    await cb.message.delete()
    sent = await cb.message.answer("🔍 Введи имя или @username:", reply_markup=get_cancel_keyboard())
    await state.update_data(admin_prompt_msg_id=sent.message_id)
    await cb.answer()

@router.message(Admin.search_user, F.text == "🔙 Отмена")
async def adm_search_cancel(message: Message, state: FSMContext):
    await delete_admin_prompt(state, message.chat.id)
    await send_admin_panel(message, state)

@router.message(Admin.search_user)
async def adm_search_exec(message: Message, state: FSMContext):
    await delete_admin_prompt(state, message.chat.id)
    query = message.text.lower().strip().lstrip("@")
    banned = db.data.get("banned", [])
    results = [u for u in db.data["users"].values()
               if query in u.get("name", "").lower() or query in (u.get("username") or "").lower()]
    if not results:
        await message.answer("Никого не нашлось 🔍", reply_markup=ReplyKeyboardRemove())
        await send_admin_panel(message, state)
        return
    text = f"🕵️ Найдено {len(results)}:\n\n"
    for u in results[:10]:
        username = f"@{u['username']}" if u.get("username") else "без @"
        ban_mark = " 🚫" if u.get("user_id") in banned else ""
        hidden_mark = " 🙈" if u.get("hidden") else ""
        text += (
            f"• {u.get('name','?')}, {u.get('age','?')}{ban_mark}{hidden_mark}\n"
            f"  {username} | ID: {u.get('user_id','?')}\n"
            f"  ❤️{len(u.get('likes_sent',[]))} 💌{len(u.get('likes_received',[]))} 🤝{len(u.get('matches',[]))}\n\n"
        )
    await message.answer(text, reply_markup=ReplyKeyboardRemove())
    await send_admin_panel(message, state)

# ===== УДАЛИТЬ АНКЕТУ =====

@router.callback_query(F.data == "adm_delete")
async def adm_delete_start(cb: CallbackQuery, state: FSMContext):
    await state.set_state(Admin.delete_user)
    await cb.message.delete()
    sent = await cb.message.answer("🗑️ Введи @username или имя:", reply_markup=get_cancel_keyboard())
    await state.update_data(admin_prompt_msg_id=sent.message_id)
    await cb.answer()

@router.message(Admin.delete_user, F.text == "🔙 Отмена")
async def adm_delete_cancel(message: Message, state: FSMContext):
    await delete_admin_prompt(state, message.chat.id)
    await send_admin_panel(message, state)

@router.message(Admin.delete_user)
async def adm_delete_exec(message: Message, state: FSMContext):
    await delete_admin_prompt(state, message.chat.id)
    query = message.text.lower().strip().lstrip("@")
    found = [(uid, u) for uid, u in db.data["users"].items()
             if query in u.get("name", "").lower() or query in (u.get("username") or "").lower()]
    if not found:
        await message.answer("Не найден 🔍", reply_markup=ReplyKeyboardRemove())
        await send_admin_panel(message, state)
        return
    if len(found) > 1:
        text = f"Найдено {len(found)}. Уточни:\n\n"
        for uid, u in found[:10]:
            username = f"@{u['username']}" if u.get("username") else "без @"
            text += f"• {u.get('name','?')}, {u.get('age','?')} — {username}\n"
        await message.answer(text, reply_markup=ReplyKeyboardRemove())
        await send_admin_panel(message, state)
        return
    uid, u = found[0]
    db.delete_user(u.get("user_id"))
    username = f"@{u['username']}" if u.get("username") else "без @"
    await message.answer(f"✅ Удалено: {u.get('name','?')}, {u.get('age','?')} — {username}", reply_markup=ReplyKeyboardRemove())
    await send_admin_panel(message, state)

# ===== ЗАБАНИТЬ =====

@router.callback_query(F.data == "adm_ban")
async def adm_ban_start(cb: CallbackQuery, state: FSMContext):
    await state.set_state(Admin.ban_user)
    await cb.message.delete()
    sent = await cb.message.answer("🚫 Введи @username, имя или числовой ID:", reply_markup=get_cancel_keyboard())
    await state.update_data(admin_prompt_msg_id=sent.message_id)
    await cb.answer()

@router.message(Admin.ban_user, F.text == "🔙 Отмена")
async def adm_ban_cancel(message: Message, state: FSMContext):
    await delete_admin_prompt(state, message.chat.id)
    await send_admin_panel(message, state)

@router.message(Admin.ban_user)
async def adm_ban_exec(message: Message, state: FSMContext):
    await delete_admin_prompt(state, message.chat.id)
    query = message.text.lower().strip().lstrip("@")
    found = []
    try:
        uid_int = int(message.text.strip())
        u = db.get_user(uid_int)
        if u:
            found = [(str(uid_int), u)]
    except ValueError:
        pass
    if not found:
        for uid, u in db.data["users"].items():
            if query in u.get("name", "").lower() or query in (u.get("username") or "").lower():
                found.append((uid, u))
    if not found:
        await message.answer("Пользователь не найден 🔍", reply_markup=ReplyKeyboardRemove())
        await send_admin_panel(message, state)
        return
    if len(found) > 1:
        text = "Найдено несколько. Уточни ID:\n\n"
        for uid, u in found[:10]:
            username = f"@{u['username']}" if u.get("username") else "без @"
            text += f"• {u.get('name','?')} — {username} | ID: {u.get('user_id', uid)}\n"
        await message.answer(text, reply_markup=ReplyKeyboardRemove())
        await send_admin_panel(message, state)
        return
    uid, u = found[0]
    user_id = u.get("user_id")
    db.ban_user(user_id)
    try:
        await bot.send_message(user_id, f"🚫 Твой аккаунт заблокирован.\n\nЕсли ошибка — пиши {SUPPORT_USERNAME}")
    except Exception: pass
    username = f"@{u['username']}" if u.get("username") else "без @"
    await message.answer(f"✅ Заблокирован: {u.get('name','?')}, {u.get('age','?')} — {username}", reply_markup=ReplyKeyboardRemove())
    await send_admin_panel(message, state)

# ===== РАЗБАНИТЬ =====

@router.callback_query(F.data == "adm_unban")
async def adm_unban_start(cb: CallbackQuery, state: FSMContext):
    banned = db.data.get("banned", [])
    if not banned:
        await cb.answer("Заблокированных нет", show_alert=True)
        return
    await state.set_state(Admin.unban_user)
    text = f"✅ Заблокировано {len(banned)}:\n\n"
    for uid in banned[:20]:
        u = db.get_user(uid)
        if u:
            username = f"@{u['username']}" if u.get("username") else "без @"
            text += f"• {u.get('name','?')} — {username} | ID: {uid}\n"
        else:
            text += f"• [нет анкеты] ID: {uid}\n"
    text += "\nВведи числовой ID для разблокировки:"
    await cb.message.delete()
    sent = await cb.message.answer(text, reply_markup=get_cancel_keyboard())
    await state.update_data(admin_prompt_msg_id=sent.message_id)
    await cb.answer()

@router.message(Admin.unban_user, F.text == "🔙 Отмена")
async def adm_unban_cancel(message: Message, state: FSMContext):
    await delete_admin_prompt(state, message.chat.id)
    await send_admin_panel(message, state)

@router.message(Admin.unban_user)
async def adm_unban_exec(message: Message, state: FSMContext):
    await delete_admin_prompt(state, message.chat.id)
    try:
        uid = int(message.text.strip())
    except ValueError:
        await message.answer("Введи числовой ID.")
        return
    if uid not in db.data.get("banned", []):
        await message.answer("Этот пользователь не заблокирован.", reply_markup=ReplyKeyboardRemove())
        await send_admin_panel(message, state)
        return
    db.unban_user(uid)
    u = db.get_user(uid)
    name = u.get("name", "?") if u else "?"
    try:
        await bot.send_message(uid, "✅ Твой аккаунт разблокирован. Можешь продолжать!")
    except Exception: pass
    await message.answer(f"✅ {name} (ID: {uid}) разблокирован.", reply_markup=ReplyKeyboardRemove())
    await send_admin_panel(message, state)

# ===== НАПИСАТЬ ЮЗЕРУ =====

@router.callback_query(F.data == "adm_dm")
async def adm_dm_start(cb: CallbackQuery, state: FSMContext):
    await state.set_state(Admin.direct_message_id)
    await cb.message.delete()
    sent = await cb.message.answer("📩 Введи числовой ID пользователя:", reply_markup=get_cancel_keyboard())
    await state.update_data(admin_prompt_msg_id=sent.message_id)
    await cb.answer()

@router.message(Admin.direct_message_id, F.text == "🔙 Отмена")
async def adm_dm_id_cancel(message: Message, state: FSMContext):
    await delete_admin_prompt(state, message.chat.id)
    await send_admin_panel(message, state)

@router.message(Admin.direct_message_id)
async def adm_dm_get_id(message: Message, state: FSMContext):
    await delete_admin_prompt(state, message.chat.id)
    try:
        uid = int(message.text.strip())
    except ValueError:
        await message.answer("Введи числовой ID.")
        return
    u = db.get_user(uid)
    if not u:
        await message.answer("Не найден.", reply_markup=ReplyKeyboardRemove())
        await send_admin_panel(message, state)
        return
    await state.update_data(direct_message_target_id=uid)
    await state.set_state(Admin.direct_message_text)
    username = f"@{u['username']}" if u.get("username") else "без @"
    sent = await message.answer(f"✏️ Пишешь: {u.get('name','?')} ({username})\n\nВведи сообщение:", reply_markup=get_cancel_keyboard())
    await state.update_data(admin_prompt_msg_id=sent.message_id)

@router.message(Admin.direct_message_text, F.text == "🔙 Отмена")
async def adm_dm_text_cancel(message: Message, state: FSMContext):
    await delete_admin_prompt(state, message.chat.id)
    await send_admin_panel(message, state)

@router.message(Admin.direct_message_text)
async def adm_dm_send(message: Message, state: FSMContext):
    await delete_admin_prompt(state, message.chat.id)
    data = await state.get_data()
    uid = data.get("direct_message_target_id")
    if uid:
        try:
            await bot.send_message(uid, f"📨 Сообщение от администратора:\n\n{message.text}")
            u = db.get_user(uid)
            name = u.get("name", "?") if u else "?"
            await message.answer(f"✅ Доставлено пользователю {name}.", reply_markup=ReplyKeyboardRemove())
        except Exception:
            await message.answer("❌ Не удалось — пользователь заблокировал бота.", reply_markup=ReplyKeyboardRemove())
    else:
        await message.answer("Ошибка.", reply_markup=ReplyKeyboardRemove())
    await send_admin_panel(message, state)

# ===== ВЫЙТИ ИЗ АДМИНКИ =====

@router.callback_query(F.data == "adm_exit")
async def adm_exit(cb: CallbackQuery, state: FSMContext):
    await state.set_state(Viewing.menu)
    await cb.message.delete()
    await cb.message.answer(MENU_TEXT, reply_markup=get_menu_keyboard())
    await cb.answer()

# ===== ОБРАБОТЧИК НЕПОНЯТНЫХ КОМАНД =====

@router.message()
async def unknown_message(message: Message, state: FSMContext):
    if await is_rate_limited(message.from_user.id):
        return
    if db.is_banned(message.from_user.id):
        await message.answer("🚫 Твой аккаунт заблокирован. Если считаешь это ошибкой — пиши @sneakerdash_manager")
        return
    await message.answer("🤷 Не понимаю эту команду.\n\nНапиши /start для возврата в главное меню.")

# ===== ЗАПУСК =====

async def main():
    dp.include_router(router)
    await dp.start_polling(bot)

if __name__ == "__main__":
    asyncio.run(main())