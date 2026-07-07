/* ============================================================
   TREASURE TROVE — SITE CONFIGURATION
   This is the ONLY file you need to edit for business details.
   ============================================================ */

window.SITE_CONFIG = {

  /* ---- Business identity ---- */
  brandName: "Treasure Trove",
  legacyName: "Weaves & Drapes",
  established: "1980s",

  /* ---- Contact ---- */
  // WhatsApp number in international format, digits only (91 = India)
  whatsappNumber: "919801798125",
  phoneDisplay: "+91 98017 98125",
  email: "consultnkb@gmail.com",
  instagramHandle: "weaves_n_drapes",
  instagramUrl: "https://www.instagram.com/weaves_n_drapes",

  /* ---- Location ---- */
  addressLine1: "CRC The Flagship",
  addressLine2: "Sector 140, Noida, Uttar Pradesh, India",
  // Google Maps link for the "Visit Us" button
  mapsUrl: "https://www.google.com/maps/search/?api=1&query=CRC+The+Flagship+Sector+140+Noida",

  /* ---- Access control ----
     require login before anyone can browse Collections?      */
  requireLoginForCollections: true,

  /* ---- DEMO-MODE approved list ----
     Used ONLY while Firebase is not configured (demo mode).
     Emails listed here get access to The Vault after login.
     Once Firebase is live, approvals are managed in Firestore
     instead (see README.md → "Granting Vault access").        */
  demoApprovedEmails: [
    "consultnkb@gmail.com"
  ],

  /* ---- Firebase (real authentication) ----
     Leave as null to run in demo mode (local, no server).
     To go live: create a free Firebase project and paste its
     web config object here. Full steps in README.md.          */
  firebaseConfig: null
  /* Example of a filled-in config:
  firebaseConfig: {
    apiKey: "AIza....",
    authDomain: "treasure-trove.firebaseapp.com",
    projectId: "treasure-trove",
    storageBucket: "treasure-trove.appspot.com",
    messagingSenderId: "1234567890",
    appId: "1:1234567890:web:abcdef"
  }
  */
};
