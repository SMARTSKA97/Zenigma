# Publishing on Google Play

Zenigma is built to ship as an APK from GitHub Releases today. This is what is ready for Google Play and what is still for you to do in the Play Console.

## What is ready

- **App Bundle**: every Android release (`android-v*` tag) now also builds a signed `.aab` and attaches it to the GitHub release next to the APK. If the bundle step ever fails, the APK still ships.
- **Privacy policy**: in the app (Settings, About, Privacy policy) and on the web at `/privacy`.
- **Account deletion**: Account, Delete my account (inside the app). Play also asks for a web page for this: link `/privacy` and say deletion is in Account.
- **Offline-first**: nothing needs an account; guests can play everything except the dailies.

## Before the first upload (Play Console)

1. **App signing**: use Play App Signing. Upload the first `.aab` (signed with the upload key you already have). Keep the keystore and its passwords backed up with `PUZZLE_SEED`.
2. **The in-app APK updater switches itself off in a Play install (done).** Play forbids an app updating itself outside Play. The updater is in `core/updater.service.ts`; hide the Settings update row when the app was installed from Play (the installer package is `com.android.vending`).
3. **Content rating**: answer the questionnaire as a puzzle game with no violence, no user-generated chat and no gambling. Expect "Everyone".
4. **Target audience**: 13+ (the profile asks for an age group from 18 up; it is optional).
5. **Ads**: declare "No ads" (the app has none).

## Data safety form (answers)

Data is encrypted in transit (HTTPS). People can ask for deletion from inside the app.

| Data | Collected | Shared | Why | Optional |
| --- | --- | --- | --- | --- |
| Email address | Yes, with an account | No | Account management | Yes (guests have none) |
| Name (display name) | Yes, with an account | No | Shown on leaderboards | Yes |
| Age group and gender | Yes, only if chosen | No | Mind skill comparisons | Yes |
| App activity (game results, streaks, hints) | Yes, with an account | No | App functionality | Yes |
| Device or other IDs (a random app-generated device id) | Yes, with an account | No | Keep one daily attempt per device | Yes |
| Crash logs (error text and screen name, no id) | Yes, unless turned off in Settings | No | Diagnostics | Yes |
| Location, contacts, photos, files, microphone, camera | No | n/a | n/a | n/a |
| Advertising ID | No | n/a | n/a | n/a |

Google sign-in (web today) only receives the Google email and name the person approves.

## Store listing checklist

- App name, short description (80 characters), full description (use `docs/` and the README).
- Icon 512×512, feature graphic 1024×500, at least 2 phone screenshots (take them from the app in light and dark).
- Contact email and a privacy policy URL (`/privacy` on the web app).
- A closed test (Play requires testers for new personal accounts) before production.
