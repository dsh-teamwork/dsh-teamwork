---
name: teamwork-slides
description: Plan and write a presentation with its speaker notes, as an HTML deck the team can open, present and share as a Teamwork page, and export to PDF or an editable PowerPoint file. Use for any slide deck, presentation, pitch, report-out or talk.
---

# Teamwork slides

A deck is two files in a folder of its own:

- `index.html`, copied unchanged from `template/index.html` in this skill's directory. It draws the
  slides, presents them (arrow keys, `F` full screen, `N` speaker notes, `O` overview), prints them to
  PDF (one slide a page, or each slide above its notes) and exports an editable PowerPoint file.
- `deck.js`, which you write: `window.DECK = { ... }`, the content of every slide. You never write
  HTML or CSS; each layout is designed already and fits text itself.

`template/deck.js` is a complete example of every layout. Read it before writing your first deck.

## How to work

1. **Brief.** Find out, in one round of questions at most: who the audience is, what they should
   decide or do afterwards, how long the talk is, whether it is presented live or read alone, and the
   language. Take what the person already said; ask only for what is missing and matters.
2. **Storyline.** Put the conclusion first, then the reasons that support it, then what to do next.
   Allow about one slide for every one to two minutes of a talk. Write the outline as a numbered list:
   for each slide its layout and its title, written as the takeaway sentence ("Retention grew because
   onboarding got shorter", not "Retention"). Show it and ask once for changes.
3. **Write `deck.js`.** Create a folder for the deck in the workspace (a short lowercase name, such as
   `q3-review`), copy `template/index.html` into it, and write `deck.js` beside it. Pictures go in
   the same folder and are named relatively (`"image": "chart.png"`).
   Everything you need is in this file and `template/deck.js`; do not read `index.html` to learn how
   the deck works.
4. **Write the speaker notes.** Every slide gets `notes`: what the speaker says, in full sentences,
   in the deck's language, sized to the time the slide gets (about 150 words or 300 Chinese
   characters a minute). Notes carry the detail the slide leaves out; the slide never repeats them.
5. **Check it** with Node: `node "<this skill's directory>/check.mjs" <deck folder>`. It prints the
   problems as JSON (a layout that would cut content off, too many or too long bullets, a missing
   note, a mistake in `deck.js`); `[]` means none. Fix them in `deck.js` and run it again. **Publish
   only once it prints `[]`**, and run it again after every change: a `deck.js` that does not run shows
   the person an empty deck. Do not
   open the deck in a browser yourself: the page shrinks text that is a little long and shows what
   still does not fit in its toolbar.
6. **Publish** the folder with `teamwork_page` (`action: "create"`, `kind: "html"`, the deck's title,
   `directory` the deck folder). Give the person the link it returns. For a change, edit `deck.js`
   and publish again with `action: "update"`, the page id and the version you published last as
   `baseVersion`, and a one-line `note` saying what changed.
7. **Hand over.** The page makes the PDFs and the PowerPoint file for the person; do not make them
   yourself, and do not render or screenshot the deck. Say how to use it: open the link; `F` presents full screen, `N` shows the notes;
   the toolbar's **PDF** and **Notes PDF** save PDFs, and **PPTX** saves an editable PowerPoint
   file. A **⚠** in the toolbar lists problems the deck found in itself (a slide too full, missing
   notes); ask the person to tell you what it says if they see one. The page is private until they
   share it from the page's **Share** in the console.

Without `teamwork_page` (no team, or not signed in), the folder still works: the person opens
`index.html` in a browser.

## deck.js

```js
window.DECK = {
  title: "Deck title",          // also the PowerPoint file name, unless file is given
  lang: "zh-CN",                // "zh-CN" or "en": fonts, toolbar language
  theme: "ocean",               // ink, ocean, forest, coral, plum or graphite
  colors: { accent: "E0735A" }, // optional overrides: dark, primary, accent, light, surface, text, muted, soft
  footer: "Shown at the bottom of content slides", // defaults to the title; "" for none
  author: "Who made it",
  slides: [ /* one object per slide, each with a layout */ ]
};
```

Every slide takes `notes`. The layouts, and what each holds:

| layout | fields | limits |
| --- | --- | --- |
| `cover` | `kicker` (a short label above the title), `title`, `subtitle`, `meta` (presenter, date) | title ≤ 2 lines |
| `agenda` | `title`, `items`: strings | 3–6 items |
| `section` | `kicker` (such as `"01"`), `title`, `subtitle` | opens a part of the talk |
| `bullets` | `title`, `bullets`: strings or `{ text, sub: [strings] }`; optional `aside: { value, label }`, a big number beside them | ≤ 5 bullets, ≤ 6 lines with subs |
| `two-column` | `title`, `left` and `right`: `{ heading, bullets }` | ≤ 5 bullets a column |
| `stats` | `title`, `stats`: `{ value, label, note }`; optional `takeaway` (a source line) | 2–4 stats; value ≤ 7 characters |
| `chart` | `title`, `chart: { type, categories, series: [{ name, values }], unit, title }`; optional `takeaway`, `note` beside it | type `bar`, `line`, `pie` or `doughnut`; ≤ 8 categories; ≤ 3 series; a pie takes one series |
| `process` | `title`, `steps`: `{ title, text }` | 3–5 steps |
| `table` | `title`, `columns`, `rows` (arrays of strings); optional `highlight`: a column index | ≤ 5 columns, ≤ 8 rows |
| `image` | `title`, `image` (a file in the deck folder), `bullets`, `caption`; `fit: "cover"` to fill | png, jpg, svg or webp |
| `quote` | `quote`, `by` | ≤ 3 lines |
| `closing` | `title` (the ask or the conclusion), `subtitle`, `contact` | |

`unit: "%"` writes values as percentages; another unit is appended (`"min"`); numbers are plain
numbers, never strings with units. A line chart's axis starts near its lowest value, so a change is
visible; a bar chart's starts at zero.

## Rules that make a deck good

- **One message a slide, and the title says it.** A reader who reads only the titles gets the
  argument. No full stop at the end of a title. Keep titles under about 20 Chinese characters or
  60 Latin characters.
- **Show, then say.** Each content slide carries one visual: a number (`stats`, `aside`), a chart,
  steps, a table or a picture. Vary layouts; never three `bullets` slides in a row.
- **Few words on the slide.** A live talk: three bullets, each one line. A deck read alone: up to five,
  each under two lines. Detail goes in the notes. When a slide is full, split it.
- **Numbers are real.** Use only figures the person gave you or you found with a source; put the
  source in a `takeaway`, `note` or the notes. Mark anything you estimated as an estimate.
- **Start and end on the point.** The cover's title is the conclusion; the closing slide is the
  decision or action wanted, never "Thank you" alone.
- **Pick the theme for the subject**, not by default: ocean or graphite for business and technical
  reviews, forest for sustainability and operations, coral or plum for marketing, people and culture,
  ink for anything formal. Change `accent` only to a company's brand colour.
- **Speaker notes are a script**, not a summary: open with the sentence that leads into the slide,
  explain what the visual shows, and end with the bridge to the next slide.
