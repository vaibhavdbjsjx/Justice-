// Walks the real app through every screen, on simulated phones, iPads, and Macs,
// against the local backend, with no simulator. It fails on any layout overflow,
// framework error, or broken step, and saves a picture of each screen.
//
// Start the local-backend and web-local servers, then:
//   flutter test test_e2e/walkthrough_test.dart \
//     --dart-define-from-file=config/local.json \
//     --dart-define=E2E_OUT=build/e2e
//
// Native iOS is faked here (see FakeNative). Dynamic Island, StoreKit, and the
// system pickers are covered on the simulator and by RunnerTests.
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:lexa_mobile/native/native_bridge.dart';

import 'support.dart';

const iphoneMax = Device('iphone-6.9', Size(440, 956), top: 62, bottom: 34);
const iphoneBase = Device('iphone-6.1', Size(393, 852), top: 59, bottom: 34);
const iphoneSmall = Device('iphone-se', Size(375, 667), top: 20);
const iphoneLargeText = Device('iphone-se-large-text', Size(375, 667), top: 20, textScale: 1.35);
const iphoneDark = Device('iphone-6.1-dark', Size(393, 852), top: 59, bottom: 34, dark: true);
const ipadPortrait = Device('ipad-portrait', Size(1024, 1366), top: 24, bottom: 20, shotScale: 0.7);
const ipadLandscape = Device('ipad-landscape', Size(1366, 1024), top: 24, bottom: 20, shotScale: 0.7);
const ipadSplit = Device('ipad-split', Size(694, 1024), top: 24, bottom: 20, shotScale: 0.8);
const macWindow = Device('mac-window', Size(1180, 820), top: 28, shotScale: 0.75);

void main() {
  final binding = LiveTestWidgetsFlutterBinding.ensureInitialized();
  binding.framePolicy = LiveTestWidgetsFlutterBindingFramePolicy.fullyLive;
  // The test binding answers every HTTP request with a 400 by default. This
  // walkthrough is about the real backend, so it gets the real network.
  HttpOverrides.global = null;

  final native = FakeNative();
  final stack = LocalStack.load();

  setUpAll(() async {
    native.install();
    NativeBridge.instance.init();
    await loadBundledFonts();
    await ensureSupabase();
  });

  void walk(String name, Device device, Future<void> Function(Walker w) body) {
    testWidgets(name, (tester) async {
      native.calls.clear();
      final walker = Walker(tester, device, native);
      await walker.launch();
      Object? failure;
      try {
        await body(walker);
      } catch (error) {
        failure = error;
        debugPrint('FAILED ${device.name}/${walker.screen}: $error');
        try {
          await walker.shot('FAILED-${walker.screen}', settle: 0);
        } catch (_) {}
      }
      await walker.finish();
      if (failure != null) throw failure;
      expect(walker.problems, isEmpty);
    }, timeout: Timeout.none);
  }

  walk('fresh account, start to finish', iphoneMax, (w) => freshJourney(w, stack));

  for (final device in const [
    iphoneMax,
    iphoneBase,
    iphoneSmall,
    iphoneLargeText,
    iphoneDark,
    ipadPortrait,
    ipadLandscape,
    ipadSplit,
    macWindow,
  ]) {
    walk('every screen on ${device.name}', device, (w) => everyScreen(w, stack));
  }

  walk('lawyer role', iphoneBase, (w) => lawyerJourney(w, stack));
  walk('lawyer role on iPad', ipadLandscape, (w) => lawyerJourney(w, stack));
  walk('failures and edge cases', iphoneBase, (w) => failureJourney(w, stack));
}

