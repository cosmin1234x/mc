/* login.js — UI wiring for login.html */
document.addEventListener("DOMContentLoaded", () => {
  const qs = (s)=>document.querySelector(s);
  const signIn = qs("#formSignIn");
  const signUp = qs("#formSignUp");
  const tabIn = qs("#tabSignIn");
  const tabUp = qs("#tabSignUp");
  const siEmail = qs("#siEmail");
  const siPin = qs("#siPin");
  const suName = qs("#suName");
  const suEmail = qs("#suEmail");
  const suPin = qs("#suPin");
  const siErr = qs("#siErr");
  const suErr = qs("#suErr");
  const remember = qs("#remember");

  function showForm(which){
    const isIn = which === "in";
    tabIn.classList.toggle("active", isIn);
    tabUp.classList.toggle("active", !isIn);
    signIn.hidden = !isIn;
    signUp.hidden = isIn;
    (isIn ? siEmail : suName).focus();
  }

  tabIn.addEventListener("click", ()=>showForm("in"));
  tabUp.addEventListener("click", ()=>showForm("up"));

  // Parse ?next=...
  const params = new URLSearchParams(location.search);
  const next = params.get("next") || "index.html";

  signIn.addEventListener("submit", async (e)=>{
    e.preventDefault();
    siErr.hidden = true; siErr.textContent = "";
    try{
      const sess = await McAuth.signIn(siEmail.value.trim(), siPin.value.trim(), !!remember.checked);
      // success
      const to = next.replace(/^\/*/, "");
      location.replace(to);
    }catch(err){
      siErr.hidden = false; siErr.textContent = err.message || "Sign in failed.";
      siPin.classList.add("shake"); setTimeout(()=>siPin.classList.remove("shake"), 380);
    }
  });

  signUp.addEventListener("submit", async (e)=>{
    e.preventDefault();
    suErr.hidden = true; suErr.textContent = "";
    try{
      await McAuth.signUp({ email: suEmail.value.trim(), name: suName.value.trim(), pin: suPin.value.trim(), role: "crew" });
      // Auto sign-in after sign-up
      await McAuth.signIn(suEmail.value.trim(), suPin.value.trim(), true);
      location.replace("index.html");
    }catch(err){
      suErr.hidden = false; suErr.textContent = err.message || "Could not create account.";
      suPin.classList.add("shake"); setTimeout(()=>suPin.classList.remove("shake"), 380);
    }
  });

  // Small UX: Enter on email jumps to PIN
  siEmail.addEventListener("keydown",(e)=>{ if(e.key==="Enter"){ e.preventDefault(); siPin.focus(); }});
  suName.addEventListener("keydown",(e)=>{ if(e.key==="Enter"){ e.preventDefault(); suEmail.focus(); }});
});
