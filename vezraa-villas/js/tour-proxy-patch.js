// Routes any hookbot.in virtual tour iframe through our own proxy, which
// strips the SPIM Innovations branding from the tour's loading screen.
// Intercepts the src property setter so it catches every call site
// (data.json-driven, hardcoded literals, etc.) without needing to track
// down each one individually.
(function () {
  const descriptor = Object.getOwnPropertyDescriptor(HTMLIFrameElement.prototype, 'src');
  if (!descriptor || !descriptor.set) return;

  Object.defineProperty(HTMLIFrameElement.prototype, 'src', {
    configurable: true,
    enumerable: descriptor.enumerable,
    get: descriptor.get,
    set: function (value) {
      if (typeof value === 'string' && value.indexOf('hookbot.in/viewer/') !== -1) {
        try {
          const parsed = new URL(value);
          const code = parsed.searchParams.get('code');
          const room = parsed.searchParams.get('room');
          let proxied = '/tourproxy/viewer?code=' + encodeURIComponent(code || '');
          if (room) proxied += '&room=' + encodeURIComponent(room);
          value = proxied;
        } catch (e) { /* malformed URL - fall through unchanged */ }
      }
      descriptor.set.call(this, value);
    },
  });
})();
