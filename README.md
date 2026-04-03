# MusicGen

Don't want to install a password manager?  
Store passwords in a notebook?  
Worry about encrypting a password before sending it to a friend in a messenger?

Then send your friend a piece of audio instead: a favorite song, a voice message, or even two minutes of your cat meowing.

Feel like James Bond.  
Generate a password from your favorite track.  
Keep your passwords like a playlist.

MusicGen turns audio into a deterministic password based on its acoustic fingerprint. The same suitable audio fragment can produce the same password when used with the same generation mode.

## Important

This project should not be used for truly critical secrets such as banking, primary email accounts, crypto wallets, master passwords, or other high-risk authentication scenarios.

The reason is simple: if someone uses the same audio fragment with the same mode, they can get the same password. MusicGen is best treated as an unusual tool, a creative way to exchange passwords, or a demonstration of the idea, not as a replacement for a mature secret-management solution.

## What the app can do

- Generate a password from audio using an acoustic fingerprint.
- Support `WAV` and `MP3`.
- Offer two generation modes:
  - `Exact` for maximum repeatability with the same audio.
  - `Robust` for a more tolerant response to similar versions of the same recording.
- Preview the uploaded audio.
- Show a live music-style visualization during playback.

## App variants

### Web version

The web version consists of a frontend and a server:

- `frontend/` — UI built with `Next.js`, `React`, and `TypeScript`
- `backend/` — API and audio-analysis logic built with `FastAPI` and `Python`

This version is a good fit if you want to run the project locally, explore the interface, and experiment with audio-based password generation.

### Desktop version

The repository also contains a separate standalone version in `desktop/`.

It:

- works fully offline
- does not require a server
- does not require internet access
- can be built as a Windows `portable` package

This version is a good fit if you want MusicGen as a separate local application.

## Technologies

- Frontend: `Next.js 15`, `React 19`, `TypeScript`
- Backend: `FastAPI`, `Python`
- Desktop: `Electron`
- Audio analysis: deterministic normalization, spectral features, deterministic password mapping

## How to run it

### Web version on Windows

1. Open the project folder.
2. Run [start_prod.cmd](d:/projects/MusicGen/start_prod.cmd).
3. Open `http://127.0.0.1:3000` in your browser.

Stop:

1. Run [stop_prod.cmd](d:/projects/MusicGen/stop_prod.cmd).

### Web version on Linux

1. Make the scripts executable:

```bash
chmod +x start_prod.sh stop_prod.sh scripts/*.sh
```

2. Start the app:

```bash
./start_prod.sh
```

3. Open:

```text
http://127.0.0.1:3000
```

Stop:

```bash
./stop_prod.sh
```

### Desktop version

If the desktop build is already prepared, run:

[MusicGen-Portable-0.1.0.exe](d:/projects/MusicGen/desktop/dist/MusicGen-Portable-0.1.0.exe)

If you want to build it yourself, the technical steps are documented here:

[TECHNICAL.md](d:/projects/MusicGen/TECHNICAL.md)

## How it works

1. You upload an audio file.
2. The app brings the audio into a more stable form for analysis.
3. An acoustic fingerprint is extracted from the sound.
4. That fingerprint is transformed into a deterministic password.
5. If you use the same file with the same mode, the result aims to stay reproducible.

## Screenshots

### Home screen

![MusicGen home screen](docs/screenshots/home-main.png)

The main web screen with the logo, language switcher, and the core idea of the app.

### Mode selection and audio upload

![Mode selection and audio upload](docs/screenshots/upload-and-mode.png)

The upload panel, fingerprint mode switcher, and the main entry point for generating a password from audio.

### Audio size and duration limits

![Audio size and duration limits](docs/screenshots/generated-password.png)

If the uploaded file exceeds the allowed limits, MusicGen offers to trim it before analysis or choose another file.

### Generated password and playback visualization

![Generated password and playback visualization](docs/screenshots/audio-visualizer.png)

The result panel with the generated password, generation mode, algorithm, quick actions such as show, hide, and copy, and a neon visualization inspired by old-school media players during playback.

### Desktop version

![MusicGen desktop version](docs/screenshots/desktop-version.png)

The standalone offline version of the app that can be launched separately from the web stack and built as a portable package.

## For developers

The full technical guide covering project structure, build steps, startup flow, Linux deployment, and desktop packaging is available here:

[TECHNICAL.md](d:/projects/MusicGen/TECHNICAL.md)
