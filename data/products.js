/* ============================================================
   TREASURE TROVE — PRODUCT CATALOGUE
   ------------------------------------------------------------
   HOW TO EDIT (no coding knowledge needed):

   • To ADD a product: copy any block between { and }, paste it
     below, and change the details. Keep the comma between blocks.
   • To REMOVE a product: delete its whole { ... } block.
   • "id"        → any short unique code (used in WhatsApp enquiries)
   • "category"  → any word you like; filters are built automatically.
                   Current ones: "Carpets", "Banarasi Sarees",
                   "Clothing", "Dupattas & Stoles", "Artifacts"
   • "price"     → a number like 45000, or the text "On Request"
   • "image"     → put a photo in the images/ folder and write
                   "images/your-photo.jpg". Leave "" for an
                   automatic woven-pattern placeholder.
   • "palette"   → placeholder colour when there is no photo:
                   "maroon" | "gold" | "indigo" | "terracotta" | "forest"
   • "exclusive" → true  = shown only in The Vault (approved members)
                   false = shown in public Collections
   • "featured"  → true  = also appears on the home page
   ============================================================ */

window.PRODUCTS = [

  /* ---------------- CARPETS ---------------- */
  {
    id: "TT-C-001",
    name: "Kashan Medallion Hand-Knotted Carpet",
    category: "Carpets",
    price: "On Request",
    size: "8 × 10 ft · Wool & Silk",
    description: "A classic Persian Kashan design, hand-knotted over eleven months. Approximately 400 knots per square inch on a pure silk foundation.",
    image: "",
    palette: "maroon",
    exclusive: false,
    featured: true
  },
  {
    id: "TT-C-002",
    name: "Bhadohi Tree-of-Life Carpet",
    category: "Carpets",
    price: "On Request",
    size: "6 × 9 ft · Pure Wool",
    description: "Woven in Bhadohi, the carpet city of India. The tree-of-life motif rendered in vegetable-dyed wool with a soft ivory field.",
    image: "",
    palette: "forest",
    exclusive: false,
    featured: true
  },
  {
    id: "TT-C-003",
    name: "Antique-Wash Chowbara Runner",
    category: "Carpets",
    price: 68000,
    size: "2.5 × 12 ft · Wool",
    description: "A hallway runner with a geometric chowbara lattice, given a gentle antique wash for a heritage patina.",
    image: "",
    palette: "terracotta",
    exclusive: false,
    featured: false
  },

  /* ------------- BANARASI SAREES ------------- */
  {
    id: "TT-S-001",
    name: "Katan Silk Kadhua Banarasi — Crimson & Gold",
    category: "Banarasi Sarees",
    price: "On Request",
    size: "Pure Katan Silk · Kadhua Weave",
    description: "Woven on a handloom in the lanes of Varanasi. The kadhua technique means every motif is woven individually — no float threads, no shortcuts.",
    image: "",
    palette: "maroon",
    exclusive: false,
    featured: true
  },
  {
    id: "TT-S-002",
    name: "Shikargah Hunting-Scene Banarasi",
    category: "Banarasi Sarees",
    price: "On Request",
    size: "Pure Silk · Real Zari",
    description: "The legendary shikargah pattern — a woven forest of deer, birds and vines in real gold zari. A collector's weave, months on the loom.",
    image: "",
    palette: "forest",
    exclusive: true,
    featured: false
  },
  {
    id: "TT-S-003",
    name: "Jangla Jaal Banarasi — Ivory",
    category: "Banarasi Sarees",
    price: 32000,
    size: "Katan Silk · Cutwork Jaal",
    description: "An ivory field covered edge-to-edge in a flowering jangla jaal, finished with a woven meenakari border.",
    image: "",
    palette: "gold",
    exclusive: false,
    featured: true
  },
  {
    id: "TT-S-004",
    name: "Rangkaat Banarasi — Heirloom Weave",
    category: "Banarasi Sarees",
    price: "On Request",
    size: "Pure Silk · Rangkaat Technique",
    description: "Rangkaat is among the rarest Banarasi techniques alive — panels of colour woven (not dyed) into one another. Fewer than a handful of master weavers still practice it.",
    image: "",
    palette: "indigo",
    exclusive: true,
    featured: false
  },

  /* ---------------- CLOTHING ---------------- */
  {
    id: "TT-CL-001",
    name: "Handloom Silk Bandhgala Jacket",
    category: "Clothing",
    price: 18500,
    size: "Made to Measure",
    description: "A structured bandhgala cut from our own handloom silk, lined in soft mulmul. Tailored to your measurements.",
    image: "",
    palette: "indigo",
    exclusive: false,
    featured: false
  },
  {
    id: "TT-CL-002",
    name: "Chanderi Kurta Set — Dawn Gold",
    category: "Clothing",
    price: 9800,
    size: "Chanderi Silk-Cotton",
    description: "Featherlight Chanderi with a woven gold butti, paired with churidar and a matching stole.",
    image: "",
    palette: "gold",
    exclusive: false,
    featured: false
  },

  /* ------------ DUPATTAS & STOLES ------------ */
  {
    id: "TT-D-001",
    name: "Real Zari Tissue Dupatta",
    category: "Dupattas & Stoles",
    price: 14500,
    size: "Silk × Real Zari Tissue",
    description: "Woven so fine it folds into the palm of a hand. Catches light like beaten gold.",
    image: "",
    palette: "gold",
    exclusive: false,
    featured: true
  },
  {
    id: "TT-D-002",
    name: "Gyaser Brocade Stole — Monastery Blue",
    category: "Dupattas & Stoles",
    price: "On Request",
    size: "Silk Brocade · Gyaser Weave",
    description: "A ceremonial gyaser brocade in deep monastery blue, of the kind historically woven in Varanasi for Himalayan monasteries.",
    image: "",
    palette: "indigo",
    exclusive: true,
    featured: false
  },

  /* ---------------- ARTIFACTS ---------------- */
  {
    id: "TT-A-001",
    name: "Hand-Beaten Brass Urli",
    category: "Artifacts",
    price: 7200,
    size: "16 in · Solid Brass",
    description: "A traditional floating-flower vessel, hand-beaten and hand-polished. Each hammer mark is the maker's signature.",
    image: "",
    palette: "terracotta",
    exclusive: false,
    featured: false
  },
  {
    id: "TT-A-002",
    name: "Carved Sheesham Jharokha Mirror",
    category: "Artifacts",
    price: 12500,
    size: "24 × 36 in · Sheesham Wood",
    description: "A jharokha-style mirror frame hand-carved in sheesham, inspired by the balconies of old haveli architecture.",
    image: "",
    palette: "maroon",
    exclusive: false,
    featured: false
  },
  {
    id: "TT-A-003",
    name: "Vintage Loom Shuttle — Collector's Piece",
    category: "Artifacts",
    price: "On Request",
    size: "Provenance: Varanasi, c. 1960s",
    description: "An original wooden shuttle from a Varanasi pit loom, polished by decades of a weaver's hands. A piece of living history.",
    image: "",
    palette: "forest",
    exclusive: true,
    featured: false
  }
];
