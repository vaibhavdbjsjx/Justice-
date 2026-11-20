# Handoff: App Store setup for Lexa

Read this first in a new session. Keep replies to the owner short.

## State (2026-11-19)
- App Store Connect app created: "Lexa: Legal Help & Documents", Apple ID 6836626027 (set APPLE_APP_ID on Netlify), SKU LEXA-IOS-001.
- Flutter iOS app `apps/mobile`, bundle `com.vaibhavsg.lexa` (+ `.liveactivity`), team LNL8GARN23, version 1.0.0 (1).
- Release archive built: `apps/mobile/build/ios/archive/Runner.xcarchive`. Upload failed only because no Apple ID is signed in to Xcode (Settings › Accounts).
- All tests pass (walkthrough 13/13 in `apps/mobile/test_e2e`, API 59, RLS 62, unit 23). Nothing committed yet (owner hasn't asked).
- Free Gemini key on purpose (`GEMINI_PAID_TIER` unset): app discloses Google data use; App Store availability must exclude EU/EEA, UK, Switzerland.
- Listing text and review notes: `APP_STORE_LISTING.md`. Owner steps: `APPLE_LAUNCH.md`.
- 6.9" screenshots (real, with Dynamic Island): `store-screenshots/iphone-6.9/` (home, ask, document, matter). iPad 13" screenshots still needed (iPad Pro 13-inch M5 simulator, 2064×2752). Apple rule: real app screens showing value, no login/onboarding/welcome.
- Mac is 8 GB: run one simulator at a time; the Mac crashed once under load.

## Done in App Store Connect (2026-11-19)
- Listing, App Info, age rating 4+, privacy labels, server notification URLs.
- Availability: 143 regions (no EU/EEA, UK, Switzerland, China mainland).
- Subscriptions in group "Lexa" (22594631), all with names, prices, 143 regions, review screenshot + notes:
  Professional Monthly $39.99 (6836630204), Professional Yearly $349.99 (6836631543),
  Plus Monthly $9.99 (6836632247), Plus Yearly $79.99 (6836633141).
- Yearly support added in code (apple-products.ts, app-config, models, store_service, paywall toggle, Lexa.storekit, tests).
- Build 1.0.0 (1) uploaded and attached to version 1.0.
- Screenshots: iPhone 6.3" (`store-screenshots/iphone-6.3`), iPad 13" (`store-screenshots/ipad-13`), header (`store-screenshots/header`), paywall review shots (`store-screenshots/review`, from `test/paywall_screenshot_test.dart`).
- Still needed from the owner: demo account (email + password) and App Review contact (name, phone, email). Then "Add for Review" on the version and on the subscription group, and Submit (confirm first).

## Owner's request (do it end to end in their Chrome + Xcode)
1. App Store Connect: create the app record (name, SKU, bundle ID), category Reference/Productivity, privacy labels (email, name, user content, purchase history; linked, no tracking), age rating questionnaire, availability without EU/EEA/UK/CH.
2. Subscriptions, group "Lexa", monthly and yearly:
   - Plus: $9.99/mo, $79.99/yr
   - Professional: $39.99/mo, $349.99/yr

   App code expects `com.vaibhavsg.lexa.plus.monthly` and `com.vaibhavsg.lexa.professional.monthly`. Add yearly IDs (`.plus.yearly`, `.professional.yearly`) to `apps/web/src/lib/billing/apple-products.ts`, the app-config, `ios/Lexa.storekit`, and the paywall (monthly/yearly toggle) before using them.
3. Upload screenshots, description, keywords, support/privacy URLs, review notes, demo account.
4. Sign in to Xcode, upload the archive, attach it plus the subscriptions, then submit. Confirm with the owner before the final Submit.

Don't type passwords. The owner signs in to Apple and creates the demo account password.
