# Stream design system — Drafting Sheet

Source of truth for Stream's visual language. Tokens live in `src/tokens.css`; component rules in `src/styles.css` follow this file.

## Discovery

- **Artifact:** dense SaaS engineering workspace.
- **Audience:** engineering teams and technical program owners.
- **Positioning:** a precise system of record where agents propose and humans decide.
- **Primary action:** inspect connected engineering context, then launch and review an agent fleet run.
- **Adjectives → visual translation**
  - _precise_ — hairline rules, 2px radius maximum, mono IDs and revisions.
  - _technical_ — drafting grid on the graph plane, condensed uppercase labels.
  - _structured_ — ruled schedules instead of floating cards.
  - _reviewable_ — status always text + shape, never color alone.
  - _quietly confident_ — one cobalt ink accent; no gradients, no glow.
- **Essence:** structured, exact, deliberate.
- **Proposition:** every page reads like a sheet in the program's drawing set.
- **References:** engineering drawing title blocks, Flow's cobalt-on-white product UI, IBM Carbon density.
- **Anti-references:** purple gradient AI dashboards, glassmorphism, pastel icon tiles, soft-shadow card grids.
- **Mode/density:** light only; compact desktop density (13px body).

## Signature move

**The title block.** Each page heading is an inked frame with a drawing title block — _Sheet NN / 07_, _Program_, _Section_ — and the primary action fused into its right edge (`src/title-block.ts`). Nothing else on the page gets a 1px ink frame except modals.

## Typography

| Role                                   | Face                    | Size / weight                       |
| -------------------------------------- | ----------------------- | ----------------------------------- |
| Body / UI                              | IBM Plex Sans Variable  | 13px / 400–600                      |
| Display (h1, modal h2, brand)          | IBM Plex Sans Condensed | 28px / 600, uppercase, +0.01em      |
| Labels (eyebrows, th, stat labels, dt) | IBM Plex Sans Condensed | 11px / 500, uppercase, +0.08em      |
| IDs, revisions, counts, metrics        | IBM Plex Mono           | 11–28px / 400–500, tabular numerals |

Scale: 11, 12, 13, 16, 19, 23, 28 (`--text-xs` … `--text-3xl`). Nothing renders below 11px.

## Color (OKLCH, hex fallback)

| Token             | OKLCH           | Hex     | Use                                    |
| ----------------- | --------------- | ------- | -------------------------------------- |
| `--paper`         | 0.975 0.004 250 | #f5f6f8 | page ground                            |
| `--sheet`         | 0.995 0.002 250 | #fdfdfe | surfaces                               |
| `--surface`       | 0.955 0.006 250 | #eef0f3 | quiet fills                            |
| `--ink`           | 0.24 0.02 260   | #1d2230 | text, frames                           |
| `--muted`         | 0.47 0.015 260  | #5c616d | secondary text (≥5:1 on paper)         |
| `--rule`          | 0.89 0.008 255  | #dcdfe5 | hairlines                              |
| `--rule-strong`   | 0.76 0.012 255  | #b4b9c2 | panel edges, inputs                    |
| `--accent`        | 0.46 0.19 258   | #1f4fc4 | cobalt ink: primary actions, selection |
| `--accent-strong` | 0.38 0.17 258   | #183d9c | hover/pressed                          |
| `--accent-wash`   | 0.955 0.022 258 | #ebf0fb | selected rows, active nav              |
| `--success`       | 0.5 0.11 155    | #2f7a4f | verified / ready only                  |
| `--warning`       | 0.52 0.12 65    | #93611c | needs review                           |
| `--error`         | 0.52 0.19 28    | #b8352a | failures, risks                        |

Cobalt sits at hue 258 (blue, not indigo) by user choice. Green is semantic only, never decoration.

## Space, radius, elevation

- Spacing: 4 · 8 · 12 · 16 · 24 · 32.
- Radius: `0` for frames, panels, nodes, badges; `2px` for buttons and inputs. Dots are square.
- Elevation: none. Separation comes from rules; modals use an ink frame over a 55% ink scrim.

## Layout and components

- Graph plane: 16px minor / 80px major cobalt grid at 6% / 12% alpha; nodes are ruled cards with a mono ID header strip.
- Stats: one ruled schedule row with vertical hairlines.
- Tables: condensed uppercase headers on paper, 10px row padding, hairline rows, accent-wash hover.
- Badges: square, outlined in their own color, uppercase condensed; warning uses a diamond marker.
- Nav: active item = accent wash + hairline top/bottom, bold accent text.

## States

Hover darkens edges to ink; selected = accent edge + 1px accent ring; focus = 2px accent outline, 2px offset, on every interactive element; disabled keeps existing opacity rules; running uses the accent with a pulse that stops under reduced motion.

## Motion

Tokens live at the end of `src/styles.css`: `--motion-instant` 90ms (press), `--motion-fast` 140ms (hover, exits, tabs), `--motion-base` 180ms (small overlays, state colour), `--motion-slow` 220ms (panels, pages, sidebar). Enters use `--ease-out` (`cubic-bezier(0.23, 1, 0.32, 1)`), exits `--ease-in` at about 75% of the enter duration, morphs `--ease-in-out`. Animate only opacity, translate, scale, rotate and colours (sidebar width and `<details>` are the exceptions); never `transition: all`.

Entrances use `@starting-style`. Overlays that close on the same page (inspector, modal/palette, toast) stay mounted with `data-state="closing"`/`"leaving"` until `Dom.waitForAnimationSettled` reports the exit is done (`withExitMotion` in `src/main.ts`). Page switches, the twin scenario load, the bulk bar, approval removal and inspector node swaps use View Transitions chosen by `motionTransition` in `src/main.ts`; `view-transition-name`s are scoped to their transition type. `prefers-reduced-motion: reduce` removes all movement and keeps fades at 90ms or less.

## Slop audit (2026-10-03)

- [x] No Inter/system primary face.
- [x] No gradients, glass, blobs, or soft shadows.
- [x] No pastel icon tiles; agent and node icons are ink on paper.
- [x] Single accent; semantic colors only for status.
- [x] Status is text + shape.
- [x] Slogan headlines replaced with sheet titles and factual subtitles.
- [ ] Seed agent taglines ("No surprises.") still read like marketing copy; they're workspace data, left unchanged.
- [ ] No dark mode.

## Changelog

- 2026-10-03 — Drafting Sheet adopted. Replaced Inter with IBM Plex, mint palette with cobalt ink, card grid with ruled structure; added title-block headings.
