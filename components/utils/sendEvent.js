export default function sendEvent(name, params = {}) {
  const windowAny = window;
  if (windowAny.gtag) {
    try {
      // gtag events
      windowAny.gtag("event", name, params);
    } catch (e) {
      console.log("error sending gtag event", e);
    }
  }
}
