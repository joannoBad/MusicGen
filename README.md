# MusicGen Password Lab

Приложение генерирует пароль из акустического отпечатка аудиозаписи.

В приложении есть два режима:

- `Exact`: детерминированная генерация пароля для одного и того же нормализованного аудио.
- `Robust`: более устойчивый спектральный отпечаток, который старается сохранять близость для похожих версий одной записи.

## Стек

- Frontend: Next.js 15, React 19, TypeScript
- Backend: FastAPI, Python
- DSP-подход: детерминированная нормализация, извлечение спектральных признаков, маппинг в пароль

## Структура репозитория

```text
frontend/        UI на Next.js
backend/         FastAPI API и логика аудио-отпечатков
scripts/         Скрипты запуска для разработки и production-like режима
deploy/          Дополнительные конфиги для Linux-развёртывания
deploy/systemd/  Шаблоны systemd unit-файлов
```

## Текущее состояние MVP

- Backend сейчас поддерживает `WAV` и `MP3`.
- Для декодирования `MP3` используется `ffmpeg`.
- Генерация пароля остаётся детерминированной, если на вход попадает одно и то же нормализованное аудио.
- Frontend умеет работать за reverse proxy и по умолчанию может ходить в `/api/*` на том же хосте.

## Быстрый запуск

### Windows, production-like режим

Запуск:

```bat
start_prod.cmd
```

Остановка:

```bat
stop_prod.cmd
```

### Linux, production-like режим

Один раз сделай скрипты исполняемыми:

```bash
chmod +x start_prod.sh stop_prod.sh scripts/*.sh
```

Запуск:

```bash
./start_prod.sh
```

Остановка:

```bash
./stop_prod.sh
```

После старта доступны:

- frontend: `http://127.0.0.1:3000`
- backend health: `http://127.0.0.1:8000/api/health`

### Windows, режим разработки

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\start_all.ps1
```

## Настройка Linux-сервера

Рекомендуемый стек на Linux:

- управление процессами: `systemd`
- reverse proxy: `Caddy`
- декодирование аудио: `ffmpeg`

Пример установки зависимостей:

```bash
sudo apt update
sudo apt install -y python3 python3-venv python3-pip ffmpeg nodejs npm caddy
```

Установка зависимостей проекта:

```bash
cd /opt/musicgen/frontend
npm install
npm run build

cd /opt/musicgen/backend
python3 -m venv .venv
. .venv/bin/activate
pip install -r requirements.txt
```

### systemd

В `deploy/systemd/` лежат шаблоны unit-файлов.
Перед использованием проверь пути и пользователя, затем можно установить их так:

```bash
sudo cp deploy/systemd/musicgen-backend.service /etc/systemd/system/
sudo cp deploy/systemd/musicgen-frontend.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now musicgen-backend musicgen-frontend
```

### Caddy

Стартовый конфиг лежит в `deploy/Caddyfile`.
Замени `example.com` на свой домен или hostname и установи конфиг:

```bash
sudo cp deploy/Caddyfile /etc/caddy/Caddyfile
sudo systemctl reload caddy
```

В такой схеме:

- frontend открывается на `/`
- backend проксируется на `/api/*`
- в браузере используется один домен вместо двух отдельных портов

## Ручной запуск для разработки

### Frontend

```bash
cd frontend
npm install
npm run dev
```

### Backend на Linux/macOS

```bash
cd backend
python3 -m venv .venv
. .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

### Backend на Windows

```powershell
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

## Переменные окружения

Для локальной split-схемы frontend/backend скопируй `frontend/.env.local.example` в `frontend/.env.local`.
Если приложение работает за `Caddy` на одном хосте, frontend может использовать относительный `/api` без абсолютного URL.

Пример для локальной разработки:

```env
NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:8000
```

## Идеи для развития

- добавить поддержку большего числа аудиоформатов
- сравнивать несколько версий одной и той же записи в `Robust`-режиме
- добавить визуализацию отпечатка
- позже завернуть приложение в `Tauri`
