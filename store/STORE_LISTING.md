# SkinScript — App Store & Play Store listing pack

Everything you paste into **App Store Connect** and **Google Play Console** for
the first submission. Review the **[ ] decisions** marked below before you submit.

---

## 1. Identity & basics

| Field | Value |
|---|---|
| App name | **SkinScript** |
| Subtitle (App Store, ≤30 chars) | **Dermatology board prep** |
| Short description (Play, ≤80) | **Dermatology board-exam prep: 12,000+ MCQs, mock exams, spaced repetition.** |
| Bundle / Application ID | `co.osamah.skinscript` |
| Primary category | **Medical** |
| Secondary category | **Education** |
| Price | **Free** (invite-only; access code required to register) |
| Support URL | `https://osamah.co` |
| Marketing URL | `https://osamah.co` |
| Privacy Policy URL | `https://osamah.co/privacy.html` *(publish the policy first — see PRIVACY_POLICY.md)* |
| Developer / Seller name | **[ ] Dr. Osama Al Rawi** (confirm the exact legal/seller name) |
| Support email | **[ ] add a monitored email** (stores require one; WhatsApp alone isn't accepted) |
| **[ ] Age rating** | Suggest **17+ / "Mature"** — the app contains frequent/intense medical and treatment information. (12+ is arguable; 17+ is the safe choice for clinical imagery.) |
| **[ ] iPad support** | The app runs universal; decide whether to list iPad screenshots too. |

## 2. Promotional text (App Store, ≤170 chars — editable without review)

> Pass your dermatology boards with 12,000+ verified MCQs across six exam banks,
> timed mock exams, spaced repetition, and a clinical-image atlas.

## 3. Description (App Store & Play — full description, ≤4000 chars)

> **SkinScript — dermatology board preparation, done right.**
>
> SkinScript is a focused question bank for dermatology residents and board
> candidates. Practice with **12,723 verified multiple-choice questions** drawn
> from six respected sources, all organised by subtopic so you can target your
> weak areas and walk into the exam prepared.
>
> **Six question banks in one app**
> • Arab Board • Board Vitals • Makki • ETAS 2026 • DSE (Al-Niaimi) • ABD (American Board of Dermatology)
>
> **Study the way that works for you**
> • Tutor mode — see the answer and a full explanation after every question
> • Timed mode — simulate real exam pressure, with pause and resume
> • Review mode — browse questions and answers freely
> • Full mock exams — 120 questions, scored, 2 hours
> • Spot-diagnosis drills on clinical images
> • Practice by subtopic (37 dermatology topics)
>
> **Learn faster, remember longer**
> • Spaced-repetition scheduling brings questions back right before you forget
> • Mistakes notebook — tag why you missed a question and review them together
> • Flashcards you build from any question
> • Ask an AI tutor to explain any question in more depth
> • Highlighter and personal notes on every question
> • A clinical-image atlas with 2,000+ photos
>
> **Built for real studying**
> • Your progress, flags, notes and history sync across devices
> • Works offline once installed — download all images for no-connection study
> • Daily study reminders to keep your streak alive
> • Dark mode
> • Reopen and retake any past exam
>
> SkinScript is **invite-only** — you'll need an access code from Dr. Osama Al
> Rawi to register.
>
> _For educational use only. SkinScript is a study tool and does not provide
> medical advice or clinical decision-making. Always rely on primary sources and
> qualified supervision for patient care._

## 4. Keywords (App Store only, ≤100 chars, comma-separated, no spaces)

```
dermatology,derm,board,exam,MCQ,question bank,residency,skin,boards,arab board,ABD,quiz,medical
```

## 5. "What's New" (version 1.0 release notes)

> First release of SkinScript — 12,000+ dermatology board questions across six
> banks, timed mock exams, spaced repetition, a clinical-image atlas, offline
> study and cross-device sync.

## 6. Graphics you must provide

| Asset | Where | Spec |
|---|---|---|
| App icon | both | 1024×1024 PNG, no alpha (already generated from `assets/logo.png`) |
| iPhone screenshots | App Store | 6.9" (1320×2868 or 1290×2796) **and** 6.5" (1242×2688) — min 1, up to 10. Capture on an iPhone 16/17 Pro Max simulator. |
| iPad screenshots | App Store | only if you list iPad: 13" (2064×2752) |
| Phone screenshots | Play | min 2, 1080×1920 or higher, 9:16 |
| Feature graphic | Play | **1024×500 PNG/JPG, required** (a simple branded banner — logo + "Dermatology Board Prep") |

Reference screenshots captured from the simulator are in `store/screenshots/`.
Re-capture the final ones on the exact required device sizes before uploading.

---

## 7. App Store — App Privacy ("nutrition label")

Answer **"Yes, we collect data"**, **not used for tracking**, and link each type
to the user's identity. The app's backend is Supabase; there are no ad or
analytics SDKs.

| Data type | Collected | Linked to user | Purpose | Used for tracking |
|---|---|---|---|---|
| Email address | Yes | Yes | App Functionality (account) | No |
| Phone number | Yes (optional SMS sign-in) | Yes | App Functionality (account) | No |
| Name (username / display name) | Yes | Yes | App Functionality | No |
| User ID | Yes | Yes | App Functionality | No |
| Product Interaction (quiz answers, progress, history) | Yes | Yes | App Functionality | No |
| Other User Content (notes, highlights, flashcards, feedback) | Yes | Yes | App Functionality | No |
| Device ID / User Agent (only if reminders enabled on web) | Yes | Yes | App Functionality | No |

No location, contacts, health records, financial info, browsing history, or
advertising data is collected.

## 8. Google Play — Data Safety form

- **Does your app collect or share user data?** Yes, collects. **No data shared** with third parties.
- **Is all data encrypted in transit?** Yes (HTTPS/TLS).
- **Can users request data deletion?** Yes — in-app "Reset all progress" plus account deletion on request via support. (Provide a deletion URL/instructions.)
- Data types to declare:
  - **Personal info:** Email address, Phone number (optional), User IDs, Name.
  - **App activity:** In-app actions / product interaction (quiz progress & history), other user-generated content (notes, flashcards).
  - **App info & performance:** none (no crash/analytics SDK) unless you add one.
  - Each: collected, linked to the user, purpose = **App functionality / Account management**, **not** for advertising, optional where it is (phone).

---

## 9. Submission checklist

### Apple App Store
- [ ] Apple Developer Program active ($99/yr)
- [ ] Publish the privacy policy at the Privacy Policy URL
- [ ] In Xcode: set a real **Team** (Signing & Capabilities), confirm `MARKETING_VERSION` (1.0) and build number
- [ ] Add the **Push Notifications**/background capability only if you add remote push later (local reminders need none)
- [ ] Archive → upload to App Store Connect (Xcode → Product → Archive)
- [ ] App Store Connect: create the app record (bundle id `co.osamah.skinscript`), paste listing copy, upload screenshots, complete App Privacy
- [ ] Because it's **invite-only**, add a working **demo access code + test account** in "App Review Information" so the reviewer can get in (Apple rejects apps they can't sign into)
- [ ] Submit for review

### Google Play
- [ ] Google Play Developer account ($25 one-time)
- [ ] Build a **signed App Bundle (.aab)** (Android Studio → Build → Generate Signed Bundle) — not the debug APK
- [ ] Set up Play App Signing
- [ ] Play Console: create the app, paste listing copy, upload screenshots + **feature graphic**, complete Data Safety + content rating questionnaire
- [ ] Provide reviewer a demo access code + test login
- [ ] Start with **Internal testing**, then Closed/Open, then Production

### Both
- [ ] Confirm the **17+ / Mature** age rating via each store's questionnaire
- [ ] Decide final support email and seller name (the two **[ ]** items in §1)
