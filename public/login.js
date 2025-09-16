/* login.js — form wiring for LOGIN (now at root /index.html) */
document.addEventListener("DOMContentLoaded", () => {
  const qs = (s)=>document.querySelector(s);

  const tabIn = qs("#tabSignIn");
  const tabUp = qs("#tabSignUp");
  const formIn = qs("#formSignIn");
  const formUp = qs("#formSignUp");
  const siEmail = qs("#siEmail");
  const siPass  = qs("#siPass");
  const suEmail = qs("#suEmail");
  const suPass  = qs("#suPass");
  const siErr   = qs("#siErr");
  const suErr   = qs("#suErr");
  const remember = qs("#remember");

  const params = new URLSearchParams(location.search);
  // Default destination after login is the app page
  const next = params.get("next") || "app.html";

  function showForm(which){
    const isIn = which === "in";
    tabIn.classList.toggle("active", isIn);
    tabUp.classList.toggle("active", !isIn);
    formIn.hidden = !isIn;
    formUp.hidden = isIn;
    (isIn ? siEmail : suEmail).focus();
  }
  tabIn.addEventListener("click", ()=>showForm("in"));
  tabUp.addEventListener("click", ()=>showForm("up"));

  formIn.addEventListener("submit", async (e)=>{
    e.preventDefault(); siErr.hidden = true; siErr.textContent = "";
    try{
      await McAuth.signIn(siEmail.value, siPass.value, !!remember.checked);
      // go to app.html (or ?next=...)
      location.replace(next.replace(/^\/*/, ""));
    }catch(err){
      siErr.textContent = err.message || "Sign in failed.";
      siErr.hidden = false;
      siPass.classList.add("shake"); setTimeout(()=>siPass.classList.remove("shake"), 380);
    }
  });

  formUp.addEventListener("submit", async (e)=>{
    e.preventDefault(); suErr.hidden = true; suErr.textContent = "";
    try{
      await McAuth.signUp(suEmail.value, suPass.value);
      await McAuth.signIn(suEmail.value, suPass.value, true);
      location.replace("app.html");
    }catch(err){
      suErr.textContent = err.message || "Could not create account.";
      suErr.hidden = false;
      suPass.classList.add("shake"); setTimeout(()=>suPass.classList.remove("shake"), 380);
    }
  });

  // Enter on email focuses password
  siEmail.addEventListener("keydown",(e)=>{ if(e.key==="Enter"){ e.preventDefault(); siPass.focus(); }});
  suEmail.addEventListener("keydown",(e)=>{ if(e.key==="Enter"){ e.preventDefault(); suPass.focus(); }});

  // default view
  showForm("in");
});
