# Lexa: App Store launch checklist

What the code already handles, and the steps only the account owner can take.
The listing copy and review notes are in `APP_STORE_LISTING.md`.

## The app

| | |
|---|---|
| App | Flutter, `apps/mobile` (native iOS screens, not a web wrapper) |
| Bundle ID | `com.vaibhavsg.lexa` |
| Live Activity extension | `com.vaibhavsg.lexa.liveactivity` |
| Team | `LNL8GARN23` |
| Version | 1.0.0 (1) |
| Minimum iOS | 17.0 |
| Devices | iPhone, iPad, and Apple silicon Macs ("Designed for iPad") |
| Backend | `https://lexa-main.netlify.app` and Supabase. Only the public anon key is in the app. |

Build for the App Store:

```bash
cd apps/mobile
flutter build ipa --release --dart-define-from-file=config/production.json
```

Then open `build/ios/archive/Runner.xcarchive` in Xcode (Window > Organizer) and
choose Distribute App > App Store Connect > Upload.

## Handled in the app

- **In-App Purchase (3.1.1, 3.1.2).** StoreKit 2. The server verifies every
  signed transaction against Apple's root certificate before unlocking a plan.
  Restore Purchases is on the paywall and in Account. The paywall shows price,
  period, auto-renewal terms, and links to the Terms of Use and Privacy Policy.
- **Account deletion (5.1.1(v)).** Account > Delete account. It deletes all
  data and cancels any web (Stripe) plan. If an App Store subscription exists,
  the app says that Apple bills it separately and opens Manage Subscriptions.
- **Third-party AI (5.1.2(i)).** Before anything goes to the AI provider, the
  app names the provider and what is sent, and asks for permission. It can be
  withdrawn in Account, and the server enforces it too.
- **Reporting and blocking (1.2).** Every AI answer, analysis, and draft has a
  Report action. Lawyer profiles can be reported and blocked.
- **Legal positioning.** Every AI output carries the "information, not legal
  advice" notice. High-stakes questions add a nudge to see a lawyer.
- **Privacy manifest.** `ios/Runner/PrivacyInfo.xcprivacy`: no tracking. It
  declares email, name, user content, and purchase history, all for app
  functionality.
- **Live Activities and notifications.** Document reading, drafting, and answers
  in progress show in the Dynamic Island and on the Lock Screen. Deadlines can
  be tracked live on the day they are due. Reminders are time-sensitive local
  notifications, only after the person turns them on.
- **Sign-in.** Email and password only. No third-party or social sign-in exists
  in the app or on the web, so Guideline 4.8 doesn't apply.

## Owner steps, in order

1. **Database.** In Supabase > SQL Editor, run
   `supabase/migrations/20261105090000_app_store_launch.sql`. It is safe to run
   more than once. `supabase/SETUP.sql` now includes it for new projects.
2. **AI key.** A free Gemini key is fine to start. Set `GEMINI_API_KEY` on
   Netlify. Two conditions come with the free tier, and the app already handles
   the first:
   - Google may use what's sent and people at Google may read it. The privacy
     policy and consent screens say so, and ask users to leave out sensitive
     details.
   - It can't serve people in the EU/EEA, UK, or Switzerland. In App Store
     Connect › Pricing and Availability, untick those countries.
   When you move to a paid key, also set `GEMINI_PAID_TIER=true` and the
   free-tier notice disappears. To check answer quality any time, run
   `npm run eval:answers` in `supabase/tests` (see the file for settings).

3. **Netlify environment.**
   - `NEXT_PUBLIC_APP_URL=https://lexa-main.netlify.app`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `APPLE_APP_ID`: the numeric Apple ID from the app's App Store Connect page.
     Production purchases can't be verified without it.
   - Support, privacy, and legal email addresses, which must be real mailboxes.
     Redeploy after changing any of these.
4. **Supabase Auth.**
   - Set the Site URL to `https://lexa-main.netlify.app`.
   - Add these redirect URLs: `https://lexa-main.netlify.app/reset-password`
     and `https://lexa-main.netlify.app/auth/callback`.

5. **App Store Connect: subscriptions.** Create a subscription group named
   **Lexa** with four auto-renewable subscriptions:

   | Reference name | Product ID | Duration | Price | Level |
   |---|---|---|---|---|
   | Lexa Professional Monthly | `com.vaibhavsg.lexa.professional.monthly` | 1 month | $39.99 | 1 (highest) |
   | Lexa Professional Yearly | `com.vaibhavsg.lexa.professional.yearly` | 1 year | $349.99 | 2 |
   | Lexa Plus Monthly | `com.vaibhavsg.lexa.plus.monthly` | 1 month | $9.99 | 3 |
   | Lexa Plus Yearly | `com.vaibhavsg.lexa.plus.yearly` | 1 year | $79.99 | 4 |

   For each subscription, add a display name, a description, and a review
   screenshot of the paywall. Attach all four subscriptions to the version you
   submit.
6. **App Store Server Notifications (V2).** Use
   `https://lexa-main.netlify.app/api/billing/apple/notifications` for both
   Production and Sandbox.
7. **Listing.** Paste the text from `APP_STORE_LISTING.md`. Fill in the privacy
   labels to match the privacy manifest: email, name, user content, and
   purchases, all linked to the person, none used for tracking. Answer the age
   rating questionnaire honestly. Set availability to the countries you want to
   launch in.
8. **Demo account.** Create a real account on production, finish onboarding,
   and put the email and password in the App Review notes. Reviewers test
   purchases in the sandbox, so no paid plan is needed.
9. **Upload and submit.** Upload the build (see above), choose it for the
   version, and submit.

## Risks to know about

- **Guideline 5.1.1(ix).** Apps in highly regulated fields should be submitted
  by a legal entity, not an individual. Lexa gives legal information, not
  advice, and says so throughout, which is the strongest position available.
  An organization account is the safest long-term setup.
- **Gemini terms.** Google's terms say not to rely on the service for legal
  advice. Lexa's framing (information, sources, and pointers to licensed
  lawyers) is consistent with that. Have a lawyer review the Terms and Privacy
  Policy before launch.
- **Checks that need a real device.** Camera scanning,
  sandbox purchases with a sandbox Apple account, and Live Activities on a
  physical iPhone.
