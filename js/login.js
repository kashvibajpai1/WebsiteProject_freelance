/* ============================================================
   TREASURE TROVE — LOGIN / REGISTER PAGE
   Tab switching, validation, friendly errors, and redirect
   back to the page the visitor originally wanted.
   ============================================================ */

(function () {
  "use strict";

  document.addEventListener("DOMContentLoaded", () => {
    const A = window.TTAuth;
    const $ = (id) => document.getElementById(id);

    const tabs = { signin: $("tab-signin"), register: $("tab-register") };
    const forms = { signin: $("form-signin"), register: $("form-register") };
    const msg = $("form-msg");
    const title = $("auth-title");
    const sub = $("auth-sub");

    /* Already signed in? Straight back to where they were headed. */
    A.ready.then((user) => {
      if (user) window.location.replace(A.consumeIntent());
    });

    /* ---------- tab switching ---------- */
    function show(which) {
      const isSignin = which === "signin";
      tabs.signin.classList.toggle("active", isSignin);
      tabs.register.classList.toggle("active", !isSignin);
      tabs.signin.setAttribute("aria-selected", String(isSignin));
      tabs.register.setAttribute("aria-selected", String(!isSignin));
      forms.signin.hidden = !isSignin;
      forms.register.hidden = isSignin;
      title.textContent = isSignin ? "Welcome back" : "Join the house";
      sub.textContent = isSignin
        ? "Sign in to browse the collections — or register in under a minute. It's free, always."
        : "Tell us who you are — your name, email and phone help us serve you personally (and verify Vault access).";
      hideMsg();
      const first = (isSignin ? forms.signin : forms.register).querySelector("input");
      if (first) first.focus();
    }
    tabs.signin.addEventListener("click", () => show("signin"));
    tabs.register.addEventListener("click", () => show("register"));
    document.querySelectorAll("[data-switch]").forEach((b) =>
      b.addEventListener("click", () => show(b.dataset.switch))
    );

    /* ---------- messages ---------- */
    function showMsg(type, text) {
      msg.className = "form-msg show " + type;
      msg.textContent = text;
      msg.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
    function hideMsg() { msg.className = "form-msg"; msg.textContent = ""; }

    /* ---------- field validation ---------- */
    function setInvalid(input, invalid, errText) {
      const field = input.closest(".field");
      field.classList.toggle("invalid", invalid);
      input.setAttribute("aria-invalid", String(invalid));
      if (invalid && errText) field.querySelector(".error").textContent = errText;
      return !invalid;
    }
    // live-clear errors as the user types
    document.querySelectorAll(".field input").forEach((inp) =>
      inp.addEventListener("input", () => setInvalid(inp, false))
    );

    function busy(btn, isBusy, idleText) {
      btn.disabled = isBusy;
      btn.style.opacity = isBusy ? ".6" : "";
      btn.textContent = isBusy ? "One moment…" : idleText;
    }

    function finishLogin(user) {
      showMsg("success", "Welcome, " + (user.name || user.email) + "! Taking you in…");
      setTimeout(() => window.location.replace(A.consumeIntent()), 700);
    }

    /* ---------- sign in ---------- */
    forms.signin.addEventListener("submit", async (e) => {
      e.preventDefault();
      hideMsg();
      const email = $("si-email"), pass = $("si-password");
      let ok = setInvalid(email, !A.validEmail(email.value));
      ok = setInvalid(pass, pass.value.length < 1) && ok;
      if (!ok) return;

      const btn = $("si-submit");
      busy(btn, true, "Sign In");
      try {
        const user = await A.signIn({ email: email.value, password: pass.value });
        finishLogin(user);
      } catch (err) {
        showMsg("error", err.message);
      } finally {
        busy(btn, false, "Sign In");
      }
    });

    /* ---------- register ---------- */
    forms.register.addEventListener("submit", async (e) => {
      e.preventDefault();
      hideMsg();
      const name = $("rg-name"), email = $("rg-email"), phone = $("rg-phone"),
            pass = $("rg-password"), confirm = $("rg-confirm");

      const normPhone = A.normalizePhone(phone.value);
      let ok = setInvalid(name, name.value.trim().length < 2);
      ok = setInvalid(email, !A.validEmail(email.value)) && ok;
      ok = setInvalid(phone, !normPhone) && ok;
      ok = setInvalid(pass, pass.value.length < 6) && ok;
      ok = setInvalid(confirm, confirm.value !== pass.value) && ok;
      if (!ok) return;

      const btn = $("rg-submit");
      busy(btn, true, "Create Account");
      try {
        const user = await A.signUp({
          name: name.value, email: email.value,
          phone: normPhone, password: pass.value
        });
        finishLogin(user);
      } catch (err) {
        showMsg("error", err.message);
      } finally {
        busy(btn, false, "Create Account");
      }
    });
  });
})();