/// Sign up through to delete account, as a new person would.
Future<void> freshJourney(Walker w, LocalStack stack) async {
  final native = w.native;

  w.step('welcome');
  await w.shot('01-welcome');

  w.step('sign up validation');
  await w.tapKey('auth-submit');
  w.expectThat(find.text('Enter a valid email address.').evaluate().isNotEmpty, 'an email error');
  await w.typeKey('auth-email', 'not-an-email');
  await w.tapKey('auth-submit');
  await w.typeKey('auth-email', uniqueEmail('short'));
  await w.typeKey('auth-password', 'short');
  await w.tapKey('auth-submit');
  w.expectThat(find.text('Use a password of at least 8 characters.').evaluate().isNotEmpty, 'a password error');
  await w.shot('02-signup-errors');

  w.step('sign in screen');
  await w.tapKey('auth-toggle');
  await w.shot('03-signin');
  await w.typeKey('auth-email', 'nobody@lexa.test');
  await w.typeKey('auth-password', 'definitely-wrong-password');
  await w.tapKey('auth-submit');
  await w.until(find.textContaining("doesn't match our records"));
  await w.shot('04-signin-wrong-password');

  w.step('password reset');
  await w.tapText('Forgot password?');
  await w.until(find.text('Reset your password'));
  await w.shot('05-forgot-password');
  await w.tapText('Email me a reset link');
  await w.until(find.textContaining('a reset link is on its way'));
  await w.shot('06-reset-sent');
  await w.dismissSheet();

  w.step('sign up');
  await w.tapKey('auth-toggle');
  final email = uniqueEmail('journey');
  final password = throwawayPassword();
  await w.typeKey('auth-email', email);
  await w.typeKey('auth-password', password);
  await w.tapKey('auth-submit');

  w.step('onboarding: about you');
  await w.until(find.text('Welcome to Lexa'));
  await w.shot('07-onboarding-about');
  await w.typeKey('onboarding-name', 'Jordan Reed');
  await w.tapKey('onboarding-next');

  w.step('onboarding: where you live');
  await w.until(find.text('Where do you live?'));
  await w.wait(600);
  await w.shot('08-onboarding-where');
  await w.tapText('Choose your country');
  await w.shot('09-country-picker');
  await w.pick('United States');
  await w.tapText('Choose');
  await w.pick('California');
  await w.shot('10-onboarding-where-filled');
  await w.tapKey('onboarding-next');

  w.step('onboarding: AI permission');
  await w.until(find.text('Your data and AI'));
  await w.wait(600);
  await w.shot('11-onboarding-consent');
  await w.tapKey('consent-agree');

  w.step('onboarding: reminders');
  await w.until(find.text('Never miss a deadline'));
  await w.wait(600);
  await w.shot('12-onboarding-reminders');
  await w.tapKey('reminders-on');

  w.step('home, new account');
  await w.until(find.textContaining('Hello, Jordan'));
  await w.shot('13-home-new');
  w.expectThat(find.textContaining('free questions left').evaluate().isNotEmpty, 'the usage card');
  w.expectThat(w.state.remindersEnabled, 'reminders on after agreeing to them');
  await w.scrollBy(320);
  await w.shot('14-home-new-scrolled');
  await w.scrollToTop();

  w.step('ask: empty');
  await w.openTab('Ask');
  await w.until(find.text('How can we help?'));
  await w.shot('15-ask-empty');

  w.step('ask: keyboard');
  await w.withKeyboard(() => w.shot('16-ask-keyboard'));

  w.step('ask: send');
  await w.typeKey('chat-input', 'My landlord kept my security deposit. What can I do?');
  await w.shot('17-ask-typed', settle: 200);
  await w.tapFinder(w.pressable('Send'), scroll: false);
  await w.shot('18-ask-thinking', settle: 500);
  await w.until(find.textContaining('21 days'));
  await w.shot('19-ask-streaming', settle: 300);
  await w.until(find.text('SOURCES'));
  await w.shot('20-ask-answer');
  await w.reveal(find.text('SOURCES'));
  await w.shot('21-ask-sources');
  w.expectThat(find.textContaining('Civil Code § 1950.5').evaluate().isNotEmpty, 'the citation in the sources');

  w.step('ask: follow-up while leaving the app');
  await w.typeKey('chat-input', 'Does this apply if I moved out a month ago?');
  await w.tapFinder(w.pressable('Send'), scroll: false);
  await w.wait(300);
  w.tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.inactive);
  w.tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.hidden);
  w.tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.paused);
  await Future<void>.delayed(const Duration(seconds: 6));
  w.tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.hidden);
  w.tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.inactive);
  w.tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.resumed);
  await w.wait(1500);
  final started = native.named('liveActivity.start');
  w.expectThat(started.any((c) => (c.arguments as Map)['kind'] == 'answer'), 'a Live Activity for the answer');
  w.expectThat(native.named('background.begin').isNotEmpty, 'background time while leaving');
  await w.until(w.pressable('Report'), seconds: 30);

  w.step('report an answer');
  await w.tapFinder(w.pressable('Report'));
  await w.until(find.text("What's wrong?"));
  await w.shot('22-report');
  await w.tapText('Wrong jurisdiction');
  await w.tapText('Send report');
  await w.until(find.text('Thanks for telling us'));
  await w.shot('23-report-sent');
  await w.tapText('Done');
  await w.wait(500);

  w.step('matters: empty');
  await w.openTab('Matters');
  await w.until(find.text('Start your first matter'));
  await w.shot('24-matters-empty');

  w.step('matters: new');
  await w.tapFinder(find.text('New matter').last);
  await w.until(find.byKey(const Key('matter-title')));
  await w.shot('25-matter-new');
  await w.tapKey('matter-save');
  w.expectThat(find.text('Give the matter a short title.').evaluate().isNotEmpty, 'a title error');
  await w.typeKey('matter-title', 'Security deposit dispute');
  await w.tapKey('matter-save');

  w.step('matter: conversation');
  await w.until(find.text("Let's work on this matter"));
  await w.shot('26-matter-conversation');
  final composer = find.byKey(const Key('chat-input')).hitTestable();
  w.expectThat(composer.evaluate().isNotEmpty, 'the composer above the tab bar in a matter');

  w.step('matter: deadlines');
  await w.matterTab('Deadlines');
  await w.until(find.text('No deadlines yet'));
  await w.shot('27-deadlines-empty');
  await w.tapKey('deadline-add');
  await w.until(find.byKey(const Key('deadline-title')));
  await w.shot('28-deadline-new');
  await w.tapKey('deadline-save');
  w.expectThat(find.text('Say what is due.').evaluate().isNotEmpty, 'a deadline title error');
  await w.typeKey('deadline-title', 'Send written demand to landlord');
  await w.tapText('Choose a date');
  await w.until(find.byKey(const Key('date-done')));
  await w.shot('29-date-picker');
  await w.tapKey('date-done', scroll: false);
  await w.wait(500);
  await w.tapKey('deadline-save');
  await w.until(find.text('Send written demand to landlord'));
  await w.shot('30-deadlines');
  w.expectThat(find.text('Track live on your Lock Screen').evaluate().isNotEmpty, 'live tracking for a deadline due today');
  await w.tapText('Track live on your Lock Screen');
  w.expectThat(
    native.named('liveActivity.start').any((c) => (c.arguments as Map)['kind'] == 'deadline'),
    'a deadline Live Activity',
  );
  await w.shot('31-deadline-tracking');
  await w.tapText('Stop tracking');
  w.expectThat(
    native.named('notifications.schedule').isNotEmpty || native.named('notifications.cancelAll').isNotEmpty,
    'deadline reminders scheduled',
  );

  w.step('matter: documents');
  await w.matterTab('Documents');
  await w.until(find.text('No documents yet'));
  await w.shot('32-matter-documents-empty');

  w.step('matter: messages');
  await w.matterTab('Messages');
  await w.until(find.text('Work with a lawyer'));
  await w.shot('33-matter-messages-empty');

  w.step('matter: menu');
  await w.press('More', scroll: false);
  await w.until(find.text('Mark as resolved'));
  await w.shot('34-matter-menu');
  await w.tapText('Edit details');
  await w.until(find.text('Edit matter'));
  await w.typeKey('matter-title', 'Deposit dispute with landlord');
  await w.tapKey('matter-save');
  await w.until(find.text('Deposit dispute with landlord'));
  await w.goBack();

  w.step('home: deadline comes up');
  await w.openTab('Home');
  await w.wait(800);
  await w.reveal(find.text('Coming up'));
  await w.shot('35-home-coming-up');
  await w.scrollToTop();

  w.step('free limit: second matter');
  await w.openTab('Matters');
  await w.press('New matter', scroll: false);
  await w.until(find.byKey(const Key('matter-title')));
  await w.typeKey('matter-title', 'Second matter over the free limit');
  await w.tapKey('matter-save');
  await w.until(find.text('See plans'));
  await w.shot('36-matter-limit');

  w.step('paywall from the limit');
  await w.tapText('See plans');
  await w.until(find.byKey(const Key('paywall-subscribe')));
  await w.shot('37-paywall');
  w.expectThat(find.textContaining(r'$9.99').evaluate().isNotEmpty, 'the price');
  w.expectThat(find.byKey(const Key('paywall-restore')).evaluate().isNotEmpty, 'Restore Purchases');
  w.expectThat(find.text('Terms of Use').evaluate().isNotEmpty, 'a Terms of Use link');
  w.expectThat(find.text('Privacy Policy').evaluate().isNotEmpty, 'a Privacy Policy link');

  w.step('paywall: restore with nothing to restore');
  await w.tapKey('paywall-restore');
  await w.until(find.textContaining('No active subscription'));
  await w.shot('38-paywall-nothing-to-restore');

  w.step('paywall: cancel');
  native.purchaseOutcome = 'cancelled';
  await w.tapKey('paywall-subscribe');
  await w.wait(800);
  w.expectThat(find.byKey(const Key('paywall-subscribe')).evaluate().isNotEmpty, 'still on the paywall after cancelling');

  w.step('paywall: pending');
  native.purchaseOutcome = 'pending';
  await w.tapKey('paywall-subscribe');
  await w.until(find.textContaining('waiting for approval'));
  await w.shot('39-paywall-pending');

  w.step('paywall: buy');
  native.purchaseOutcome = 'purchased';
  await w.tapKey('paywall-subscribe');
  await w.untilGone(find.byKey(const Key('paywall-subscribe')));
  await w.wait(500);
  await w.dismissSheet();

  w.step('plan is live');
  final tiers = await stack.sql(
    "select s.tier, s.source from public.subscriptions s join auth.users u on u.id = s.user_id where u.email = \$1",
    [email],
  );
  w.expectThat((tiers.first as Map)['tier'] == 'plus', 'the server to record Plus');
  w.expectThat((tiers.first as Map)['source'] == 'apple', 'the server to record the App Store');
  w.expectThat(w.state.billing?.tier == 'plus', 'the app to show Plus');

  w.step('documents');
  await w.openTab('Documents');
  await w.until(find.text('Your documents and drafts will appear here.'));
  await w.shot('40-documents-new');

  w.step('read a document');
  await w.press('Read a document', scroll: false);
  await w.until(find.text('Choose a file'));
  await w.shot('41-document-source');
  await w.tapText('Choose a file');
  await w.until(find.text('Reading your document'));
  await w.shot('42-analysis-progress', settle: 1500);
  await w.until(find.textContaining('Residential lease agreement'), seconds: 60);
  await w.shot('43-analysis');
  await w.reveal(find.text('Worth a closer look (4)'));
  await w.shot('44-analysis-flags');
  await w.scrollToTop();
  await w.tapFinder(find.text('Show in document').first);
  await w.wait(900);
  w.expectThat(
    find.textContaining(r'$500 is a non-refundable cleaning fee').hitTestable().evaluate().isNotEmpty,
    'Show in document to bring the clause on screen',
  );
  await w.shot('45-analysis-show-in-document');
  await w.reveal(find.text('What each side must do'));
  await w.shot('46-analysis-obligations');
  await w.reveal(find.text('Important dates'));
  await w.shot('47-analysis-dates');
  await w.goBack();
  await w.wait(800);
  w.expectThat(find.text('Lease agreement').evaluate().isNotEmpty, 'the document in the library');
  await w.shot('48-documents-library');

  w.step('draft a letter');
  await w.press('Draft a letter');
  await w.until(find.text('Demand letter'));
  await w.shot('49-draft-templates');
  await w.tapText('Demand letter');
  await w.until(find.byType(TextField));
  await w.shot('50-draft-form');
  await w.tapKey('draft-submit');
  await w.until(find.textContaining('Please fill in'));
  await w.shot('51-draft-form-errors');
  final fields = find.byType(TextField);
  final count = fields.evaluate().length;
  for (var i = 0; i < count; i++) {
    await w.type(find.byType(TextField).at(i), 'Local test answer ${i + 1}');
  }
  await w.tapKey('draft-submit');
  await w.until(find.text('Writing your first draft'));
  await w.shot('52-drafting', settle: 1000);
  await w.until(find.text('Your draft'), seconds: 60);
  await w.shot('53-draft');
  w.expectThat(
    native.named('liveActivity.start').any((c) => (c.arguments as Map)['kind'] == 'drafting'),
    'a Live Activity for the draft',
  );
  w.expectThat(native.named('liveActivity.finish').isNotEmpty, 'the draft Live Activity to finish');
  await w.reveal(find.text('Export PDF'));
  await w.shot('54-draft-export');
  await w.tapText('Export PDF');
  await w.untilNative('share.file');
  w.expectThat(find.textContaining("couldn't be exported").evaluate().isEmpty, 'the export to work');
  w.expectThat(
    (native.named('share.file').last.arguments as Map)['path'].toString().endsWith('.pdf'),
    'a PDF file to be shared',
  );
  await w.wait(600);
  await w.tapText('Export Word');
  await w.untilNative('share.file', count: 2);
  w.expectThat(
    (native.named('share.file').last.arguments as Map)['path'].toString().endsWith('.docx'),
    'a Word file to be shared',
  );
  w.expectThat(w.pressable('Delete').evaluate().isNotEmpty, 'a fresh draft can be deleted');
  await w.goBack();
  await w.wait(500);
  await w.goBack();
  await w.wait(500);
  if (w.pressable('Back').hitTestable().evaluate().isNotEmpty) await w.goBack();

  w.step('find a lawyer');
  await w.openTab('Home');
  await w.press('Find a lawyer');
  await w.until(find.text('Test Lawyer One'));
  await w.shot('55-lawyers');
  await w.tapText('Test Lawyer One');
  await w.until(find.byKey(const Key('lawyer-request')));
  await w.shot('56-lawyer-profile');
  await w.tapKey('lawyer-request');
  await w.until(find.text('Send request'));
  await w.shot('57-lawyer-request');
  await w.type(
    find.descendant(of: find.byType(BottomSheet).last, matching: find.byType(TextField)).last,
    'Hello, I would like help with my deposit.',
  );
  await w.tapText('Send request');
  await w.until(find.text('Request sent'));
  await w.shot('58-lawyer-request-sent');
  await w.tapText('Done');
  await w.wait(400);

  w.step('report and block a lawyer');
  await w.press('More', scroll: false);
  await w.until(find.text('Report this profile'));
  await w.shot('59-lawyer-menu');
  await w.tapText('Report this profile');
  await w.until(find.text('Not a real lawyer'));
  await w.tapText('Send report');
  await w.until(find.text('Thanks for telling us'));
  await w.tapText('Done');
  await w.wait(400);
  await w.press('More', scroll: false);
  await w.tapText('Block');
  await w.until(find.text('Block Test Lawyer One?'));
  await w.shot('60-lawyer-block');
  await w.tapText('Block', scroll: false);
  await w.until(find.text('Find a lawyer'));
  await w.wait(1000);
  await w.tapText('Licensed in California', scroll: false);
  await w.wait(800);
  w.expectThat(find.text('Test Lawyer One').evaluate().isEmpty, 'a blocked lawyer to disappear');
  await w.goBack();

  w.step('matter messages after sharing');
  await w.openTab('Matters');
  await w.tapText('Deposit dispute with landlord');
  await w.matterTab('Messages');
  await w.until(find.textContaining('Hello, I would like help'));
  await w.shot('61-messages');
  await w.withKeyboard(() => w.shot('62-messages-keyboard'));
  await w.goBack();

  w.step('account');
  await w.openTab('Account');
  await w.until(find.text('Lexa Plus'));
  await w.shot('63-account');
  await w.reveal(find.text('Preferences'));
  await w.shot('64-account-preferences');
  await w.reveal(find.text('Delete account'));
  await w.shot('65-account-bottom');

  w.step('edit profile');
  await w.reveal(find.text('Jordan Reed'));
  await w.tapText('Jordan Reed');
  await w.until(find.text('Save changes'));
  await w.shot('66-profile');
  await w.type(find.byType(TextField).first, 'Jordan Q Reed');
  await w.tapText('Save changes');
  await w.until(find.text('Jordan Q Reed'));

  w.step('appearance');
  await w.tapText('Appearance');
  await w.until(find.text('Match system'));
  await w.shot('67-appearance');
  await w.pick('Dark', search: false);
  await w.shot('68-account-dark');
  await w.openTab('Home');
  await w.shot('69-home-dark');
  await w.openTab('Account');
  await w.tapText('Appearance');
  await w.until(find.text('Match system'));
  await w.pick('Match system', search: false);

  w.step('reminders off stays off');
  w.expectThat(w.state.remindersEnabled, 'reminders on before turning them off');
  await w.reveal(find.text('Deadline reminders'));
  final switches = find.byType(Switch);
  await w.tester.tap(switches.first);
  await w.wait(800);
  w.expectThat(!w.state.remindersEnabled, 'reminders off');
  native.calls.clear();
  await w.state.reminders.reschedule();
  w.expectThat(native.named('notifications.schedule').isEmpty, 'no reminders scheduled once switched off');

  w.step('AI permission');
  await w.reveal(find.text('AI data sharing'));
  await w.tapKey('consent-switch');
  await w.until(find.text('Withdraw permission?'));
  await w.shot('70-consent-withdraw');
  await w.tapText('Withdraw', scroll: false);
  await w.wait(1200);
  await w.shot('71-consent-off');
  await w.openTab('Ask');
  await w.typeKey('chat-input', 'Can you help without permission?');
  await w.tapFinder(w.pressable('Send'), scroll: false);
  await w.until(find.text('Before Lexa answers'));
  await w.shot('72-consent-sheet');
  await w.tapText('Not now');
  await w.wait(500);
  w.expectThat(find.textContaining('Can you help without permission?').evaluate().isNotEmpty, 'the unsent text kept');
  await w.openTab('Account');
  await w.reveal(find.text('AI data sharing'));
  await w.tapKey('consent-switch');
  await w.until(find.text('Before Lexa answers'));
  await w.tapText('I agree');
  await w.wait(1000);
  w.expectThat(w.state.hasAiConsent, 'permission given back');

  w.step('sign out');
  await w.tapText('Sign out');
  await w.until(find.text('Sign out?'));
  await w.shot('73-sign-out');
  await w.tapFinder(find.text('Sign out').last, scroll: false);
  await w.until(find.byKey(const Key('auth-email')));
  await w.shot('74-signed-out');

  w.step('sign back in');
  await w.signIn(email, password);
  await w.until(find.textContaining('Hello, Jordan'));
  await w.openTab('Account');
  await w.until(find.text('Lexa Plus'));
  await w.wait(600);

  w.step('delete account');
  await w.reveal(find.byKey(const Key('delete-account')));
  await w.tapKey('delete-account');
  await w.until(find.text('Delete your account?'));
  await w.shot('75-delete-confirm');
  await w.tapFinder(find.text('Delete account').last, scroll: false);
  await w.until(find.text('Your account is deleted'), seconds: 30);
  await w.shot('76-delete-apple-note');
  await w.tapText('Close', scroll: false);
  await w.until(find.byKey(const Key('auth-email')));
  await w.shot('77-deleted');
  final left = await stack.sql('select count(*)::int as n from auth.users where email = \$1', [email]);
  w.expectThat((left.first as Map)['n'] == 0, 'the account to be gone from the server');
  await w.signIn(email, password);
  await w.until(find.textContaining("doesn't match our records"));
  await w.shot('78-deleted-cannot-sign-in');
}

