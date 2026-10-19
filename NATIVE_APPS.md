# SkinScript — native apps (iOS & Android) via Capacitor

The web app (Vite + React) is wrapped with [Capacitor](https://capacitorjs.com)
to ship as native **iOS** and **Android** apps. The same `dist/` web build runs
inside a native shell — no separate codebase.

- **App name:** SkinScript
- **Bundle id / App id:** `co.osamah.skinscript`
  (permanent once submitted to the stores — change it in `capacitor.config.json`
  **before** the first submission if you want a different one)
- **Web build dir:** `dist` (Capacitor copies this into the native apps)
- **Native projects:** `android/` and `ios/` (committed; generated build
  artifacts and the copied web assets are git-ignored)

## One-time prerequisites

| Target | Needs | Cost |
|---|---|---|
| **Android** | [Android Studio](https://developer.android.com/studio) (SDK + JDK) | free; Google Play Developer account **$25 one-time** |
| **iOS** | **Xcode** (full app from the Mac App Store) on this Mac | free; Apple Developer Program **$99/year** |

Capacitor 8 uses **Swift Package Manager** for iOS, so CocoaPods is **not**
required.

## Everyday workflow

After any change to the web app, rebuild and copy it into the native shells:

```bash
npm run cap:sync
```

Then open a platform to run/build it:

```bash
npm run cap:android   # builds web, syncs, opens Android Studio
npm run cap:ios       # builds web, syncs, opens Xcode
```

In Android Studio / Xcode: pick a simulator or a connected device and press Run.
To publish: Android → build a signed **App Bundle (.aab)** for Play Console;
iOS → **Archive** in Xcode and upload to App Store Connect.

### App icons & splash

Source logo: `assets/logo.png` (1024×1024). Regenerate all icon/splash sizes:

```bash
npm run cap:assets
```

## Still to do (next steps, not blocking the build)

1. **Auth deep-linking** — Supabase email-confirmation and any OAuth redirects
   need a custom URL scheme so the link returns into the app. Email+password
   and SMS OTP sign-in already work without this.
2. **Native push notifications** — replace web-push (`src/lib/push.js`) with
   `@capacitor/push-notifications` for study reminders on iOS/Android, wired to
   the existing reminders backend.
3. **Service worker** — the PWA service worker auto-registers on the web and on
   Android (`http://localhost`); on iOS WKWebView it simply doesn't register.
   Verify on-device behavior; if the native shell ever serves stale content,
   skip SW registration when `Capacitor.isNativePlatform()` is true. The web
   build at osamah.co is unaffected either way.
4. **Store assets** — screenshots, descriptions, privacy policy, and an
   App Store privacy nutrition label / Play data-safety form.

## Note

The web deploy (GitHub Pages → osamah.co) is unchanged. `android/` and `ios/`
live alongside the web app and are not part of the Pages build.
