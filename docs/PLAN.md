# Vid-Opti — Project Plan

Local Electron desktop app for compressing and resizing phone videos. No editing — upload or drag-and-drop, compress, resize, share.

---

## Goal

A desktop app where you drop phone videos (often large `.mov`/`.mp4`, sometimes 4K HEVC), pick a sharing preset, and get smaller, web-friendly files. Everything runs on your machine. No cloud.

---

## Stack

| Layer | Choice | Why |
|-------|--------|-----|
| Shell | **Electron** | Native file access, drag-and-drop, background processing |
| Scaffold | **electron-vite + React + TypeScript** | Fast dev, hot reload, typed IPC |
| Encoding | **FFmpeg** (bundled via `ffmpeg-static`) | Industry standard; handles phone codecs, rotation, resize |
| IPC | Main process runs FFmpeg; renderer stays sandboxed | Security + stable long-running jobs |
| Settings | `electron-store` | Remember output folder, last preset, etc. |

FFmpeg does the real work. The app is a queue, presets, and progress UI around it.

---

## User Flow

```
Drop or pick videos → Queue with file info → Choose preset → Start batch
    → FFmpeg per file → Progress + ETA → Done — open output folder
```

1. Drag-and-drop or "Add files"
2. See queue: name, size, duration, resolution
3. Pick a preset (or custom)
4. Start — one file at a time (v1)
5. Watch per-file progress
6. Open output folder when finished

---

## Presets (MVP)

Phone videos are usually oversized for Messages, email, and social. Three presets to start:

| Preset | Max resolution | Codec | Target | Use case |
|--------|----------------|-------|--------|----------|
| **Quick share** | 720p | H.264 + AAC | ~2–5 MB/min | iMessage, email |
| **Social** | 1080p | H.264 + AAC | Balanced CRF | Instagram, Discord |
| **Smallest** | 480p | H.264 + AAC | Aggressive compression | When size matters most |

All output as **`.mp4`** for broad compatibility (iPhone HEVC → H.264 transcode).

### FFmpeg parameters

- Video: `-vf scale`, `-c:v libx264`, `-crf`, `-preset medium`
- Audio: `-c:a aac`
- Streaming: `-movflags +faststart`
- Rotation: auto-rotate so portrait phone video stays correct

---

## Architecture

```
┌─────────────────────────────────────┐
│  Renderer (React)                   │
│  - Drop zone, queue, presets        │
│  - Progress UI                      │
└──────────────┬──────────────────────┘
               │ IPC (typed channels)
┌──────────────▼──────────────────────┐
│  Main process                       │
│  - File dialogs, paths              │
│  - ffprobe (metadata)               │
│  - FFmpeg child processes           │
│  - Job queue + cancellation         │
└─────────────────────────────────────┘
```

### Main process

- Read file metadata via `ffprobe`
- Build FFmpeg args from preset
- Stream stderr for progress (`time=`, `speed=`)
- Write to user-chosen output dir (default: sibling file with `_optimized` suffix)
- Cancel running job

### Renderer

- UI only — no direct FFmpeg or filesystem access
- Communicates via typed preload API (`contextBridge`)

---

## MVP Scope

### In scope (v1)

- Drag-and-drop + file picker (`.mp4`, `.mov`, `.m4v`, `.webm`)
- Batch queue with remove/reorder
- 3 presets + custom (resolution + quality slider)
- Per-file and overall progress
- Cancel current job
- "Reveal in Finder" on completion
- App icon + polished UI per design direction below

### Out of scope (later)

- Trim, crop, watermark
- GPU encoding (VideoToolbox on macOS — v1.1)
- Preset export/import
- Watch folder auto-process

---

## Implementation Phases

### Phase 1 — Scaffold

- electron-vite + React + TypeScript
- Basic window with design tokens applied globally
- Typed IPC bridge (preload + contextBridge)
- Empty layout shell matching design direction

### Phase 2 — File intake

- Drop zone + native file picker
- `ffprobe` metadata: duration, resolution, codec, size
- Queue list with remove/reorder

### Phase 3 — FFmpeg pipeline

- Preset → FFmpeg command builder
- Spawn process, parse progress from stderr
- Error handling (corrupt file, unsupported codec)
- Output naming: `original_720p.mp4` or `original_optimized.mp4`

### Phase 4 — Polish

- Settings: default output folder, default preset
- Batch run with summary ("5 files, saved 420 MB")
- macOS app packaging (`electron-builder`)

---

## Decisions

| Topic | Decision |
|-------|----------|
| App folder name | `vid-opti` |
| Display name | VidOpti (TBD) |
| Default output | Sibling file (`video_optimized.mp4`); optional dedicated folder in settings |
| Parallel jobs | 1 at a time for v1 (CPU-heavy, simpler progress) |
| GPU on Mac | `h264_videotoolbox` deferred to v1.1 |

---

## Project Structure

```
vid-opti/
├── docs/
│   └── PLAN.md
├── electron/
│   ├── main.ts              # App lifecycle, IPC handlers
│   ├── preload.ts           # Exposed API
│   └── ffmpeg/
│       ├── probe.ts         # ffprobe wrapper
│       ├── encode.ts        # Job runner + progress
│       └── presets.ts       # Preset definitions
├── src/
│   ├── App.tsx
│   ├── styles/
│   │   ├── tokens.css       # Design tokens
│   │   └── global.css
│   ├── components/
│   │   ├── DropZone.tsx
│   │   ├── QueueList.tsx
│   │   ├── PresetPicker.tsx
│   │   ├── ProgressBar.tsx
│   │   └── Header.tsx
│   └── hooks/
│       └── useEncoder.ts
└── package.json
```

---

## Design Direction

### Overall feel