/// Every signed-in screen, with a populated account, for one device.
Future<void> everyScreen(Walker w, LocalStack stack) async {
  await w.signIn(stack.email('demo'), stack.password('demo'));

  w.step('home');
  await w.until(find.textContaining('Hello, Alex'));
  await w.shot('home');
  await w.reveal(find.text('Coming up'));
  await w.shot('home-coming-up');
  await w.reveal(find.text('Recent documents'));
  await w.shot('home-documents');
  await w.scrollToTop();

  w.step('ask');
  await w.openTab('Ask');
  await w.until(find.textContaining('normal wear and tear'));
  await w.shot('ask-history');
  await w.withKeyboard(() => w.shot('ask-keyboard'));

  w.step('matters');
  await w.openTab('Matters');
  await w.until(find.text('Security deposit dispute'));
  await w.shot('matters');

  w.step('matter');
  await w.tapText('Security deposit dispute');
  await w.until(find.text("Let's work on this matter"));
  await w.shot('matter-conversation');
  await w.withKeyboard(() => w.shot('matter-conversation-keyboard'));
  await w.matterTab('Deadlines');
  await w.until(find.text('Send written demand to landlord'));
  await w.shot('matter-deadlines');
  await w.matterTab('Documents');
  await w.until(find.text('Lease agreement'));
  await w.shot('matter-documents');
  await w.tapText('Lease agreement');

  w.step('analysis');
  await w.until(find.text('Residential lease agreement'));
  await w.shot('analysis');
  await w.reveal(find.textContaining('Worth a closer look'));
  await w.shot('analysis-flags');
  await w.goBack();
  await w.goBack();

  w.step('documents');
  await w.openTab('Documents');
  await w.until(find.text('Your library'));
  await w.shot('documents');

  w.step('source sheet');
  await w.press('Read a document', scroll: false);
  await w.until(find.text('Choose a file'));
  await w.shot('document-source');
  await w.dismissSheet();

  w.step('draft');
  await w.press('Draft a letter');
  await w.until(find.text('Demand letter'));
  await w.shot('draft-templates');
  await w.tapText('Demand letter');
  await w.until(find.byType(TextField));
  await w.shot('draft-form');
  await w.withKeyboard(() => w.shot('draft-form-keyboard'));
  await w.goBack();
  await w.goBack();

  w.step('lawyers');
  await w.openTab('Home');
  await w.press('Find a lawyer');
  await w.until(find.text('Test Lawyer One'));
  await w.shot('lawyers');
  await w.tapText('Test Lawyer One');
  await w.until(find.byKey(const Key('lawyer-request')));
  await w.shot('lawyer-profile');
  await w.goBack();
  await w.goBack();

  w.step('new matter sheet');
  await w.openTab('Matters');
  await w.press('New matter', scroll: false);
  await w.until(find.byKey(const Key('matter-title')));
  await w.shot('matter-new-sheet');
  await w.withKeyboard(() => w.shot('matter-new-sheet-keyboard'));
  await w.dismissSheet();

  w.step('paywall');
  await w.openTab('Account');
  await w.until(find.text('Account'));
  await w.shot('account');
  await w.reveal(find.text('Delete account'));
  await w.shot('account-bottom');
  await w.scrollToTop();
}

