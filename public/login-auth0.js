/* login-auth0.js — trigger signup via NF shim from landing page */
document.addEventListener("DOMContentLoaded", () => {
  const btnSignUp = document.getElementById("btnSignUp");
  const err = document.getElementById("err");

  function ready(fn){
    if (window.NF) return fn();
    window.addEventListener("nf-ready", fn, { once:true });
  }

  ready(() => {
    btnSignUp?.addEventListener("click", async () => {
      try{
        await NF.signUp("/app.html");
      }catch(e){
        console.error(e);
        if (err) { err.hidden = false; err.textContent = "Could not start sign up."; }
      }
    });
  });
});
