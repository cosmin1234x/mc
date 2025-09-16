/* auth-netlify.js — Netlify Identity (GoTrue) glue for login + guard */
(function () {
  // GoTrue is exposed by the CDN script (see index.html and app.html)
  const auth = new GoTrue({
    APIUrl: "/.netlify/identity", // works on Netlify and with `netlify dev`
    setCookie: true               // sets nf_jwt cookie for CDN/edge use
  });

  async function getUserSafe() {
    try {
      const u = auth.currentUser();
      if (!u) return null;
      // ensure token is fresh; throws if expired/invalid
      await u.jwt();
      return u;
    } catch {
      return null;
    }
  }

  async function requireAuth(redirectTo = "/") {
    const u = await getUserSafe();
    if (!u) {
      const next = encodeURIComponent(location.pathname);
      location.replace(`${redirectTo}?next=${next}`);
      return null;
    }
    return u;
  }

  async function signOut(to = "/") {
    const u = auth.currentUser();
    try { if (u) await u.logout(); } catch {}
    location.replace(to);
  }

  window.NF = {
    auth,
    getUserSafe,
    requireAuth,
    signOut
  };
})();
