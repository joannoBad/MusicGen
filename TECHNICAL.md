# MusicGen Technical Guide

## О проекте

MusicGen генерирует пароль из акустического отпечатка аудиозаписи.

В проекте есть два режима генерации:

- `Exact`: детерминированная генерация пароля для одного и того же нормализованного аудио.
- `Robust`: более устойчивый спектральный отпечаток, который старается сохранять близость для похожих версий одной записи.

## Стек

- Frontend: `Next.js 15`, `React 19`, `TypeScript`
- Backend: `FastAPI`, `Python`
- Desktop: `Electron`
- DSP-подход: детерминированная нормализация, извлечение спектральных признаков, маппинг в пароль

## Структура репозитория

```text
frontend/        UI на Next.js
backend/         FastAPI API и логика аудио-отпечатков
desktop/         Автономный desktop-вариант на Electron без интернета
scripts/         Скрипты запуска для разработки и production-like режима
deploy/          Дополнительные конфиги для Linux-развёртывания
deploy/systemd/  Шаблоны systemd unit-файлов
```

## Desktop-версия

В папке `desktop/` лежит отдельная автономная Electron-версия.

Она:

- не использует `frontend/` и `backend/` во время работы
- не требует локального сервера
- не требует интернета
- может собираться в portable-формат для Windows

Запуск:

```powershell
cd desktop
npm install
Remove-Item Env:ELECTRON_RUN_AS_NODE -ErrorAction SilentlyContinue
npm start
```

Сборка portable:

```powershell
cd desktop
npm install
Remove-Item Env:ELECTRON_RUN_AS_NODE -ErrorAction SilentlyContinue
npm run build:portable
```

Готовый portable-файл после сборки:

```text
desktop/dist/MusicGen-Portable-0.1.0.exe
```

## Текущее состояние

- Backend поддерживает `WAV` и `MP3`.
- Для декодирования `MP3` используется `ffmpeg`.
- Генерация пароля остаётся детерминированной, если на вход попадает одно и то же нормализованное аудио.
- Frontend умеет работать за reverse proxy и по умолчанию может использовать `/api/*` на том же хосте.

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

Один раз сделайте скрипты исполняемыми:

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

Рекомендуемый стек:

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
Перед использованием проверьте пути и пользователя, затем установите их так:

```bash
sudo cp deploy/systemd/musicgen-backend.service /etc/systemd/system/
sudo cp deploy/systemd/musicgen-frontend.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now musicgen-backend musicgen-frontend
```

### Caddy

Стартовый конфиг лежит в `deploy/Caddyfile`.
Замените `example.com` на свой домен или hostname и установите конфиг:

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

Для локальной split-схемы frontend/backend скопируйте `frontend/.env.local.example` в `frontend/.env.local`.
Если приложение работает за `Caddy` на одном хосте, frontend может использовать относительный `/api` без абсолютного URL.

Пример для локальной разработки:

```env
NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:8000
```
