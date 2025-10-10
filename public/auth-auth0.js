/* auth-auth0.js — Auth0 SPA shim exposing window.NF (Netlify-like API)
   REQUIRED: set AUTH0_DOMAIN & AUTH0_CLIENT_ID below. */
(function () {
  const AUTH0_DOMAIN    = "cosminshynia2.uk.auth0.com"; // <-- CHANGE
  const AUTH0_CLIENT_ID = "5Ss8SxEwDMUeJV8PvqmuUwUFCdSNHbQv";     // <-- CHANGE
  const AUTH0_AUDIENCE  = ""; // optional, e.g., "https://api.example.com"

  let auth0Client = null;

  function qs(sel){ return document.querySelector(sel); }
  function toast(msg, type=""){
    const box = qs("#toasts"); if (!box) return;
    const el = document.createElement("div");
    el.className = `toast ${type}`; el.textContent = msg;
    box.appendChild(el);
    setTimeout(()=>{ el.classList.add("leave"); setTimeout(()=>el.remove(), 180); }, 1800);
  }

  async function init() {
    if (!window.auth0 || !auth0.createAuth0Client) {
      console.error("Auth0 SDK not loaded");
      return;
    }
    auth0Client = await auth0.createAuth0Client({
      domain: AUTH0_DOMAIN,
      clientId: AUTH0_CLIENT_ID,
      authorizationParams: {
        // We land on app.html authenticated; index.html handles redirect handshake
        redirect_uri: window.location.origin + "/app.html",
        ...(AUTH0_AUDIENCE ? { audience: AUTH0_AUDIENCE } : {})
      },
      cacheLocation: "localstorage",
      useRefreshTokens: true
    });

    // Handle index.html redirect handshake (if present)
    const sp = new URLSearchParams(window.location.search);
    if (sp.has("code") && sp.has("state")) {
      try {
        await auth0Client.handleRedirectCallback();
        const next = sp.get("next") || "/app.html";
        window.history.replaceState({}, document.title, window.location.pathname);
        location.replace(next);
      } catch (e) {
        console.error("Auth0 callback error:", e);
        toast("Login failed", "warn");
      }
    }

    exposeNF();
    window.dispatchEvent(new Event("nf-ready"));
  }

  function exposeNF(){
    async function getUserSafe(){
      try{
        const isAuth = await auth0Client.isAuthenticated();
        if (!isAuth) return null;
        const u = await auth0Client.getUser();
        return {
          email: u?.email || u?.name || "",
          sub: u?.sub || "",
          jwt: async () => auth0Client.getTokenSilently().catch(()=>null),
          raw: u
        };
      }catch{ return null; }
    }

    async function requireAuth(redirectTo = "/"){
      const user = await getUserSafe();
      if (user) return user;
      const next = new URLSearchParams(window.location.search).get("next") || "/app.html";
      await auth0Client.loginWithRedirect({
        authorizationParams: { redirect_uri: window.location.origin + "/index.html?next=" + encodeURIComponent(next) }
      });
      return null; // redirect happens
    }

    async function signOut(to = "/"){
      await auth0Client.logout({
        logoutParams: { returnTo: window.location.origin + to }
      });
    }

    async function signIn(next = "app.html"){
      await auth0Client.loginWithRedirect({
        authorizationParams: { redirect_uri: window.location.origin + "/index.html?next=" + encodeURIComponent(next) }
      });
    }

    async function signUp(next = "app.html"){
      await auth0Client.loginWithRedirect({
        authorizationParams: {
          redirect_uri: window.location.origin + "/index.html?next=" + encodeURIComponent(next),
          screen_hint: "signup"
        }
      });
    }

    window.NF = {
      provider: "auth0",
      getUserSafe,
      requireAuth,
      signOut,
      signIn,   // programmatic
      signUp,   // programmatic
      auth: {   // legacy compatibility (not used by new login)
        login: async () => signIn(),
        signup: async () => signUp()
      }
    };
  }

  init().catch(err => console.error("Auth0 init failed", err));
})();
