/* auth-netlify.js — Netlify Identity (GoTrue) glue for login + guard */
(async function () {
  // Ensure GoTrue global exists (UMD first, else ESM import)
  if (typeof GoTrue === "undefined") {
    try {
      const mod = await import('https://unpkg.com/gotrue-js@1?module');
      window.GoTrue = mod.default || mod.GoTrue || mod;
    } catch {
      console.error("[NF] GoTrue not loaded. Check script order / CDN.");
      return;
    }
  }

  const auth = new GoTrue({
    APIUrl: "/.netlify/identity", // works on Netlify & `netlify dev`
    setCookie: true               // sets nf_jwt cookie for CDN/edge
  });

  const STORAGE_KEY = "nf_auth_event";

  // cross-tab broadcast
  function broadcastAuthEvent(type) {
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
      const u = auth.currentUser();
      if (!u) return null;
      await u.jwt(); // refresh/fails if invalid
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
    const u = auth.currentUser();
    try { if (u) await u.logout(); } catch {}
    broadcastAuthEvent("logout");
    location.replace(to);
  }

  async function signIn(email, password, remember) {
    const user = await auth.login(email, password, remember);
    broadcastAuthEvent("login");
    return user;
  }
  async function signUp(email, password) {
    const user = await auth.signup(email, password);
    broadcastAuthEvent("signup");
    return user;
  }

  window.NF = {
    auth,
    getUserSafe,
    requireAuth,
    signOut,
    // optional
    signIn,
    signUp
  };

  window.dispatchEvent(new Event("nf-ready"));
})();
