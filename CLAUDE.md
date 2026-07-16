# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

This is a [Remotion](https://www.remotion.dev) project — videos are authored as React components and rendered
programmatically (to MP4/WebM/GIF/still images) instead of being edited in a timeline-based NLE. The React tree is
the source of truth for every frame; Remotion re-renders the composition at each frame number and captures it.

Scaffolded with `npx create-video@latest --blank`.

## Commands

```console
npm i                # install dependencies
npm run dev           # open Remotion Studio (live preview + timeline scrubber) at localhost
npx remotion render   # render the default composition to out/<id>.mp4
npx remotion render <composition-id> out/name.mp4   # render a specific composition to a specific path
npx remotion still <composition-id> out/name.png     # render a single frame as a still image
npm run lint           # eslint src && tsc — run before considering a change done
npm run build           # remotion bundle — produces a deployable Webpack bundle
npx remotion upgrade    # bump all @remotion/* + remotion packages to the latest matching version together
```

There are no automated tests configured. Verifying a change means opening the Studio (`npm run dev`) and/or
rendering the composition, then checking the output visually — `npm run lint` only catches type/lint errors, not
whether the video looks right.

## Architecture

- `src/index.ts` — entry point, calls `registerRoot(RemotionRoot)`. Don't add logic here.
- `src/Root.tsx` — the `RemotionRoot` component. Every composition/video the project can render must be registered
  here via a `<Composition>` (or `<Still>`/`<Folder>`) element. Remotion Studio and the render CLI only ever see
  compositions declared in this tree.
- `src/Composition.tsx` — an example composition (`MyComp`, id `"MyComp"`). Add new compositions as sibling files
  and register each one in `Root.tsx`.
- `src/index.css` — global styles; Tailwind is enabled here (`@remotion/tailwind-v4`, wired in `remotion.config.ts`).
- `public/` — static assets (images, fonts, audio/video clips) referenced with Remotion's `staticFile()` helper, not
  relative import paths.
- `remotion.config.ts` — Studio/render-time config (image format, webpack overrides, output overwrite behavior).
  **Not** read by the Node.js rendering APIs (`@remotion/renderer`) — those take options as direct function
  arguments instead.

## Working with compositions

- Every `<Composition>` needs `id`, `component`, `durationInFrames`, `fps`, `width`, `height`. Use
  `calculateMetadata` (async, runs before render) instead of hardcoded props when duration/dimensions depend on
  input props or fetched data.
- Animate using Remotion's frame-based hooks — `useCurrentFrame()`, `useVideoConfig()`, and helpers like
  `interpolate()` / `spring()` from the `remotion` package — never `setTimeout`, CSS transitions, or wall-clock time.
  Rendering happens frame-by-frame out of real-time order, so anything time-based must be a pure function of the
  frame number.
- Pass per-render variables (title text, a data source, colors) as `<Composition>` `defaultProps`, and override them
  at render time with `--props` (CLI) or `inputProps` (Node.js API) rather than hardcoding.

## Conventions

- TypeScript strict mode is on (`tsconfig.json`); `noUnusedLocals` is enabled — don't leave unused variables.
- ESLint uses `@remotion/eslint-config-flat`; Prettier config is in `.prettierrc`. Run `npm run lint` after edits.
- Keep `src/index.ts` and `src/Root.tsx` minimal — registration only, no rendering logic.
