/* login-auth0.js — wire login/signup buttons to Auth0 via NF shim */
document.addEventListener("DOMContentLoaded", () => {
  const btnSignIn = document.getElementById("btnSignIn");
  const btnSignUp = document.getElementById("btnSignUp");
  const err = document.getElementById("err");

  function ready(fn){
    if (window.NF) return fn();
    window.addEventListener("nf-ready", fn, { once:true });
  }

  ready(() => {
    btnSignIn?.addEventListener("click", async () => {
      try{
        const next = new URLSearchParams(location.search).get("next") || "app.html";
        await NF.signIn(next);
      }catch(e){
        console.error(e); err.hidden = false; err.textContent = "Could not start sign in.";
      }
    });

    btnSignUp?.addEventListener("click", async () => {
      try{
        const next = new URLSearchParams(location.search).get("next") || "app.html";
        await NF.signUp(next);
      }catch(e){
        console.error(e); err.hidden = false; err.textContent = "Could not start sign up.";
      }
    });
  });
});
