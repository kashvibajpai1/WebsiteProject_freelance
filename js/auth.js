/* ============================================================
   TREASURE TROVE — AUTHENTICATION LAYER
   ------------------------------------------------------------
   Two modes, same API:

   • DEMO MODE (default, firebaseConfig = null in js/config.js)
     Accounts live in this browser's localStorage. Perfect for
     previewing the site; not for production.

   • FIREBASE MODE (firebaseConfig filled in)
     Real accounts via Firebase Authentication; profile + Vault
     approval flag stored in Firestore (users/{uid}).

   Pages talk only to window.TTAuth — they never care which
   mode is active.
   ============================================================ */

(function () {
  "use strict";

  const CFG = window.SITE_CONFIG || {};
  const DEMO = !CFG.firebaseConfig;

  const LS_USERS = "tt_users_v1";
  const LS_SESSION = "tt_session_v1";

  let currentUser = null;          // {name,email,phone,approved}
  const listeners = [];
  let resolveReady;
  const ready = new Promise((res) => (resolveReady = res));

  /* ---------------- helpers ---------------- */

  function normEmail(e) { return String(e || "").trim().toLowerCase(); }

  function validEmail(e) { return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(normEmail(e)); }

  // Accepts "+91 98017 98125", "9801798125", "09801798125" → E.164 or null
  function normalizePhone(raw) {
    let d = String(raw || "").replace(/[^\d+]/g, "");
    if (d.startsWith("+")) d = d.slice(1);
    if (d.startsWith("00")) d = d.slice(2);
    if (d.length === 11 && d.startsWith("0")) d = "91" + d.slice(1);
    if (d.length === 10) d = "91" + d;
    if (/^\d{11,15}$/.test(d)) return "+" + d;
    return null;
  }

  // Not cryptography — just avoids storing demo passwords as plain text.
  function demoHash(str) {
    let h = 5381;
    for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) >>> 0;
    return "d" + h.toString(36);
  }

  function readJSON(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key)) || fallback; }
    catch { return fallback; }
  }

  function emit() {
    listeners.forEach((cb) => { try { cb(currentUser); } catch (e) { console.error(e); } });
  }

  function friendly(code, fallbackMsg) {
    const map = {
      "auth/email-already-in-use": "An account with this email already exists. Try signing in instead.",
      "auth/invalid-credential": "Email or password is incorrect.",
      "auth/wrong-password": "Email or password is incorrect.",
      "auth/user-not-found": "No account found with this email. Please register first.",
      "auth/weak-password": "Password should be at least 6 characters.",
      "auth/too-many-requests": "Too many attempts. Please wait a moment and try again.",
      "auth/network-request-failed": "Network problem — please check your connection and retry.",
      "auth/invalid-email": "That email address doesn't look right."
    };
    return map[code] || fallbackMsg || "Something went wrong. Please try again.";
  }

  /* ---------------- DEMO MODE ---------------- */

  const demo = {
    init() {
      const session = readJSON(LS_SESSION, null);
      if (session && session.email) {
        const users = readJSON(LS_USERS, {});
        const u = users[session.email];
        if (u) currentUser = demo.toUser(session.email, u);
        else localStorage.removeItem(LS_SESSION);
      }
      resolveReady(currentUser);
      emit();
    },

    toUser(email, rec) {
      const approvedList = (CFG.demoApprovedEmails || []).map(normEmail);
      return {
        name: rec.name, email, phone: rec.phone,
        approved: approvedList.includes(email)
      };
    },

    async signUp({ name, email, phone, password }) {
      email = normEmail(email);
      const users = readJSON(LS_USERS, {});
      if (users[email]) throw new Error(friendly("auth/email-already-in-use"));
      users[email] = { name: name.trim(), phone, pass: demoHash(password), created: Date.now() };
      localStorage.setItem(LS_USERS, JSON.stringify(users));
      localStorage.setItem(LS_SESSION, JSON.stringify({ email, at: Date.now() }));
      currentUser = demo.toUser(email, users[email]);
      emit();
      return currentUser;
    },

    async signIn({ email, password }) {
      email = normEmail(email);
      const users = readJSON(LS_USERS, {});
      const rec = users[email];
      if (!rec) throw new Error(friendly("auth/user-not-found"));
      if (rec.pass !== demoHash(password)) throw new Error(friendly("auth/wrong-password"));
      localStorage.setItem(LS_SESSION, JSON.stringify({ email, at: Date.now() }));
      currentUser = demo.toUser(email, rec);
      emit();
      return currentUser;
    },

    async signOut() {
      localStorage.removeItem(LS_SESSION);
      currentUser = null;
      emit();
    }
  };

  /* ---------------- FIREBASE MODE ---------------- */

  const fb = {
    app: null, auth: null, db: null,

    loadScript(src) {
      return new Promise((res, rej) => {
        const s = document.createElement("script");
        s.src = src; s.onload = res;
        s.onerror = () => rej(new Error("Could not load " + src));
        document.head.appendChild(s);
      });
    },

    async init() {
      const V = "10.12.2";
      const base = "https://www.gstatic.com/firebasejs/" + V + "/";
      try {
        await fb.loadScript(base + "firebase-app-compat.js");
        await Promise.all([
          fb.loadScript(base + "firebase-auth-compat.js"),
          fb.loadScript(base + "firebase-firestore-compat.js")
        ]);
        fb.app = firebase.initializeApp(CFG.firebaseConfig);
        fb.auth = firebase.auth();
        fb.db = firebase.firestore();

        fb.auth.onAuthStateChanged(async (user) => {
          if (user) {
            currentUser = await fb.profileFor(user);
          } else {
            currentUser = null;
          }
          resolveReady(currentUser);
          emit();
        });
      } catch (e) {
        console.error("Firebase failed to load — falling back to demo mode.", e);
        demo.init();
      }
    },

    async profileFor(user) {
      let profile = { name: user.displayName || "", phone: "", approved: false };
      try {
        const snap = await fb.db.collection("users").doc(user.uid).get();
        if (snap.exists) profile = Object.assign(profile, snap.data());
      } catch (e) {
        console.warn("Could not read user profile:", e);
      }
      return {
        name: profile.name || user.displayName || user.email,
        email: user.email,
        phone: profile.phone || "",
        approved: profile.approved === true
      };
    },

    async signUp({ name, email, phone, password }) {
      try {
        const cred = await fb.auth.createUserWithEmailAndPassword(normEmail(email), password);
        await cred.user.updateProfile({ displayName: name.trim() });
        await fb.db.collection("users").doc(cred.user.uid).set({
          name: name.trim(),
          email: normEmail(email),
          phone,
          approved: false,               // owner flips this to true to grant Vault access
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        currentUser = await fb.profileFor(cred.user);
        emit();
        return currentUser;
      } catch (e) {
        throw new Error(friendly(e.code, e.message));
      }
    },

    async signIn({ email, password }) {
      try {
        const cred = await fb.auth.signInWithEmailAndPassword(normEmail(email), password);
        currentUser = await fb.profileFor(cred.user);
        emit();
        return currentUser;
      } catch (e) {
        throw new Error(friendly(e.code, e.message));
      }
    },

    async signOut() { await fb.auth.signOut(); }
  };

  /* ---------------- PUBLIC API ---------------- */

  const impl = DEMO ? demo : fb;

  window.TTAuth = {
    isDemo: DEMO,
    ready,
    getUser: () => currentUser,
    onChange(cb) { listeners.push(cb); if (currentUser !== undefined) cb(currentUser); },
    validEmail,
    normalizePhone,

    async signUp(data) { return impl.signUp(data); },
    async signIn(data) { return impl.signIn(data); },
    async signOut() {
      await impl.signOut();
      // after logout, bounce off gated pages back home
      const gated = document.body.dataset.gate;
      if (gated) window.location.href = "index.html";
    },

    /* Where to send the user back after login (traceback).
       Stored in sessionStorage so it survives the login redirect. */
    rememberIntent() {
      try { sessionStorage.setItem("tt_next", window.location.pathname.split("/").pop() || "index.html"); }
      catch {}
    },
    consumeIntent() {
      try {
        const next = sessionStorage.getItem("tt_next");
        sessionStorage.removeItem("tt_next");
        // only allow same-site page names — never external URLs
        if (next && /^[\w-]+\.html$/.test(next)) return next;
      } catch {}
      return "index.html";
    },
    goToLogin() {
      window.TTAuth.rememberIntent();
      window.location.href = "login.html";
    }
  };

  impl.init();
})();
