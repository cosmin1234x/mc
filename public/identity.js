// identity.js — Netlify Identity guard + header wiring (public)
(function () {
  const isLogin = location.pathname.endsWith("/login.html");

  function rolesOf(user){
    return (user && (user.app_metadata?.roles || user.roles || [])) || [];
  }

  function updateHeader(user){
    const who = document.getElementById("who");
    const adminBtn = document.getElementById("openAdmin");
    const loginBtn = document.getElementById("loginBtn");
    const logoutBtn = document.getElementById("logout");

    const roles = rolesOf(user);
    const roleLabel = roles[0] || "crew";

    if (who) who.textContent = user ? `${user.user_metadata?.full_name || user.email} (${roleLabel})` : "";

    if (adminBtn) adminBtn.style.display = roles.includes("admin") ? "" : "none";
    if (loginBtn) loginBtn.style.display = user ? "none" : "";
    if (logoutBtn){
      logoutBtn.style.display = user ? "" : "none";
      logoutBtn.onclick = () => netlifyIdentity.logout();
    }
  }

  function redirectToNext(defaultPath="/app/"){
    const params = new URLSearchParams(location.search);
    const next = params.get("next") || defaultPath;
    location.replace(next.replace(/^\/*/, "/"));
  }

  document.addEventListener("DOMContentLoaded", () => {
    if (!window.netlifyIdentity) return;

    netlifyIdentity.on("init", (user) => {
      updateHeader(user);
      // Client guard (CDN gate still protects /app/*):
      if (!user && !isLogin) {
        const next = encodeURIComponent(location.pathname);
        location.replace(`/login.html?next=${next}`);
      }
    });

    netlifyIdentity.on("login", (user) => { updateHeader(user); redirectToNext(); });
    netlifyIdentity.on("logout", () => { updateHeader(null); location.replace("/login.html"); });

    const loginBtn = document.getElementById("loginBtn");
    if (loginBtn) loginBtn.addEventListener("click", () => netlifyIdentity.open());

    netlifyIdentity.init(); // restores session via nf_jwt
  });
})();
