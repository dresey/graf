# ✅ Финальная инструкция — деплой на GitHub Pages

## Что уже готово:
- ✅ API-сервер работает локально и через Tailscale Funnel
- ✅ Форма входа работает, токен настроен
- ✅ Синхронизация между устройствами работает
- ✅ `server-config.js` настроен на продакшн URL: `https://dresee.tail7ee3bb.ts.net`

---

## 🚀 Шаги для деплоя:

### 1. Убедись что Tailscale Funnel работает

Проверь что сервер доступен извне:
```bash
curl https://dresee.tail7ee3bb.ts.net/api/health
```

Если нет, запусти Funnel (PowerShell от админа):
```powershell
tailscale funnel 3000
```

### 2. Убедись что сервер запущен

Должен быть запущен **start-server.bat** с правильным `.env`:
```bash
start-server.bat
```

Сервер покажет:
```
Token for team: GrfK2026-9mX4pL8qWnZ3vB7jR5hT6sN
Schedule API listening on http://127.0.0.1:3000
```

### 3. Подготовь файлы для GitHub

**Файлы для коммита:**
- ✅ `index.html`
- ✅ `app.js` (с исправленным багом)
- ✅ `styles.css`
- ✅ `server-config.js` (с `https://dresee.tail7ee3bb.ts.net`)

**НЕ коммить:**
- ❌ `.env` (секретный токен!)
- ❌ `server.js` (не нужен на фронтенде)
- ❌ `data/` (база данных на сервере)
- ❌ `node_modules/`

### 4. Закоммить и запушить

```bash
git add index.html app.js styles.css server-config.js
git commit -m "Fix login modal and sync functionality"
git push origin main
```

### 5. Включить GitHub Pages

1. Открой репозиторий на GitHub
2. Settings → Pages
3. Source: **Deploy from branch**
4. Branch: **main** → **/ (root)**
5. Save

Через 1-2 минуты сайт будет доступен на:
```
https://dresey.github.io/
```

### 6. Проверить что всё работает

Открой `https://dresey.github.io/` (или твой URL):
1. Должна появиться форма входа
2. Введи токен: `GrfK2026-9mX4pL8qWnZ3vB7jR5hT6sN`
3. График должен загрузиться
4. Изменения синхронизируются между устройствами

---

## 🔐 Раздать доступ команде

**Отправь команде:**
1. **URL приложения:** `https://dresey.github.io/`
2. **Токен команды:** `GrfK2026-9mX4pL8qWnZ3vB7jR5hT6sN`

**Важно сказать:**
- Ноутбук с сервером должен быть включён и подключён к интернету
- Если сервер недоступен, приложение работает локально (без синхронизации)
- Токен даёт полный доступ к графику — не публикуй его

---

## 🛠️ Управление сервером на ноутбуке

### Запуск при включении компьютера

**Вариант 1: Ярлык в автозагрузке**
1. Создай ярлык на `start-server.bat`
2. Скопируй в: `%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup`

**Вариант 2: Планировщик заданий**
1. Win+R → `taskschd.msc`
2. Создать задачу → Триггер: При входе в систему
3. Действие: `C:\путь\к\start-server.bat`

### Остановка сервера
```cmd
taskkill /F /IM node.exe
```

### Проверка статуса
```cmd
netstat -ano | findstr :3000
```

---

## 📋 Файловая структура

```
grafic/
├── index.html          # Фронтенд (GitHub Pages)
├── app.js              # Фронтенд логика (GitHub Pages)
├── styles.css          # Стили (GitHub Pages)
├── server-config.js    # Конфиг API URL (GitHub Pages)
├── server.js           # Бэкенд (только на ноутбуке)
├── start-server.bat    # Запуск сервера (только на ноутбуке)
├── .env                # Секреты (НЕ коммитить!)
├── data/
│   └── schedule.json   # База данных (создаётся автоматически)
└── README-server.md    # Документация
```

---

## 🐛 Решение проблем

### "Сервер недоступен" в приложении
1. Проверь что ноутбук включён
2. Проверь что `start-server.bat` запущен
3. Проверь Tailscale Funnel: `tailscale funnel 3000`
4. Проверь URL: `curl https://dresee.tail7ee3bb.ts.net/api/health`

### "Данные не синхронизируются"
1. Убедись что оба устройства используют **один токен**
2. Проверь статус в приложении (правый верхний угол)
3. Открой консоль (F12) и проверь ошибки сети

### "401 Unauthorized" или CORS ошибка
1. Проверь что GitHub Pages URL добавлен в `.env`:
   ```
   ALLOWED_ORIGINS=https://dresey.github.io,...
   ```
2. Перезапусти сервер: `start-server.bat`

---

## ✨ Готово!

Теперь у тебя:
- 🌐 Приложение на GitHub Pages
- 🔒 Защищённый API-сервер на ноутбуке
- 🔄 Синхронизация между всеми устройствами команды
- 📱 Работает на телефонах и компьютерах

**Команда может работать из любой точки мира!** 🎉