/// The professional side: research, drafting tools, and client requests.
Future<void> lawyerJourney(Walker w, LocalStack stack) async {
  final native = w.native;
  w.step('sign up as a lawyer');
  if (find.text('Forgot password?').evaluate().isNotEmpty) await w.tapKey('auth-toggle');
  final email = uniqueEmail('lawyer');
  await w.typeKey('auth-email', email);
  await w.typeKey('auth-password', throwawayPassword());
  await w.tapKey('auth-submit');

  w.step('onboarding');
  await w.until(find.text('Welcome to Lexa'));
  await w.typeKey('onboarding-name', 'Dana Whitfield');
  await w.tapText("I'm a legal professional");
  await w.shot('lawyer-onboarding-role');
  await w.tapKey('onboarding-next');
  await w.until(find.text('Where do you live?'));
  await w.wait(600);
  await w.tapText('Choose your country');
  await w.pick('United States');
  await w.tapText('Choose');
  await w.pick('California');
  await w.tapKey('onboarding-next');

  w.step('your practice');
  await w.until(find.text('Your practice'));
  await w.wait(600);
  await w.shot('lawyer-onboarding-practice');
  await w.type(find.byType(TextField).first, 'CA-123456');
  await w.tapFinder(find.text('Employment').first);
  await w.tapText('Continue');

  w.step('consent and reminders');
  await w.until(find.text('Your data and AI'));
  await w.wait(600);
  await w.tapKey('consent-agree');
  await w.until(find.text('Never miss a deadline'));
  await w.wait(600);
  await w.tapKey('reminders-skip');

  w.step('lawyer home');
  await w.until(find.textContaining('Hello, Dana'));
  await w.shot('lawyer-home');

  await stack.sql(
    "update public.subscriptions set tier = 'professional', status = 'active', source = 'apple', renews_at = now() + interval '20 days' where user_id = (select id from auth.users where email = \$1)",
    [email],
  );
  await w.state.refreshBilling();
  await w.wait(500);

  w.step('research');
  await w.openTab('Research');
  await w.until(find.text('Research accelerator'));
  await w.shot('lawyer-research-empty');
  await w.typeKey('chat-input', 'What are the elements of a breach of contract claim?');
  await w.tapFinder(w.pressable('Send'), scroll: false);
  await w.until(w.pressable('Report'), seconds: 60);
  await w.shot('lawyer-research-answer');

  w.step('clients empty');
  await w.openTab('Clients');
  await w.until(find.text('No clients yet'));
  await w.shot('lawyer-clients-empty');

  w.step('client request arrives');
  final ids = await stack.sql(
    """select (select id from auth.users where email = \$1) as lawyer,
              (select id from auth.users where email = 'demo@lexa.test') as client,
              (select id from public.matters where title = 'Unpaid final paycheck' limit 1) as matter""",
    [email],
  );
  final row = ids.first as Map;
  await stack.sql(
    "insert into public.lawyer_client_links (lawyer_id, client_id, matter_id, status) values (\$1, \$2, \$3, 'invited') on conflict do nothing",
    [row['lawyer'], row['client'], row['matter']],
  );
  await w.openTab('Home');
  await w.openTab('Clients');
  await w.scrollToTop();
  // Pull to refresh, the way someone would look for new requests.
  await w.tester.drag(find.text('Clients').first, const Offset(0, 240), warnIfMissed: false);
  await w.until(find.text('New request'), seconds: 20);
  await w.shot('lawyer-client-request');

  w.step('accept');
  await w.tapText('Accept');
  await w.until(find.text('Active'));
  await w.shot('lawyer-client-active');
  await w.tapText('Unpaid final paycheck');

  w.step('client matter');
  await w.until(find.text('File wage claim with the Labor Commissioner'));
  await w.shot('lawyer-client-deadlines');
  await w.matterTab('Documents');
  await w.wait(800);
  await w.shot('lawyer-client-documents');
  await w.matterTab('Messages');
  await w.until(find.text('Write a message…'));
  await w.shot('lawyer-client-messages');
  await w.type(find.byType(TextField).last, 'Thanks for reaching out. I can help with this.');
  await w.press('Send', scroll: false);
  await w.until(find.textContaining('Thanks for reaching out'));
  await w.shot('lawyer-client-messages-sent');
  await w.goBack();

  w.step('professional drafting');
  await w.openTab('Documents');
  await w.until(find.text('Draft a document'));
  await w.shot('lawyer-documents');
  await w.press('Draft a document');
  await w.until(find.text('Professional drafting'));
  await w.shot('lawyer-draft-types');
  await w.tapText('Legal memorandum');
  await w.until(find.textContaining('Instructions'));
  await w.shot('lawyer-draft-form');
  await w.tapText('Draft it');
  await w.until(find.text('Describe what you need drafted.'));
  await w.type(find.byType(TextField).first, 'Memo on the enforceability of a non-compete in California.');
  await w.tapText('Draft it');
  await w.until(find.text('Your draft'), seconds: 60);
  await w.shot('lawyer-draft');
  w.expectThat(native.named('liveActivity.finish').isNotEmpty, 'the Live Activity to finish');
  await w.goBack();
  await w.goBack();
  await w.goBack();

  w.step('lawyer account');
  await w.openTab('Account');
  await w.until(find.text('Lexa Professional'));
  await w.shot('lawyer-account');

  await stack.sql(
    "update public.subscriptions set tier = 'free', status = 'active', source = null, renews_at = null where user_id = (select id from auth.users where email = \$1)",
    [email],
  );
  await stack.sql(
    "delete from public.client_messages where sender_id = (select id from auth.users where email = \$1)",
    [email],
  );
  await stack.sql(
    "delete from public.lawyer_client_links where lawyer_id = (select id from auth.users where email = \$1)",
    [email],
  );
}

