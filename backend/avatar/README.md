# Talking-Head Avatar (optional)

SMART AI lessons render as an **animated digital board with a human-sounding
narrator** out of the box — no setup required. This folder is only for the
*optional* lip-synced presenter that appears in the bottom-left corner of the
video.

It's off by default (`AVATAR_ENABLED=false`). When off, or if any step below
is incomplete, the pipeline automatically produces a board-only video — nothing
breaks.

> **Reality check.** This uses the open-source **Wav2Lip** model running
> locally. On a machine **with an NVIDIA GPU** it's reasonably quick. On
> **CPU-only** it works but is *slow* (several minutes of render per minute of
> narration). That trade-off is the price of a free, no-API avatar.

---

## What you need

- **⚠️ Python 3.10 specifically.** Not 3.11, 3.12, or 3.13. Wav2Lip's
  dependencies are from 2020 and fail to build on newer Python (you'll see
  `NameError: name 'CCompiler' is not defined` building numpy on 3.13, or
  similar). Install Python 3.10 from https://www.python.org/downloads/release/python-31011/
  alongside whatever you already have — you don't need to uninstall 3.13.
- ~2 GB disk for PyTorch + model weights
- A **presenter face**: any portrait photo (front-facing, well-lit) or a short
  face video. Use a royalty-free portrait or your own.

## One-time setup (Wav2Lip)

```powershell
# 1. Clone Wav2Lip somewhere outside this repo
git clone https://github.com/Rudrabha/Wav2Lip.git C:\tools\Wav2Lip
cd C:\tools\Wav2Lip

# 2. Create the venv WITH PYTHON 3.10 (the `py -3.10` launcher picks the right one)
py -3.10 -m venv .venv
.venv\Scripts\activate
#    Confirm it says 3.10.x:
python --version

# 3. Install dependencies — do NOT use the repo's requirements.txt (its pinned
#    numpy/librosa are too old to build). Install compatible versions directly:
python -m pip install --upgrade pip wheel
pip install numpy==1.23.5 librosa==0.9.2 opencv-contrib-python tqdm numba scipy
# CPU-only PyTorch (skip if you have a working CUDA setup):
pip install torch torchvision torchaudio

#    Sanity check — this must print "ok":
python -c "import torch, librosa, cv2, numpy; print('ok')"

# 4. Download the two checkpoints:
#    - Face detection:  s3fd.pth      -> face_detection/detection/sfd/s3fd.pth
#    - Lip-sync model:  wav2lip_gan.pth -> checkpoints/wav2lip_gan.pth
#    Links are in the Wav2Lip repo README (Google Drive / mirror hosts).
```

> If you'd rather not fight the environment, **Easy-Wav2Lip**
> (https://github.com/anothermartz/Easy-Wav2Lip) automates all of the above
> with an installer. It builds the same `C:\tools\Wav2Lip` layout with
> `inference.py` + `checkpoints/`, which is exactly what SMART AI points at.

## Point SMART AI at it

Set these in `backend/.env`:

```ini
AVATAR_ENABLED=true
AVATAR_ENGINE=wav2lip
PYTHON_BIN=C:/tools/Wav2Lip/.venv/Scripts/python.exe
AVATAR_REPO_DIR=C:/tools/Wav2Lip
WAV2LIP_CHECKPOINT=checkpoints/wav2lip_gan.pth
AVATAR_FACE_IMAGE=C:/tools/Wav2Lip/presenter.jpg
AVATAR_TIMEOUT_MIN=25
```

Restart the backend. On the next lesson, the video stage extracts the
narration, runs Wav2Lip against your face image, and composites the talking
head into the board video. `hasAvatar: true` on the lesson confirms it worked.

## Verifying your setup

```bash
node backend/avatar/check-setup.mjs
```

This prints exactly which prerequisite (Python, repo, checkpoint, face image)
is missing, without generating a lesson.

## SadTalker instead (higher quality, heavier)

Set `AVATAR_ENGINE=sadtalker`, point `AVATAR_REPO_DIR` at a cloned
[SadTalker](https://github.com/OpenTalker/SadTalker) repo, and `AVATAR_FACE_IMAGE`
at a portrait. The service calls SadTalker's `inference.py` and picks up its
generated mp4. SadTalker needs more VRAM and is slower, but produces natural
head motion.

## Windows path note (handled automatically)

Wav2Lip builds its internal ffmpeg command as an unquoted string, so a **space
in any path** (like `C:\Persnal Project\...`) silently breaks the output. SMART
AI works around this by staging the audio, face image and output inside a
space-free scratch folder in the repo (`smartai_stage/`) and copying the result
back. It also injects the bundled `ffmpeg-static` onto PATH so Wav2Lip's final
mux step finds ffmpeg without a system install. You don't need to do anything —
just keep the Wav2Lip repo itself at a space-free path like `C:\tools\Wav2Lip`.

## How the pipeline uses it

1. The board video is built first, with the full narration audio.
2. That exact audio is extracted to 16 kHz mono WAV.
3. Wav2Lip/SadTalker lip-syncs your face image to that audio → `presenter.mp4`
   (same length as the board video, so it stays in sync throughout).
4. FFmpeg overlays the presenter as a bordered card in the bottom-left — the
   zone the board renderer deliberately keeps clear.

If any step fails, the lesson still ships as a board-only video and the failure
is logged, never surfaced as a hard error.