Standard desktop utility layout — familiar, functional, no novelty for novelty's sake. Think file converter or batch processor: clear hierarchy, obvious actions, dense but readable information.

**Hard edges everywhere.** No rounded corners. Buttons, inputs, cards, drop zones, progress bars, modals — all `border-radius: 0`. Sharp rectangles and straight lines only.

**Dark / black foundation.** Background is fully black or near-black. White and off-white text for primary content. The app should feel like a focused tool, not a marketing site.

**Accent colors used sparingly.** Gold and tech blue are highlights only — never dominant fills across large surfaces.

---

### Color palette

| Token | Value | Usage |
|-------|-------|-------|
| `--bg-primary` | `#000000` | App background |
| `--bg-secondary` | `#0a0a0a` | Panels, sidebar, queue rows |
| `--bg-tertiary` | `#141414` | Hover states, input backgrounds |
| `--border` | `#2a2a2a` | Dividers, card borders, input outlines |
| `--border-focus` | `#3b82f6` | Focused input border (tech blue) |
| `--text-primary` | `#ffffff` | Headings, primary labels |
| `--text-secondary` | `#a3a3a3` | Metadata, file size, duration |
| `--text-muted` | `#666666` | Placeholder text, disabled |
| `--accent-gold` | `#c9a227` | Primary CTA ("Start", "Add files"), active preset |
| `--accent-blue` | `#3b82f6` | Progress bar fill, links, info highlights |
| `--success` | `#22c55e` | Completed job indicator (use minimally) |
| `--error` | `#ef4444` | Failed encode indicator |

Gold = action and selection. Blue = progress and informational emphasis. Everything else stays monochrome.

---

### Typography

- **Font:** System UI stack or a clean grotesque (e.g. `Inter`, `-apple-system`, `Segoe UI`)
- **Headings:** White, medium weight, tight letter-spacing
- **Body / metadata:** Off-white or secondary gray
- **Monospace** for file paths and technical stats (resolution, codec, bitrate)

No decorative fonts. Utility-first.

---

### Layout

Standard three-zone layout:

```
┌──────────────────────────────────────────────────────────┐
│  HEADER — app name, settings gear                        │
├────────────────────────────────────┬─────────────────────┤
│                                    │                     │
│  MAIN — drop zone (empty state)    │  SIDEBAR            │
│         or queue list (populated)  │  - Preset picker    │
│                                    │  - Custom options   │
│                                    │  - Output folder    │
│                                    │  - Start / Cancel   │
│                                    │                     │
├────────────────────────────────────┴─────────────────────┤
│  FOOTER — batch progress bar, status text, file count    │
└──────────────────────────────────────────────────────────┘
```

- **Header:** Fixed height (~48px). App name left, settings icon right. Bottom border only.
- **Main area:** Drop zone when queue is empty; scrollable queue table when files are added.
- **Sidebar:** Fixed width (~280px). Presets, output path, action buttons stacked vertically.
- **Footer:** Visible only during/after processing. Overall progress + status.

On narrow windows, sidebar collapses below main content (single column). Still hard-edged.

---

### Component specs

#### Drop zone (empty state)

- Full main area, dashed `--border` border (1px, square corners)
- Centered icon + "Drop videos here" + "or click to browse"
- On drag-over: border changes to `--accent-blue`, background `--bg-tertiary`
- No fill color change on idle — stays `--bg-primary`

#### Queue list

- Table-like rows: filename | resolution | size | duration | status | remove
- Row height ~40px, `--bg-secondary` background, `--border` bottom border
- Hover: `--bg-tertiary`
- Status icons: pending (muted), processing (blue pulse/bar), done (minimal green check), error (red)

#### Preset picker

- Vertical radio list, hard-edged rectangles
- Unselected: `--bg-secondary` border `--border`
- Selected: `--accent-gold` left border (3px) or gold outline — not full gold fill
- Label + short description per preset

#### Buttons

- **Primary** ("Start encoding"): `--accent-gold` background, black text, no border-radius
- **Secondary** ("Add files", "Cancel"): transparent, `--border` outline, white text
- **Ghost** ("Reveal in Finder"): text only, `--accent-blue` on hover
- All buttons: square, ~36–40px height, uppercase or small-caps optional for primary

#### Progress bar

- Track: `--bg-tertiary`, 4px height, square ends
- Fill: `--accent-blue`
- Percentage label in footer, monospace

#### Inputs

- Square text fields for output path
- `--bg-tertiary` background, `--border` border
- Focus: `--border-focus` (blue) — gold reserved for actions, not focus rings

---

### Interaction principles

1. **Monochrome first** — if unsure, use black/white/gray
2. **Gold = go** — one gold element per view max (the primary action)
3. **Blue = progress** — encoding state only
4. **No shadows** — depth via borders and background steps, not elevation
5. **No animations beyond** progress bar and subtle drag-over border change
6. **No rounded avatars, pills, or chips** — square status badges if needed

---

### CSS global rule

```css
*, *::before, *::after {
  border-radius: 0 !important;
}
```

Apply in `global.css` to enforce hard edges app-wide. Override only if a dependency forces rounding (prefer flat alternatives).

---

## Technical Risks

| Risk | Mitigation |
|------|------------|
| Bundled FFmpeg size (~50–80 MB) | Acceptable for desktop utility |
| HEVC iPhone transcode slow on 4K | Show ETA; GPU encoding in v1.1 |
| Progress accuracy | Parse FFmpeg `time=` vs duration; good enough for MVP |
| macOS file permissions | Standard Electron entitlements |

---

## Roadmap after v1

1. **v1.1** — VideoToolbox GPU encoding on macOS
2. **v1.2** — Custom preset save/load
3. **v1.3** — Watch folder auto-process
4. **v2** — Windows/Linux builds