/// What happens when things go wrong, and the states most people rarely see.
Future<void> failureJourney(Walker w, LocalStack stack) async {
  final native = w.native;
  await w.signIn(stack.email('free'), stack.password('free'));

  w.step('free home');
  await w.until(find.textContaining('Hello, Sam'));
  await w.shot('free-home');

  w.step('free: document asks for Plus before a file is picked');
  await w.press('Read a document');
  await w.until(find.byKey(const Key('paywall-subscribe')));
  await w.shot('free-document-paywall');

  w.step('paywall when the App Store has nothing');
  await w.goBack();
  await w.wait(500);
  native.offerProducts = false;
  await w.press('Read a document');
  await w.until(find.textContaining("Plans aren't available"));
  await w.shot('paywall-unavailable');
  native.offerProducts = true;
  await w.tapText('Try again');
  await w.until(find.byKey(const Key('paywall-subscribe')));
  await w.goBack();
  await w.wait(500);

  w.step('free: drafts and chat limit');
  await stack.sql(
    """insert into public.chat_messages (matter_id, user_id, role, content, created_at)
       select m.id, m.user_id, 'user', 'filler', now() - interval '10 minutes'
         from (select id, user_id from public.matters where user_id = (select id from auth.users where email = 'free@lexa.test') limit 1) m,
              generate_series(1, 30)""",
  ).catchError((Object _) => <dynamic>[]);
  final matter = await stack.sql(
    "select count(*)::int as n from public.matters where user_id = (select id from auth.users where email = 'free@lexa.test')",
  );
  if ((matter.first as Map)['n'] == 0) {
    await w.openTab('Ask');
    await w.until(find.text('How can we help?'));
    await w.typeKey('chat-input', 'What should I check before signing a contract?');
    await w.tapFinder(w.pressable('Send'), scroll: false);
    await w.until(w.pressable('Report'), seconds: 60);
    await stack.sql(
      """insert into public.chat_messages (matter_id, user_id, role, content, created_at)
         select m.id, m.user_id, 'user', 'filler', now() - interval '10 minutes'
           from (select id, user_id from public.matters where user_id = (select id from auth.users where email = 'free@lexa.test') limit 1) m,
                generate_series(1, 30)""",
    );
  } else {
    await w.openTab('Ask');
    await w.wait(800);
  }
  await w.typeKey('chat-input', 'One more question over the limit');
  await w.tapFinder(w.pressable('Send'), scroll: false);
  await w.until(find.text('See plans'), seconds: 30);
  await w.shot('free-chat-limit');
  await w.reveal(find.text('See plans'));
  await w.shot('free-chat-limit-note');

  w.step('deep links from notifications');
  native.deliver('link.open', {'link': 'lexa://matters/00000000-0000-0000-0000-000000000000'});
  await w.until(find.text("This matter isn't available"));
  await w.shot('link-missing-matter');
  await w.goBack();
  await w.wait(700);
  native.deliver('link.open', {'link': 'lexa://documents/00000000-0000-0000-0000-000000000000'});
  await w.until(find.text("This document isn't available"));
  await w.shot('link-missing-document');
  await w.goBack();
  await w.wait(700);
  native.deliver('link.open', {'link': 'lexa://ask'});
  await w.wait(800);
}
