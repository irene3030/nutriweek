import posthog from 'posthog-js';

const key = import.meta.env.VITE_POSTHOG_KEY;

if (key) {
  posthog.init(key, {
    api_host: 'https://eu.i.posthog.com',
    capture_pageview: false, // we track tab views manually
    autocapture: false,      // only explicit events
    persistence: 'localStorage',
  });
}

/** Call once when the user authenticates. uid should be the Firebase UID. */
export function identify(uid, properties = {}) {
  if (!key) return;
  posthog.identify(uid, properties);
}

/** Call on logout to disassociate subsequent events. */
export function resetIdentity() {
  if (!key) return;
  posthog.reset();
}

/** Track a named event with optional properties. */
export function track(event, properties = {}) {
  if (!key) return;
  posthog.capture(event, properties);
}
