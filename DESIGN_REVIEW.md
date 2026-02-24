# Front-End Design Review: Moodboard

## 1. Bugs & Functional Issues

### 1.1 Weekend rendering is broken (`client/src/App.tsx:211`)
The weekend cell hardcodes `"10/11"` instead of computing the actual dates for Saturday/Sunday. Sunday (day 7) is never rendered — only day 6 is passed to `renderDayCell` in the merged weekend cell at line 342. Any image uploaded to Sunday is invisible in the UI.

### 1.2 Hardcoded `localhost` URLs (`client/src/api.ts:1`, `client/src/components/ImageCard.tsx:65,75,105,116`)
The API base URL and all image `src` attributes are hardcoded to `http://localhost:8000`. This breaks any non-local deployment. The API base should come from an environment variable (`import.meta.env.VITE_API_URL`), and image URLs should be relative or derived from the same config.

### 1.3 Dark mode toggle state is discarded (`client/src/App.tsx:23`)
The `isDarkMode` state setter is destructured as `[, setIsDarkMode]` — the value is never read. Dark mode preference is not persisted to `localStorage`, so it resets on every page refresh. The same applies to the language preference (`client/src/App.tsx:22`).

### 1.4 Upload spinner only appears for the "current" day (`client/src/App.tsx:225`)
The loading indicator checks `dayIndex === (currentDate.getDay() || 7)`, but the upload could target any day cell. If you upload to Tuesday while today is Thursday, no spinner appears. The uploading state should track *which* day is uploading.

### 1.5 Progress bar animation conflict (`client/src/App.tsx:324`)
The progress bar div applies both `animate-pulse` and a custom `animate-[progress_2s_ease-in-out_infinite]` keyframe. These conflict. Additionally, the `@keyframes progress` animation is never defined in `index.css`, so this doesn't do what's intended. The bar also shows `scale-x-0` with no transition to a filled state — it pulses at zero width.

### 1.6 `handleClearWeek` deletes sequentially (`client/src/App.tsx:44-46`)
Images are deleted one at a time in a `for...of` loop with `await`. For a week with many images, this is slow and provides no progress feedback. Should use `Promise.all` or a batch delete endpoint.

---

## 2. Architecture & Code Quality

### 2.1 `App.tsx` is overloaded (359 lines)
The root component handles: week navigation, file upload, drag/drop, paste, dark mode, language toggle, clear week, image grouping, notes height persistence, and rendering all day cells. This should be decomposed:
- Extract a `WeekHeader` component
- Extract a `FloatingActionBar` component
- Extract a `DayCell` component
- Move upload logic to a custom `useUpload` hook
- Move week data fetching to a `useWeekData` hook

### 2.2 No type safety on props (multiple files)
Components use inline prop type definitions (`{ image: BoardImage, onRemoveTag: ... }`) instead of named interfaces. This makes props harder to document and reuse.

### 2.3 API client has no error handling strategy
All API calls throw generic `new Error('Failed to...')` messages. There's no distinction between network errors, 4xx validation errors, and 5xx server errors. The UI never surfaces these to users.

### 2.4 Server: N+1 query problem (`server/src/index.ts:62`)
The `GET /api/weeks/:weekStr` endpoint fetches **all** terminology tags from the entire database (`db.query.terminologyTags.findMany()`) and filters in JavaScript. This will degrade as data grows. Define Drizzle relations or use a proper JOIN/WHERE clause.

---

## 3. UX & Interaction Design

### 3.1 No empty state
When a week has no images, each day column shows only an invisible "Add Image" label that only appears on hover. New users see a nearly blank screen with no guidance. Add a welcoming empty state with instructions.

### 3.2 No drag-over visual feedback
The `hoveredDay` state is tracked (`client/src/App.tsx:21`) but never used for styling. When dragging a file over a day cell, there should be a visible highlight (dashed border, background color change) to indicate it's a valid drop target.

### 3.3 No user-facing error feedback
Every `catch` block in the app calls `console.error`. Users never see toast notifications, inline error messages, or retry prompts.

### 3.4 The Notes area is non-functional (`client/src/components/NotesArea.tsx`)
The "Notes & Terminology Summary" section is resizable but contains only static placeholder text. There's no text input or editing capability. It occupies significant screen real estate with no value. Either implement actual note-taking (with persistence) or remove it.

### 3.5 Delete image has no confirmation
Clicking the trash icon on an image card immediately deletes it. Unlike the "Clear Week" button which has a double-confirm pattern, individual image deletion is instant and irreversible.

### 3.6 Single file upload limitation
Both drag-and-drop and paste return after the first file. Multi-file uploads are silently ignored.

---

