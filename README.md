# Treasure Trove — Website

The official website for **Treasure Trove** (formerly *Weaves & Drapes*) —
hand-knotted carpets, Banarasi handloom silks and heirloom handicrafts since
the 1980s. CRC The Flagship, Sector 140, Noida, UP, India.

Built as a fast, dependency-free static site: plain HTML/CSS/JS, no build
step, hostable for free on GitHub Pages, Netlify or Vercel.

---

## Pages

| Page | What it does | Who can see it |
|---|---|---|
| `index.html` | Brand story, heritage timeline, craft pillars, featured pieces, visit info | Everyone (brand visibility + SEO) |
| `collections.html` | Full public catalogue with category filters | Logged-in users (toggleable) |
| `vault.html` | **The Vault** — exclusive pieces | Logged-in users **approved by you** |
| `login.html` | Sign in / register (name, email, phone, password) | Everyone |
| `404.html` | Friendly "thread not found" page | — |
| `fruit-ninja.html` | **Finger Ninja** — webcam fruit-slicing game (see below) | Everyone |

Every product card and the floating green button open **WhatsApp** chat with
your business number, pre-filled with the product name and reference code.

---

## Previewing the site locally

Open a terminal in this folder and run one of:

```bash
python3 -m http.server 8080     # then visit http://localhost:8080
# or
npx serve .
```

(Opening `index.html` by double-click also works for most things, but a local
server is closer to how the live site behaves.)

**Finger Ninja needs a real server** — `fruit-ninja.html` uses ES modules and
the camera, and browsers block both on `file://`. Use one of the commands
above and visit `http://localhost:8080/fruit-ninja.html`.

---

## Finger Ninja — the webcam game

`fruit-ninja.html` is a self-contained arcade game: your **index fingertip is
the blade**. Hold a hand up to the laptop camera and swipe through the fruit.
Two hands work at once. There is no build step and it shares the site's
palette, so it drops onto the same static host as everything else.

| File | Role |
|---|---|
| `fruit-ninja.html` | Page shell, HUD and overlays |
| `css/fruit-ninja.css` | Styling |
| `js/fruit-ninja.js` | Wires the DOM to the game |
| `js/game/hand-tracker.js` | Camera + MediaPipe hand landmarks |
| `js/game/game.js` | Physics, slicing, scoring, render loop |
| `js/game/fruits.js` | All fruit artwork (canvas paths, no image files) |
| `js/game/audio.js` | Sound effects, synthesised in WebAudio |

**Modes** — *Classic* (three lives; dropping a fruit or hitting a bomb costs
one) and *Zen* (ninety seconds, no bombs). Best scores are kept per mode in
`localStorage`. `Esc` quits, `Space` restarts, `H` toggles the hand guide,
`M` mutes.

### How it stays responsive

Webcam games usually feel laggy because the blade waits on the detector. This
one doesn't:

- the camera feed is a plain `<video>` **behind** the canvas, so the GPU
  composites it and no pixels are copied per frame;
- detection runs on `requestVideoFrameCallback`, i.e. once per *camera* frame
  rather than once per render frame, and drops to every other frame if
  inference starts costing more than ~20 ms;
- fingertip coordinates go through a **One Euro filter** (smooth when you hold
  still, immediate when you swipe) and are then **extrapolated** to the render
  timestamp, so the blade tracks at display rate even though detection is
  slower;
- collisions use the **swept segment** between two blade samples, measured in
  the fruit's own frame of reference, so fast swipes can't tunnel through;
- every fruit is baked into a cached sprite once and then just blitted, rather
  than re-running a few dozen gradients and paths per fruit per frame.

### Requirements and privacy

Chrome, Edge or Safari, and permission to use the camera. **Video never leaves
the browser** — there is no upload and no recording; frames go straight from
the camera into the tracker in the same tab.

Hand tracking uses Google's MediaPipe HandLandmarker, loaded from a CDN at
runtime because the model plus runtime is roughly 27 MB — too large to commit
here. If the CDN is blocked or the camera is refused, the game says so and
stays fully playable with the mouse or a finger on a touchscreen.

