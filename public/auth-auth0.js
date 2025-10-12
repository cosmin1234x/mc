/* auth-auth0.js — SPA PKCE Auth0 integration + cached user events */
(function () {
  const AUTH0_DOMAIN    = "cosminshynia2.uk.auth0.com";
  const AUTH0_CLIENT_ID = "5Ss8SxEwDMUeJV8PvqmuUwUFCdSNHbQv";
  const AUTH0_AUDIENCE  = "";             
  const CALLBACK_PATH   = "/app.html";
  const APP_PATH        = "/app.html";

  const LS_LAST_USER = "mccrew:last_user";
  let auth0Client = null;

  function emit(name, detail){ try { window.dispatchEvent(new CustomEvent(name,{detail})); } catch {} }
  function cacheUser(u){
    try {
      if(!u){ localStorage.removeItem(LS_LAST_USER); return; }
      const b = { email:u.email||"", name:u.name||"", picture:u.picture||"" };
      localStorage.setItem(LS_LAST_USER, JSON.stringify(b));
    }catch{}
  }

  async function init(){
    if(!window.auth0 || !auth0.createAuth0Client){
      console.error("[NF] Auth0 SDK not loaded");
      return;
    }

    auth0Client = await auth0.createAuth0Client({
      domain: AUTH0_DOMAIN,
      clientId: AUTH0_CLIENT_ID,
      authorizationParams: {
        redirect_uri: location.origin + CALLBACK_PATH,
        ...(AUTH0_AUDIENCE ? { audience: AUTH0_AUDIENCE } : {})
      },
      cacheLocation: "localstorage",
      useRefreshTokens: true
    });

    // Handle Auth0 redirect (code/state)
    const sp = new URLSearchParams(location.search);
    if (sp.has("code") && sp.has("state")) {
      try {
        const { appState } = await auth0Client.handleRedirectCallback();
        const next = (appState && appState.next) || APP_PATH;
        window.history.replaceState({}, document.title, location.pathname);
        if(location.pathname !== next) location.replace(next);
        return;
      } catch(e){
        console.error("Auth0 callback error:", e);
        alert("Login failed. Check SPA type and callback URLs.");
      }
    }

    exposeNF();

    // Emit when ready
    emit("nf-ready");

    // Load user state
    const isAuth = await auth0Client.isAuthenticated();
    let user = null;
    if(isAuth){
      user = await auth0Client.getUser();
      cacheUser(user);
    } else {
      cacheUser(null);
    }

    emit("auth:change",{user});
  }

  function exposeNF(){
    async function getUserSafe(){
      try {
        if(!await auth0Client.isAuthenticated()) return null;
        const u = await auth0Client.getUser();
        cacheUser(u);
        return { 
          email: u?.email || "", 
          name: u?.name || "", 
          picture: u?.picture || "", 
          raw: u 
        };
      }catch{return null;}
    }

    async function requireAuth(){
      const user = await getUserSafe();
      if(user) return user;
      await auth0Client.loginWithRedirect({
        authorizationParams:{ redirect_uri: location.origin + CALLBACK_PATH },
        appState:{ next: APP_PATH }
      });
      return null;
    }

    async function signOut(to="/"){
      cacheUser(null);
      await auth0Client.logout({
        logoutParams:{ returnTo: location.origin + to }
      });
      emit("auth:change",{user:null});
    }

    async function signIn(next=APP_PATH){
      await auth0Client.loginWithRedirect({
        authorizationParams:{ redirect_uri: location.origin + CALLBACK_PATH },
        appState:{ next }
      });
    }

    async function signUp(next=APP_PATH){
      await auth0Client.loginWithRedirect({
        authorizationParams:{
          redirect_uri: location.origin + CALLBACK_PATH,
          screen_hint: "signup"
        },
        appState:{ next }
      });
    }

    window.NF = {
      provider:"auth0",
      getUserSafe,
      requireAuth,
      signOut,
      signIn,
      signUp,
      auth:{ login: async()=>signIn(), signup: async()=>signUp() }
    };
  }

  document.addEventListener("DOMContentLoaded", init);
})();
