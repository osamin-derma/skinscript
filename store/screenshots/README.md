# Store screenshots

These are **reference** captures from the iPhone 17 simulator (1206×2622) showing
the key screens, so you can see the layout and order before you make the final ones:

1. `01-home.png` — home / question-bank picker (the hero shot)
2. `02-quiz-setup.png` — quiz options (source, count, mode)
3. `03-question.png` — a question in Tutor mode
4. `04-answer.png` — answered, marked correct
5. `05-explanation.png` — full explanation + AI tutor / flashcard / notes

## Before you upload — two things

**1. The faint watermark.** Signed-in screens tile the logged-in user's email at
9% opacity (an intentional anti-leak feature). For marketing screenshots, sign in
with a **neutral demo account** (e.g. `demo@skinscript.app`) so the watermark isn't
a personal address — or ask me to add a build flag that hides the watermark for
marketing captures.

**2. Exact sizes.** App Store needs specific pixel sizes per device class; these
1206×2622 captures may not match exactly. Re-capture the finals on the required
simulators:
- **App Store** — iPhone 16/17 **Pro Max** (6.9", 1320×2868) and a 6.5" device
  (1242×2688). Use `Cmd+S` in the Simulator, or:
  `xcrun simctl io booted screenshot shot.png`
- **Play** — any phone, ≥1080×1920, 9:16. Also make a **1024×500 feature graphic**.

Tip: a short on-image caption per screenshot ("6 exam banks", "Timed mock exams",
"Spaced repetition") lifts conversion a lot — most listings add these in a simple
design tool.