To run it **offline** (kiosk, no CDN), self-host
[`@mediapipe/tasks-vision`](https://www.npmjs.com/package/@mediapipe/tasks-vision)
and the `hand_landmarker.task` model, then set this before the page's script
loads:

```html
<script>
  window.FN_TRACKER_SOURCES = {
    esm:   '/vendor/tasks-vision/vision_bundle.mjs',
    wasm:  '/vendor/tasks-vision/wasm',
    model: '/vendor/hand_landmarker.task',
  };
</script>
```

---

## Editing content — the two files that matter

### 1. `js/config.js` — business details
Phone number, email, Instagram, address, map link, and site behaviour.
Change a value there and it updates **everywhere** on the site.

- `requireLoginForCollections: true` — set to `false` if you ever want the
  public catalogue open without login.

### 2. `data/products.js` — the catalogue
Each product is one block between `{ }`. Copy a block to add a product,
delete a block to remove one. Full instructions are at the top of that file.

Key switches per product:
- `exclusive: true` → shows only in **The Vault**
- `featured: true` → also appears on the home page
- `image: "images/my-photo.jpg"` → put photos in the `images/` folder.
  Until a photo is added (or if it fails to load), an automatic woven-pattern
  placeholder is shown, so the site never looks broken.

**Photo tips:** portrait orientation (4:5), at least 800×1000px, under
~300 KB each (use [squoosh.app](https://squoosh.app) to compress).

---

## Login: demo mode vs. real mode

The site ships in **demo mode** so you can try everything immediately:
accounts are stored in the visitor's own browser (localStorage). A blue
banner at the top reminds you it's a preview. Demo mode is *not* for
production — real visitors on different devices won't share accounts.

### Going live with Firebase (free tier is plenty)

1. Go to [console.firebase.google.com](https://console.firebase.google.com) → **Add project** (name it e.g. `treasure-trove`).
2. In the project: **Build → Authentication → Get started → Sign-in method → Email/Password → Enable**.
3. **Build → Firestore Database → Create database** (production mode, region `asia-south1` / Mumbai).
4. **Project settings (gear icon) → Your apps → Web app (</> icon)** → register the app → copy the `firebaseConfig` object shown.
5. Paste it into `js/config.js` replacing `firebaseConfig: null`.
6. In Firestore → **Rules**, paste:

   ```
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /users/{uid} {
         // each user reads their own profile; only they can create it
         allow read: if request.auth != null && request.auth.uid == uid;
         allow create: if request.auth != null && request.auth.uid == uid
                       // users can never grant themselves approval
                       && request.resource.data.approved == false;
         // profile edits can't touch the approved flag
         allow update: if request.auth != null && request.auth.uid == uid
                       && request.resource.data.approved == resource.data.approved;
       }
     }
   }
   ```

7. In **Authentication → Settings → Authorized domains**, add your website's
   domain once it's live.

The demo banner disappears automatically once Firebase is configured.

### Granting Vault access (you are the gatekeeper)

- **Demo mode:** add the person's email to `demoApprovedEmails` in `js/config.js`.
- **Firebase mode:** open **Firestore → users**, find the person's document
  (searchable by the email field — they'll WhatsApp you their email when
  requesting access), and change `approved` from `false` to `true`.
  Next time they open The Vault, it unlocks. Set it back to `false` to revoke.

> **Honest note on exclusivity:** this is a static site, so "exclusive"
> product data ships inside `data/products.js` — gating hides it from the
> page, and Firebase gates *accounts* properly, but a determined techie could
> read the file. For a boutique catalogue whose real transaction happens on
> WhatsApp, that trade-off is usually fine. If you ever need hard secrecy
> (e.g. secret pricing), the upgrade path is moving products into Firestore
> with security rules — the site is structured so that swap is contained to
> `data/products.js` + `js/products.js`.

---

## Deploying (free)

**GitHub Pages** (simplest): repo **Settings → Pages → Deploy from branch**
→ pick the branch, root folder. Your site appears at
`https://<username>.github.io/<repo>/`.

**Netlify / Vercel:** import the repo, no build command, publish directory
= root. Both give you a custom domain option and handle `404.html`
automatically.

After deploying with Firebase enabled, remember step 7 above (authorized
domains).

---

## Edge cases already handled

- **Traceback after login** — a visitor sent to login from The Vault lands
  back on The Vault afterwards (same for Collections); the redirect target is
  validated so it can never point off-site.
- **Three Vault states** — signed out (locked door), signed in but not
  approved (pending, with a one-tap WhatsApp "request access" message that
  includes their registered email/phone), approved (collection shown).
- **Auth errors in plain English** — wrong password, existing account, weak
  password, rate-limiting, network failure.
- **Phone validation** — accepts `98017 98125`, `09801798125`,
  `+91 98017 98125` etc., normalised to international format.
- **Missing/broken product photos** — automatic branded woven-pattern
  placeholder, never a broken-image icon.
- **Empty category / empty Vault** — friendly message with a WhatsApp nudge
  instead of a blank grid.
- **External links** (`WhatsApp`, Instagram, Maps) open in new tabs with
  `rel="noopener noreferrer"`.
- **Mobile** — full-screen menu, responsive grids, thumb-sized WhatsApp button.
- **Accessibility** — skip link, focus styles, aria labels, keyboard-operable
  cards and lightbox (Esc closes), `prefers-reduced-motion` respected.
- **JS disabled** — visible notice with the WhatsApp number as fallback.
- **Logout on a gated page** — bounces the visitor safely to the home page.

## Project structure

```
├── index.html            Home / story / visit
├── collections.html      Public catalogue (login-gated)
├── vault.html            Exclusive catalogue (approval-gated)
├── login.html            Sign in / register
├── 404.html              Not-found page
├── css/style.css         All styling (design tokens at the top)
├── js/config.js          ★ Business details & settings (edit me)
├── data/products.js      ★ Product catalogue (edit me)
├── js/auth.js            Auth layer (demo + Firebase)
├── js/main.js            Shared UI (nav, reveals, contact injection)
├── js/products.js        Product grids, filters, lightbox, gates
├── js/login.js           Login page behaviour
└── images/               Put product photos here
```