## 4. Visual Design & Consistency

### 4.1 Color system is fragmented
The app mixes three color approaches:
- CSS custom properties (`--background`, `--foreground`) in `index.css`
- Hardcoded hex (`#f4f4f4`) in `App.tsx`
- Tailwind color tokens (`stone-*`, `amber-*`, `neutral-*`)

The hardcoded `#f4f4f4` won't respond to the CSS variable system. Consolidate to use a single approach.

### 4.2 Inconsistent dark mode coverage
The day cell sticky header uses `dark:bg-neutral-900`, but the `--background` CSS variable for dark mode is `hsl(24 10% 10%)` which is a different shade. These should reference the same token.

### 4.3 Polaroid tape clips out of bounds
The tape element is positioned at `-top-3`. In tight layouts, it clips into the day header or adjacent cards.

### 4.4 Tags obscure image content
`TerminologyTags` is positioned `absolute top-2 right-2` over the image. Consider placing tags below the image within the polaroid's bottom padding area (the `pb-8` space).

### 4.5 Typography lacks hierarchy definition
The app uses ad-hoc text sizing (`text-[10px]`, `text-[11px]`, `text-xs`, etc.) without a defined type scale.

---

## 5. Accessibility (a11y)

### 5.1 Floating action bar has no labels
All icon-only buttons in the floating action bar lack `aria-label`. Screen readers will announce them as empty buttons.

### 5.2 Close button uses emoji (`client/src/components/ImageCard.tsx:97`)
The fullscreen modal close button uses the text character `✕`. Should be replaced with the Lucide `X` icon and given `aria-label="Close"`.

### 5.3 Low contrast text
`text-stone-400` on `bg-[#f4f4f4]` yields approximately 3.5:1 contrast ratio, failing WCAG AA (4.5:1 required for normal text).

### 5.4 Drag handle has no accessible description
The notes area resize handle is a plain `<div>` with `cursor-ns-resize`. Needs `role="separator"`, `aria-orientation="horizontal"`, and keyboard support.

### 5.5 No focus management in fullscreen modal
When the image modal opens, focus doesn't move into it. Pressing Escape doesn't close it. Focus should be trapped within the modal.

---

## 6. Performance

### 6.1 All images load eagerly
Images within off-screen day columns load immediately. Add `loading="lazy"` to `<img>` elements.

### 6.2 No image optimization
Uploaded images are served at full resolution. For thumbnails (`max-h-48`), consider server-side thumbnail generation or `srcset`.

### 6.3 Framer Motion `layoutId` on every card
Every `ImageCard` uses `layoutId` which triggers layout animation globally. With many cards, this causes layout thrashing.

---

## 7. Responsive Design

### 7.1 Floating action bar overlaps content on mobile
The action bar is `fixed right-8`. On narrow viewports, it overlaps day columns. Should collapse into a bottom bar on mobile.

### 7.2 Notes area consumes excessive mobile space
The default 256px notes height is a large proportion of a mobile viewport.

### 7.3 No touch-specific interactions
The app relies on hover states (tags expand on hover, add image appears on hover, delete shows on hover). On touch devices, these are inaccessible.

---

## 8. Security

### 8.1 No file validation on client or server
No file size limit on uploads. Add `limits: { fileSize: 10 * 1024 * 1024 }` to multer and validate on the client.

### 8.2 CORS is wide open (`server/src/index.ts:15`)
`app.use(cors())` allows requests from any origin. Specify allowed origins in production.

### 8.3 No input sanitization on `weekStr`
The `weekStr` URL parameter is used directly in queries without format validation.

---

## Priority Summary

| Priority | Issue | Impact |
|----------|-------|--------|
| **P0** | Weekend rendering bug (day 7 missing) | Data loss — Sunday images invisible |
| **P0** | Hardcoded localhost URLs | Blocks deployment |
| **P0** | Notes area is non-functional | Dead UI element |
| **P1** | No error feedback to users | Poor UX during failures |
| **P1** | No empty state | Confusing first-use experience |
| **P1** | Accessibility labels missing | Inaccessible to screen readers |
| **P1** | Dark mode / language not persisted | State lost on refresh |
| **P1** | N+1 database query | Performance degrades with data |
| **P2** | No drag-over visual feedback | Unclear drop targets |
| **P2** | Upload spinner on wrong day | Misleading loading state |
| **P2** | Low contrast text | WCAG AA violation |
| **P2** | No file size limits | Security risk |
| **P2** | App.tsx decomposition needed | Maintainability |
| **P3** | Image lazy loading | Performance at scale |
| **P3** | Mobile responsive improvements | Mobile usability |
| **P3** | Tags repositioning | Visual occlusion |
