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

### Android JDK (important)

The Android Gradle build (Gradle 8.14) needs **JDK 17–21**. Android Studio's
*bundled* JDK on this Mac is **Java 25**, which Gradle rejects
(`Unsupported class file major version 69`). A **JDK 21** is installed via
Homebrew at:

```
/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home
```

- **Android Studio:** Settings → Build, Execution, Deployment → Build Tools →
  Gradle → **Gradle JDK** → point it at that JDK 21 (or "Download JDK… 21").
- **Command line:** `export JAVA_HOME=/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home`
  before `./gradlew` (the `cap:android` npm script assumes the IDE/JDK is set).

Both platforms have been built and run successfully: the iOS app launches in the
iPhone simulator, and Android produces `app/build/outputs/apk/debug/app-debug.apk`.

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

## Auth deep-linking (implemented)

Supabase email links (confirm sign-up, reset password, change email) now return
into the native app via the custom URL scheme **`co.osamah.skinscript://auth-callback`**.

- Scheme registered in `ios/App/App/Info.plist` (`CFBundleURLTypes`) and
  `android/app/src/main/AndroidManifest.xml` (a `VIEW` intent-filter).
- `src/lib/deeplink.js` listens for `appUrlOpen` (and the cold-start launch URL)
  and completes the Supabase session from the link (implicit tokens or PKCE
  `code`). `src/lib/auth.js` sends the deep link as the redirect target on native
  (`Capacitor.isNativePlatform()`); the web app still uses its origin, unchanged.
- Verified on the iOS simulator: the scheme routes into the app.

**You must add the redirect URL in Supabase (one time):**
Dashboard → project `yssrtjfgkctojkzcoapt` → **Authentication → URL Configuration
→ Redirect URLs** → add:

```
co.osamah.skinscript://auth-callback
```

Without it, Supabase rejects the native redirect and the email link won't return
into the app. (Email+password and SMS OTP sign-in work regardless.)

## Still to do (next steps, not blocking the build)

1. **Native push notifications** — replace web-push (`src/lib/push.js`) with
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
