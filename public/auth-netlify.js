/* auth-netlify.js — Netlify Identity glue (no CORS, uses widget’s GoTrue) */
(function () {
  // Wait for the widget to load (it bundles GoTrue and exposes a client)
  function waitForIdentity(timeoutMs = 8000) {
    return new Promise((resolve, reject) => {
      const start = Date.now();
      const tick = () => {
        if (window.netlifyIdentity && (netlifyIdentity.gotrue || netlifyIdentity._goTrue || netlifyIdentity.api)) {
          resolve(netlifyIdentity);
        } else if (Date.now() - start > timeoutMs) {
          reject(new Error("Netlify Identity widget not available"));
        } else {
          setTimeout(tick, 50);
        }
      };
      tick();
    });
  }

  async function boot() {
    let id;
    try {
      id = await waitForIdentity();
    } catch (e) {
      console.error("[NF] Netlify Identity widget failed to load.", e);
      return;
    }

    // The widget exposes a GoTrue client; different versions name it slightly differently.
    const auth =
      id.gotrue                 // common
      || id._goTrue             // older internal
      || id.api                 // newer API handle
      || (window.GoTrue ? new window.GoTrue({ APIUrl: "/.netlify/identity", setCookie: true }) : null);

    if (!auth) {
      console.error("[NF] GoTrue client not found on the widget.");
      return;
    }

    const STORAGE_KEY = "nf_auth_event";
    function broadcast(type) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ type, t: Date.now() }));
        setTimeout(() => localStorage.removeItem(STORAGE_KEY), 50);
      } catch {}
    }
    window.addEventListener("storage", (e) => {
      if (e.key !== STORAGE_KEY || !e.newValue) return;
      location.reload();
    });

    function samePath(a, b) {
      try {
        const ua = new URL(a, location.origin);
        const ub = new URL(b, location.origin);
        return ua.pathname === ub.pathname && ua.search === ub.search;
      } catch { return false; }
    }

    async function getUserSafe() {
      try {
        const u = auth.currentUser ? auth.currentUser() : id.currentUser();
        if (!u) return null;
        if (u.jwt) await u.jwt(); // refresh token if needed
        return u;
      } catch {
        return null;
      }
    }

    async function requireAuth(redirectTo = "/") {
      const u = await getUserSafe();
      if (u) return u;
      const target = (typeof redirectTo === "string" && redirectTo) || "/";
      if (!samePath(location.pathname + location.search, target)) {
        const next = encodeURIComponent(location.pathname + location.search + location.hash);
        location.replace(`${target}?next=${next}`);
      }
      return null;
    }

    async function signOut(to = "/") {
      try {
        const u = auth.currentUser ? auth.currentUser() : id.currentUser();
        if (u && u.logout) await u.logout();       // GoTrue user API
        else if (id.logout) await id.logout();     // widget API
      } catch {}
      broadcast("logout");
      location.replace(to);
    }

    // Programmatic login/signup via GoTrue client bundled in the widget
    async function signIn(email, password, remember) {
      const user = await auth.login(email, password, remember);
      broadcast("login");
      return user;
    }
    async function signUp(email, password) {
      const user = await auth.signup(email, password);
      broadcast("signup");
      return user;
    }

    // Expose the same NF surface your app expects
    window.NF = {
      auth,           // the gotrue client
      getUserSafe,
      requireAuth,
      signOut,
      signIn,
      signUp
    };

    // Optional: keep widget in sync (not required for your forms)
    try { id.init && id.init(); } catch {}
    window.dispatchEvent(new Event("nf-ready"));
  }

  boot();
})();
