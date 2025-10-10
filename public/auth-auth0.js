/* auth-auth0.js — Auth0 SPA shim exposing window.NF (Netlify-like API)
   Domain/Client ID set for your tenant. Uses appState (no query on redirect_uri). */
(function () {
  const AUTH0_DOMAIN    = "cosminshynia2.uk.auth0.com";
  const AUTH0_CLIENT_ID = "5Ss8SxEwDMUeJV8PvqmuUwUFCdSNHbQv";
  const AUTH0_AUDIENCE  = "";             // optional
  const CALLBACK_PATH   = "/index.html";  // keep this EXACT
  const APP_PATH        = "/app.html";

  let auth0Client = null;

  async function init() {
    if (!window.auth0 || !auth0.createAuth0Client) {
      console.error("Auth0 SDK not loaded");
      return;
    }

    auth0Client = await auth0.createAuth0Client({
      domain: AUTH0_DOMAIN,
      clientId: AUTH0_CLIENT_ID,
      authorizationParams: {
        redirect_uri: window.location.origin + CALLBACK_PATH,
        ...(AUTH0_AUDIENCE ? { audience: AUTH0_AUDIENCE } : {})
      },
      cacheLocation: "localstorage",
      useRefreshTokens: true
    });

    // If we're on the callback page after Auth0 redirect
    const sp = new URLSearchParams(window.location.search);
    if (sp.has("code") && sp.has("state")) {
      try {
        const { appState } = await auth0Client.handleRedirectCallback();
        const next = (appState && appState.next) || APP_PATH;
        // Clean query string then go to the intended page
        window.history.replaceState({}, document.title, window.location.pathname);
        location.replace(next);
        return;
      } catch (e) {
        console.error("Auth0 callback error:", e);
        alert("Login failed. Double-check your SPA settings and callback URLs.");
      }
    }

    exposeNF();
    window.dispatchEvent(new Event("nf-ready"));
  }

  function exposeNF(){
    async function getUserSafe(){
      try{
        if (!await auth0Client.isAuthenticated()) return null;
        const u = await auth0Client.getUser();
        return {
          email: u?.email || u?.name || "",
          sub: u?.sub || "",
          jwt: async () => auth0Client.getTokenSilently().catch(()=>null),
          raw: u
        };
      }catch{ return null; }
    }

    async function requireAuth(){
      const user = await getUserSafe();
      if (user) return user;
      const next = new URLSearchParams(window.location.search).get("next") || APP_PATH;
      await auth0Client.loginWithRedirect({
        authorizationParams: {
          // NOTE: NO query on redirect_uri; it must match Allowed Callback URLs exactly
          redirect_uri: window.location.origin + CALLBACK_PATH
        },
        appState: { next } // pass target via appState
      });
      return null; // redirect occurs
    }

    async function signOut(to="/"){
      await auth0Client.logout({ logoutParams: { returnTo: window.location.origin + to } });
    }

    async function signIn(next=APP_PATH){
      await auth0Client.loginWithRedirect({
        authorizationParams: { redirect_uri: window.location.origin + CALLBACK_PATH },
        appState: { next }
      });
    }

    async function signUp(next=APP_PATH){
      await auth0Client.loginWithRedirect({
        authorizationParams: {
          redirect_uri: window.location.origin + CALLBACK_PATH,
          screen_hint: "signup"
        },
        appState: { next }
      });
    }

    window.NF = {
      provider:"auth0",
      getUserSafe,
      requireAuth,
      signOut,
      signIn,
      signUp,
      auth:{ login: async()=>signIn(), signup: async()=>signUp() } // legacy compatibility
    };
  }

  init().catch(err => console.error("Auth0 init failed", err));
})();
