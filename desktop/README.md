# MusicGen Desktop

Десктопный вариант MusicGen теперь полностью автономный.

Он:

- не зависит от `frontend/` и `backend/`
- не требует локального сервера
- не требует интернета для работы
- может собираться в `portable`-формат для Windows

## Что внутри

- `main.cjs` — основной процесс Electron
- `preload.cjs` — безопасный preload
- `index.html` — локальный интерфейс
- `renderer.js` — локальная обработка аудио и генерация пароля
- `styles.css` — стили desktop-интерфейса
- `build/icon.ico` — иконка для portable-сборки

## Запуск в разработке

```bash
cd desktop
npm install
npm start
```

## Сборка portable для Windows

```bash
cd desktop
npm install
npm run build:portable
```

После этого `electron-builder` соберет portable-исполняемый файл.

Если перед этим в среде выставлена переменная `ELECTRON_RUN_AS_NODE=1`, очисти её:

```powershell
Remove-Item Env:ELECTRON_RUN_AS_NODE -ErrorAction SilentlyContinue
```

## Почему этот вариант офлайн

- интерфейс загружается из локального `index.html`
- пароль считается локально в `renderer.js`
- аудио не отправляется на сервер
- сеть для работы не нужна
