# MusicGen

Don't want to install a password manager?  
Don't want to keep passwords in a notebook?  
Don't want to overthink how to encrypt a password before sending it to a friend?

Send a piece of audio instead: a favorite song, a voice message, or even two minutes of your cat meowing.

Feel a little like James Bond.  
Generate a password from sound.  
Keep your passwords like a playlist.

MusicGen turns audio into a deterministic password built from its acoustic fingerprint.

## Important warning

MusicGen is a creative tool, not a serious replacement for a mature security workflow.

Do **not** use it for:

- banking
- primary email accounts
- crypto wallets
- password-manager master passwords
- anything where a repeated password would become a real incident

The main caveat is simple: if someone uses the same audio fragment with the same generation mode, they can reproduce the same password.

## What the app does

- Generates deterministic passwords from `WAV` and `MP3` audio.
- Supports two fingerprint modes: `Exact` and `Robust`.
- Lets the user preview uploaded audio before generation.
- Trims oversized uploads in the browser before they are sent to the server.
- Offers an offline desktop build that works without internet access.

## App variants

### Web version

The web version is split into two parts:

- `frontend/` - `Next.js`, `React`, `TypeScript`
- `backend/` - `FastAPI`, `Python`, deterministic audio processing

This version is the canonical one for repeatable cross-device results, because the password is generated on the server with one shared pipeline.

### Desktop version

The repository also includes a standalone desktop app in [desktop/](d:/projects/MusicGen/desktop).

It:

- works offline
- does not need the web server
- does not need internet access
- can be packaged as a Windows portable build

## Technology stack

- Frontend: `Next.js 15`, `React 19`, `TypeScript`
- Backend: `FastAPI`, `Python`
- Desktop: `Electron`
- Audio pipeline: deterministic normalization, exact PCM hashing, robust spectral hashing

## How a regular user can run it

### Web version on Windows

1. Open the project folder.
2. Run [start_prod.cmd](d:/projects/MusicGen/start_prod.cmd).
3. Open `http://127.0.0.1:3000` in a browser.

To stop it, run [stop_prod.cmd](d:/projects/MusicGen/stop_prod.cmd).

### Web version on Linux

1. Make the scripts executable:

```bash
chmod +x start_prod.sh stop_prod.sh scripts/*.sh
```

2. Start the app:

```bash
./start_prod.sh
```

3. Open `http://127.0.0.1:3000`.

To stop it:

```bash
./stop_prod.sh
```

### Desktop version

If you already have the build, run the portable executable from [desktop/dist](d:/projects/MusicGen/desktop/dist).

If you want the build and packaging steps, use the full [technical guide](d:/projects/MusicGen/TECHNICAL.md).

## How it works

1. Upload or choose an audio file.
2. MusicGen normalizes the signal into a stable analysis format.
3. The app extracts an acoustic fingerprint.
4. The fingerprint is hashed into a deterministic password.
5. The same suitable input with the same mode is expected to produce the same result.

## Screenshots

### Home screen

![MusicGen home screen](docs/screenshots/home-main.png)

The main English web screen with the logo, language switcher, and the core layout.

### Mode selection and audio upload

![Mode selection and audio upload](docs/screenshots/upload-and-mode.png)

The upload panel, fingerprint mode switcher, and the main entry point for password generation.

### Audio size and duration limits

![Audio size and duration limits](docs/screenshots/audio-limits-modal.png)

If the uploaded file exceeds the configured limits, MusicGen offers to trim it before upload or choose another file.

### Generated password

![Generated password](docs/screenshots/generated-password.png)

The result panel with the generated password, mode, algorithm, and quick actions such as show, hide, and copy after an English-language run.

### Playback visualization

![Playback visualization](docs/screenshots/audio-visualizer.png)

The neon playback visualizer reacting to the uploaded audio during playback.

### Desktop version

![MusicGen desktop version](docs/screenshots/desktop-version.png)

The standalone offline desktop build in English with the same visual style as the web app.

## For developers

The full setup, deployment, testing, and packaging instructions live in the [technical guide](d:/projects/MusicGen/TECHNICAL.md).
