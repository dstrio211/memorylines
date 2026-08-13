const gallery = document.querySelector("#gallery");
const memoryCount = document.querySelector("#memoryCount");
const addButton = document.querySelector("#addButton");
const emptyState = document.querySelector("#emptyState");

const viewer = document.querySelector("#viewer");
const viewerBackdrop = document.querySelector(".viewer-backdrop");
const viewerScroll = document.querySelector("#viewerScroll");
const viewerClose = document.querySelector("#viewerClose");
const viewerDelete = document.querySelector("#viewerDelete");
const viewerHint = document.querySelector("#viewerHint");
const viewerChrome = document.querySelector("#viewerChrome");
const viewerBoundary = document.querySelector("#viewerBoundary");
const viewerProgress = document.querySelector("#viewerProgress");

const sharedTransition = document.querySelector("#sharedTransition");
const sharedTransitionImg = document.querySelector("#sharedTransitionImg");

const sheet = document.querySelector("#sheet");
const closeSheet = document.querySelector("#closeSheet");
const cancel = document.querySelector("#cancel");
const photoInput = document.querySelector("#photoInput");
const titleInput = document.querySelector("#titleInput");
const preview = document.querySelector("#preview");
const previewImg = document.querySelector("#previewImg");
const save = document.querySelector("#save");

/* =========================================
   DELETE SHEET
========================================= */

const deleteSheet = document.querySelector("#deleteSheet");
const deletePassword = document.querySelector("#deletePassword");
const deleteError = document.querySelector("#deleteError");
const deleteCancel = document.querySelector("#deleteCancel");
const deleteConfirm = document.querySelector("#deleteConfirm");


/* =========================================
   MEMORY DATA
========================================= */

const memories = [];


/* =========================================
   SUPABASE
========================================= */

const supabaseConfig = window.MEMORY_GALLERY_SUPABASE || {};

const SUPABASE_CONFIGURED =
  typeof window.supabase?.createClient === "function" &&
  /^https:\/\/[^\s]+/.test(supabaseConfig.url || "") &&
  supabaseConfig.publishableKey &&
  !supabaseConfig.publishableKey.startsWith("YOUR_");

const supabaseClient = SUPABASE_CONFIGURED
  ? window.supabase.createClient(
      supabaseConfig.url,
      supabaseConfig.publishableKey,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false
        }
      }
    )
  : null;


/* =========================================
   STATE
========================================= */

let activeIndex = 0;
let viewerOpen = false;
let hintDismissed = false;
let dragStartY = null;
let draggingBoundary = false;
let closing = false;
let quietTimer = null;
let tapStart = 0;
let boundaryPull = 0;
let previewObjectUrl = null;
let loadingMemories = false;
let savingMemory = false;
let deletingMemory = false;


/* =========================================
   HELPERS
========================================= */

function pad(n) {
  return String(n).padStart(2, "0");
}


function setLoadingState(isLoading) {
  loadingMemories = isLoading;

  if (addButton) {
    addButton.disabled = isLoading;
    addButton.setAttribute("aria-busy", String(isLoading));
  }
}


function showDataError(message) {
  console.error(`[Memory Gallery] ${message}`);
}


/* =========================================
   SUPABASE IMAGE URL
========================================= */

function publicImageUrl(storagePath) {
  if (!supabaseClient || !storagePath) return "";

  const { data } = supabaseClient.storage
    .from(supabaseConfig.bucket)
    .getPublicUrl(storagePath);

  return data?.publicUrl || "";
}


/* =========================================
   GALLERY
========================================= */

function renderGallery() {
  gallery.innerHTML = "";

  memoryCount.textContent = `${pad(memories.length)} / 24`;

  if (emptyState) {
    emptyState.hidden = memories.length > 0;
  }

  memories.forEach((memory, index) => {
    const button = document.createElement("button");

    button.className = "tile";
    button.type = "button";
    button.setAttribute(
      "aria-label",
      `Open ${memory.title || "memory"}`
    );

    button.addEventListener("click", () => {
      openViewer(index, button);
    });

    const img = document.createElement("img");

    img.src = memory.src;
    img.alt = memory.title || "Memory";
    img.loading = "lazy";
    img.decoding = "async";

    button.append(img);
    gallery.append(button);
  });
}


/* =========================================
   VIEWER
========================================= */

function buildViewer() {
  viewerScroll.innerHTML = "";

  memories.forEach((memory, index) => {
    const card = document.createElement("article");

    card.className = "viewer-card";
    card.dataset.index = index;

    const wrap = document.createElement("div");
    wrap.className = "viewer-photo-wrap";

    const img = document.createElement("img");

    img.className = "viewer-photo";
    img.src = memory.src;
    img.alt = memory.title || "Memory";
    img.decoding = "async";

    wrap.append(img);

    if (memory.title) {
      card.classList.add("has-caption");

      const fade = document.createElement("div");
      fade.className = "viewer-caption-fade";

      wrap.append(fade);

      const caption = document.createElement("div");
      caption.className = "viewer-title";
      caption.textContent = memory.title;

      wrap.append(caption);
    }

    card.append(wrap);
    viewerScroll.append(card);
  });

  setBackdrop(activeIndex);
  updateViewerProgress();
}


function setBackdrop(index) {
  const memory = memories[index];

  if (!memory) return;

  viewerBackdrop.style.backgroundImage =
    `url("${memory.src}")`;
}


function updateViewerProgress() {
  if (!viewerProgress) return;

  if (!memories.length) {
    viewerProgress.textContent = "00 / 00";
    return;
  }

  viewerProgress.textContent =
    `${pad(activeIndex + 1)} / ${pad(memories.length)}`;
}


function updateViewerFromScroll() {
  const cards = [
    ...viewerScroll.querySelectorAll(".viewer-card")
  ];

  if (!cards.length) return;

  const center =
    viewerScroll.scrollTop +
    viewerScroll.clientHeight / 2;

  let nearest = 0;
  let distance = Infinity;

  cards.forEach((card, index) => {
    const cardCenter =
      card.offsetTop +
      card.offsetHeight / 2;

    const d = Math.abs(center - cardCenter);

    if (d < distance) {
      distance = d;
      nearest = index;
    }
  });

  if (nearest !== activeIndex) {
    activeIndex = nearest;

    setActiveCard(activeIndex);
    setBackdrop(activeIndex);
    updateViewerProgress();

    hintDismissed = true;

    viewer.classList.add("has-scrolled");
  }

  if (
    viewerScroll.scrollTop > 30 &&
    !hintDismissed
  ) {
    hintDismissed = true;
    viewer.classList.add("has-scrolled");
  }
}


function setActiveCard(index) {
  viewerScroll
    .querySelectorAll(".viewer-card")
    .forEach((card, i) => {
      card.classList.toggle(
        "is-active",
        i === index
      );
    });
}


/* =========================================
   SHARED OPEN TRANSITION
========================================= */

function sharedOpenTransition(tile, index) {
  const img = tile?.querySelector("img");

  if (!img) {
    return Promise.resolve();
  }

  const rect = img.getBoundingClientRect();

  sharedTransitionImg.src =
    memories[index].src;

  Object.assign(sharedTransition.style, {
    left: `${rect.left}px`,
    top: `${rect.top}px`,
    width: `${rect.width}px`,
    height: `${rect.height}px`,
    opacity: "1"
  });

  sharedTransition.classList.add("active");

  return new Promise(resolve => {
    requestAnimationFrame(() => {
      const targetImg =
        viewerScroll
          .querySelectorAll(".viewer-card")[index]
          ?.querySelector(".viewer-photo");

      if (!targetImg) {
        resolve();
        return;
      }

      const before =
        targetImg.getBoundingClientRect();

      Object.assign(sharedTransition.style, {
        left: `${before.left}px`,
        top: `${before.top}px`,
        width: `${before.width}px`,
        height: `${before.height}px`
      });

      setTimeout(resolve, 650);
    });
  });
}


function clearSharedTransition() {
  sharedTransition.classList.remove("active");
  sharedTransition.style.opacity = "0";
}


/* =========================================
   VIEWER CHROME
========================================= */

function showViewerChrome() {
  viewer.classList.remove("is-quiet");

  clearTimeout(quietTimer);

  quietTimer = setTimeout(() => {
    viewer.classList.add("is-quiet");
  }, 3200);
}


function toggleViewerChrome() {
  if (viewer.classList.contains("is-quiet")) {
    showViewerChrome();
  } else {
    viewer.classList.add("is-quiet");
    clearTimeout(quietTimer);
  }
}


/* =========================================
   OPEN VIEWER
========================================= */

async function openViewer(index, tile) {
  if (!memories[index]) return;

  activeIndex = index;
  viewerOpen = true;
  hintDismissed = false;
  closing = false;

  viewer.classList.remove(
    "has-scrolled",
    "is-quiet"
  );

  showViewerChrome();

  buildViewer();
  setActiveCard(activeIndex);
  updateViewerProgress();

  viewer.classList.add("open");
  viewer.setAttribute(
    "aria-hidden",
    "false"
  );

  document.body.style.overflow = "hidden";

  requestAnimationFrame(() => {
    viewerScroll
      .querySelectorAll(".viewer-card")[index]
      ?.scrollIntoView({
        block: "start"
      });
  });

  await new Promise(resolve =>
    requestAnimationFrame(() =>
      requestAnimationFrame(resolve)
    )
  );

  await sharedOpenTransition(
    tile,
    index
  );

  clearSharedTransition();
}


/* =========================================
   CLOSE VIEWER
========================================= */

async function closeViewer() {
  if (!viewerOpen || closing) return;

  closing = true;

  const cards = [
    ...viewerScroll.querySelectorAll(".viewer-card")
  ];

  const activeCard = cards[activeIndex];

  const activeImg =
    activeCard?.querySelector(".viewer-photo");

  const tile =
    gallery.querySelectorAll(".tile")[activeIndex];

  if (activeImg && tile) {
    const from =
      activeImg.getBoundingClientRect();

    const tileImg =
      tile.querySelector("img");

    const to =
      tileImg.getBoundingClientRect();

    sharedTransitionImg.src =
      memories[activeIndex].src;

    Object.assign(sharedTransition.style, {
      left: `${from.left}px`,
      top: `${from.top}px`,
      width: `${from.width}px`,
      height: `${from.height}px`,
      opacity: "1"
    });

    sharedTransition.classList.add("active");

    viewer.classList.remove("open");

    await new Promise(resolve => {
      requestAnimationFrame(() => {
        Object.assign(sharedTransition.style, {
          left: `${to.left}px`,
          top: `${to.top}px`,
          width: `${to.width}px`,
          height: `${to.height}px`
        });

        setTimeout(resolve, 620);
      });
    });
  } else {
    viewer.classList.remove("open");
  }

  clearSharedTransition();

  viewer.setAttribute(
    "aria-hidden",
    "true"
  );

  document.body.style.overflow = "";

  viewerOpen = false;
  closing = false;
}


/* =========================================
   LOAD MEMORIES
========================================= */

async function loadMemories() {
  if (!SUPABASE_CONFIGURED) {
    renderGallery();

    showDataError(
      "Supabase is not configured. Edit supabase-config.js with your project URL and Publishable key."
    );

    return;
  }

  setLoadingState(true);

  try {
    const {
      data,
      error
    } = await supabaseClient
      .from(supabaseConfig.table)
      .select(
        "id,title,storage_path,created_at"
      )
      .order(
        "created_at",
        { ascending: true }
      )
      .order(
        "id",
        { ascending: true }
      );

    if (error) throw error;

    memories.length = 0;

    (data || []).forEach(row => {
      const src =
        publicImageUrl(
          row.storage_path
        );

      if (src) {
        memories.push({
          id: row.id,
          title:
            row.title?.trim() || "",
          storagePath:
            row.storage_path,
          createdAt:
            row.created_at,
          src
        });
      }
    });

    renderGallery();

  } catch (error) {
    showDataError(
      `Could not load memories: ${
        error.message || error
      }`
    );

    renderGallery();

  } finally {
    setLoadingState(false);
  }
}


/* =========================================
   STORAGE PATH
========================================= */

function makeStoragePath(file) {
  const mimeExtension = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif",
    "image/heic": "heic",
    "image/heif": "heif",
    "image/avif": "avif",
    "image/bmp": "bmp",
    "image/tiff": "tiff"
  };

  const originalExtension =
    (
      file.name
        ?.split(".")
        .pop() || ""
    )
      .toLowerCase()
      .replace(
        /[^a-z0-9]/g,
        ""
      );

  const extension =
    mimeExtension[file.type] ||
    originalExtension ||
    "jpg";

  const id =
    crypto.randomUUID
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random()
          .toString(16)
          .slice(2)}`;

  return `${id}.${extension}`;
}


/* =========================================
   UPLOAD TO SUPABASE
========================================= */

async function saveMemoryToSupabase(
  file,
  title
) {
  if (!SUPABASE_CONFIGURED) {
    throw new Error(
      "Supabase is not configured. Add your project URL and Publishable key to supabase-config.js first."
    );
  }

  const storagePath =
    makeStoragePath(file);

  const {
    error: uploadError
  } = await supabaseClient.storage
    .from(supabaseConfig.bucket)
    .upload(
      storagePath,
      file,
      {
        contentType:
          file.type || undefined,
        cacheControl:
          "31536000",
        upsert: false
      }
    );

  if (uploadError) {
    throw uploadError;
  }

  const {
    data,
    error: insertError
  } = await supabaseClient
    .from(supabaseConfig.table)
    .insert({
      title:
        title || null,
      storage_path:
        storagePath
    })
    .select(
      "id,title,storage_path,created_at"
    )
    .single();

  if (insertError) {
    /* If database insert fails,
       remove the uploaded file. */

    await supabaseClient.storage
      .from(supabaseConfig.bucket)
      .remove([storagePath]);

    throw insertError;
  }

  return {
    id: data.id,
    title:
      data.title?.trim() || "",
    storagePath:
      data.storage_path,
    createdAt:
      data.created_at,
    src:
      publicImageUrl(
        data.storage_path
      )
  };
}


/* =========================================
   DELETE MEMORY FROM SUPABASE
========================================= */

async function deleteMemoryFromSupabase(
  memory
) {
  if (!SUPABASE_CONFIGURED) {
    throw new Error(
      "Supabase is not configured."
    );
  }

  if (!memory?.id) {
    throw new Error(
      "This memory does not have a valid database ID."
    );
  }

  if (!memory?.storagePath) {
    throw new Error(
      "This memory does not have a valid storage path."
    );
  }

  /*
   * First delete the database record.
   */

  const {
    error: databaseError
  } = await supabaseClient
    .from(supabaseConfig.table)
    .delete()
    .eq("id", memory.id);

  if (databaseError) {
    throw databaseError;
  }

  /*
   * Then delete the actual image
   * from Supabase Storage.
   */

  const {
    error: storageError
  } = await supabaseClient.storage
    .from(supabaseConfig.bucket)
    .remove([
      memory.storagePath
    ]);

  if (storageError) {
    console.error(
      "Database record deleted, but storage file could not be deleted:",
      storageError
    );

    /*
     * The database record is already gone.
     * We report the storage problem but don't
     * recreate the database record automatically.
     */
    throw new Error(
      `Memory record deleted, but the image file could not be removed from storage: ${
        storageError.message || storageError
      }`
    );
  }

  return true;
}


/* =========================================
   DELETE UI
========================================= */

function openDeleteSheet() {
  if (!viewerOpen) return;

  if (!memories[activeIndex]) {
    return;
  }

  if (deletingMemory) {
    return;
  }

  deleteError.textContent = "";
  deletePassword.value = "";

  deleteSheet.classList.add("open");

  deleteSheet.setAttribute(
    "aria-hidden",
    "false"
  );

  /*
   * Keep the viewer underneath,
   * but prevent interactions with it.
   */

  setTimeout(() => {
    deletePassword.focus();
  }, 100);
}


function closeDeleteSheet() {
  if (deletingMemory) return;

  deleteSheet.classList.remove("open");

  deleteSheet.setAttribute(
    "aria-hidden",
    "true"
  );

  deleteError.textContent = "";
  deletePassword.value = "";
}


/* =========================================
   DELETE PASSWORD
========================================= */

function getDeletePassword() {
  /*
   * Recommended:
   *
   * In supabase-config.js you can add:
   *
   * deletePassword: "YOUR_PASSWORD"
   *
   * Example:
   *
   * window.MEMORY_GALLERY_SUPABASE = {
   *   url: "...",
   *   publishableKey: "...",
   *   bucket: "memories",
   *   table: "memories",
   *   deletePassword: "1234"
   * };
   */

  return (
    supabaseConfig.deletePassword ||
    window.MEMORY_GALLERY_DELETE_PASSWORD ||
    ""
  );
}


/* =========================================
   CONFIRM DELETE
========================================= */

async function confirmDelete() {
  if (deletingMemory) return;

  const memory =
    memories[activeIndex];

  if (!memory) {
    deleteError.textContent =
      "No memory is selected.";

    return;
  }

  const enteredPassword =
    deletePassword.value;

  const expectedPassword =
    getDeletePassword();

  /*
   * Password must be configured.
   */

  if (!expectedPassword) {
    deleteError.textContent =
      "Delete password is not configured.";

    return;
  }

  /*
   * Check password.
   */

  if (
    enteredPassword !==
    expectedPassword
  ) {
    deleteError.textContent =
      "Incorrect password.";

    deletePassword.select();

    return;
  }

  deletingMemory = true;

  deleteConfirm.disabled = true;
  deleteCancel.disabled = true;

  deleteConfirm.setAttribute(
    "aria-busy",
    "true"
  );

  deleteError.textContent =
    "Deleting memory...";

  try {
    /*
     * Delete from Supabase.
     */

    await deleteMemoryFromSupabase(
      memory
    );

    /*
     * Remove from local array.
     */

    memories.splice(
      activeIndex,
      1
    );

    /*
     * Close delete sheet.
     */

    deleteSheet.classList.remove(
      "open"
    );

    deleteSheet.setAttribute(
      "aria-hidden",
      "true"
    );

    /*
     * Close viewer without
     * trying to animate the deleted
     * image back into the gallery.
     */

    viewer.classList.remove("open");

    viewer.setAttribute(
      "aria-hidden",
      "true"
    );

    clearSharedTransition();

    document.body.style.overflow = "";

    viewerOpen = false;
    closing = false;

    /*
     * Reset active index.
     */

    if (memories.length === 0) {
      activeIndex = 0;
    } else if (
      activeIndex >= memories.length
    ) {
      activeIndex =
        memories.length - 1;
    }

    /*
     * Re-render everything.
     */

    renderGallery();

    /*
     * Clear viewer.
     */

    viewerScroll.innerHTML = "";

    /*
     * Reset delete UI.
     */

    deletePassword.value = "";
    deleteError.textContent = "";

  } catch (error) {
    console.error(
      "[Memory Gallery] Delete failed:",
      error
    );

    deleteError.textContent =
      error.message ||
      "Could not delete this memory.";

  } finally {
    deletingMemory = false;

    deleteConfirm.disabled = false;
    deleteCancel.disabled = false;

    deleteConfirm.setAttribute(
      "aria-busy",
      "false"
    );
  }
}


/* =========================================
   VIEWER EVENTS
========================================= */

viewerScroll.addEventListener(
  "scroll",
  updateViewerFromScroll,
  { passive: true }
);


/*
 * CLOSE BUTTON
 */

viewerClose.addEventListener(
  "click",
  event => {
    event.preventDefault();
    event.stopPropagation();

    closeViewer();
  }
);


/*
 * DELETE BUTTON
 *
 * IMPORTANT:
 * stopPropagation() prevents the
 * viewer's general click handler
 * from running.
 */

if (viewerDelete) {
  viewerDelete.addEventListener(
    "click",
    event => {
      event.preventDefault();
      event.stopPropagation();

      openDeleteSheet();
    }
  );
}


/*
 * BACKDROP CLOSE
 */

viewerBackdrop.addEventListener(
  "click",
  event => {
    event.preventDefault();
    event.stopPropagation();

    closeViewer();
  }
);


/* =========================================
   DELETE SHEET EVENTS
========================================= */

if (deleteCancel) {
  deleteCancel.addEventListener(
    "click",
    event => {
      event.preventDefault();
      event.stopPropagation();

      closeDeleteSheet();
    }
  );
}


if (deleteConfirm) {
  deleteConfirm.addEventListener(
    "click",
    event => {
      event.preventDefault();
      event.stopPropagation();

      confirmDelete();
    }
  );
}


if (deleteSheet) {
  const deleteScrim =
    deleteSheet.querySelector(
      ".delete-scrim"
    );

  if (deleteScrim) {
    deleteScrim.addEventListener(
      "click",
      event => {
        event.preventDefault();
        event.stopPropagation();

        closeDeleteSheet();
      }
    );
  }
}


/* =========================================
   KEYBOARD
========================================= */

document.addEventListener(
  "keydown",
  event => {

    if (event.key === "Escape") {

      if (
        deleteSheet?.classList.contains(
          "open"
        )
      ) {
        closeDeleteSheet();
        return;
      }

      if (viewerOpen) {
        closeViewer();
        return;
      }

      if (
        sheet.classList.contains(
          "open"
        )
      ) {
        close();
      }
    }


    if (
      viewerOpen &&
      !deleteSheet?.classList.contains(
        "open"
      ) &&
      (
        event.key === "ArrowDown" ||
        event.key === "ArrowRight"
      )
    ) {
      viewerScroll
        .querySelectorAll(
          ".viewer-card"
        )
        [
          Math.min(
            memories.length - 1,
            activeIndex + 1
          )
        ]
        ?.scrollIntoView({
          behavior: "smooth",
          block: "start"
        });
    }


    if (
      viewerOpen &&
      !deleteSheet?.classList.contains(
        "open"
      ) &&
      (
        event.key === "ArrowUp" ||
        event.key === "ArrowLeft"
      )
    ) {
      viewerScroll
        .querySelectorAll(
          ".viewer-card"
        )
        [
          Math.max(
            0,
            activeIndex - 1
          )
        ]
        ?.scrollIntoView({
          behavior: "smooth",
          block: "start"
        });
    }
  }
);


/* =========================================
   BOUNDARY DRAG
========================================= */

function startBoundaryDrag(
  clientY
) {
  if (!viewerOpen) return;

  const atTop =
    activeIndex === 0 &&
    viewerScroll.scrollTop <= 2;

  const atBottom =
    activeIndex ===
      memories.length - 1 &&
    Math.ceil(
      viewerScroll.scrollTop +
      viewerScroll.clientHeight
    ) >=
      viewerScroll.scrollHeight - 2;

  if (!atTop && !atBottom) return;

  dragStartY = clientY;
  draggingBoundary = true;
}


function updateBoundaryDrag(
  clientY
) {
  if (
    !draggingBoundary ||
    dragStartY == null
  ) {
    return;
  }

  const delta =
    clientY - dragStartY;

  const atTop =
    activeIndex === 0;

  const pull = atTop
    ? Math.max(0, delta)
    : Math.max(0, -delta);

  if (pull > 8) {
    viewerBoundary.classList.toggle(
      "visible",
      pull > 55
    );

    viewerBoundary.style.transform =
      `translate(-50%, -50%) scale(${
        Math.min(
          1.06,
          0.94 + pull / 400
        )
      })`;
  }
}


async function endBoundaryDrag(
  clientY
) {
  if (!draggingBoundary) return;

  const atTop =
    activeIndex === 0;

  const delta =
    clientY - dragStartY;

  const pull = atTop
    ? Math.max(0, delta)
    : Math.max(0, -delta);

  dragStartY = null;
  draggingBoundary = false;

  viewerBoundary.classList.remove(
    "visible"
  );

  viewerBoundary.style.transform =
    "translate(-50%,-50%) scale(.94)";

  if (pull > 90) {
    await closeViewer();
  }
}


/* =========================================
   PULL CLASSES
========================================= */

function setPullClass(
  direction,
  pull
) {
  viewerScroll.classList.toggle(
    "is-pulling-top",
    direction === "top" &&
      pull > 8
  );

  viewerScroll.classList.toggle(
    "is-pulling-bottom",
    direction === "bottom" &&
      pull > 8
  );

  viewerBoundary.classList.toggle(
    "visible",
    pull > 55
  );

  viewerBoundary.style.transform =
    `translate(-50%,-50%) scale(${
      Math.min(
        1.06,
        0.94 + pull / 400
      )
    })`;
}


function resetPullClass() {
  viewerScroll.classList.remove(
    "is-pulling-top",
    "is-pulling-bottom"
  );

  viewerBoundary.classList.remove(
    "visible"
  );

  viewerBoundary.style.transform =
    "translate(-50%,-50%) scale(.94)";
}


/* =========================================
   TOUCH EVENTS
========================================= */

viewerScroll.addEventListener(
  "touchstart",
  event => {
    tapStart = Date.now();

    startBoundaryDrag(
      event.touches[0].clientY
    );
  },
  { passive: true }
);


viewerScroll.addEventListener(
  "touchmove",
  event => {
    updateBoundaryDrag(
      event.touches[0].clientY
    );

    if (
      draggingBoundary &&
      dragStartY != null
    ) {
      const delta =
        event.touches[0].clientY -
        dragStartY;

      const atTop =
        activeIndex === 0;

      const pull = atTop
        ? Math.max(0, delta)
        : Math.max(0, -delta);

      boundaryPull = pull;

      setPullClass(
        atTop
          ? "top"
          : "bottom",
        pull
      );
    }
  },
  { passive: true }
);


viewerScroll.addEventListener(
  "touchend",
  event => {
    endBoundaryDrag(
      event.changedTouches[0].clientY
    );

    boundaryPull = 0;

    resetPullClass();
  },
  { passive: true }
);


/* =========================================
   VIEWER MOUSE
========================================= */

viewer.addEventListener(
  "mousemove",
  () => {
    if (viewerOpen) {
      showViewerChrome();
    }
  },
  { passive: true }
);


/*
 * GENERAL VIEWER CLICK
 *
 * IMPORTANT:
 * The delete and close buttons are
 * explicitly ignored here.
 */

viewer.addEventListener(
  "click",
  event => {
    if (!viewerOpen) return;

    if (
      event.target.closest(
        "#viewerDelete"
      )
    ) {
      return;
    }

    if (
      event.target.closest(
        "#viewerClose"
      )
    ) {
      return;
    }

    toggleViewerChrome();
  }
);


/* =========================================
   UPLOAD SHEET
========================================= */

function openSheet() {
  if (
    loadingMemories ||
    savingMemory
  ) {
    return;
  }

  sheet.classList.add("open");

  sheet.setAttribute(
    "aria-hidden",
    "false"
  );

  document.body.style.overflow =
    "hidden";
}


function close() {
  if (savingMemory) return;

  sheet.classList.remove("open");

  sheet.setAttribute(
    "aria-hidden",
    "true"
  );

  document.body.style.overflow =
    "";

  photoInput.value = "";
  titleInput.value = "";

  preview.hidden = true;

  if (previewObjectUrl) {
    URL.revokeObjectURL(
      previewObjectUrl
    );

    previewObjectUrl = null;
  }

  previewImg.removeAttribute(
    "src"
  );
}


/* =========================================
   UPLOAD EVENTS
========================================= */

addButton.addEventListener(
  "click",
  openSheet
);


closeSheet.addEventListener(
  "click",
  close
);


cancel.addEventListener(
  "click",
  close
);


sheet
  .querySelector(".sheet-scrim")
  .addEventListener(
    "click",
    close
  );


/* =========================================
   PHOTO PREVIEW
========================================= */

photoInput.addEventListener(
  "change",
  () => {
    const file =
      photoInput.files?.[0];

    if (!file) return;

    if (
      !file.type.startsWith(
        "image/"
      )
    ) {
      photoInput.value = "";

      showDataError(
        "Please choose an image file."
      );

      return;
    }

    if (previewObjectUrl) {
      URL.revokeObjectURL(
        previewObjectUrl
      );
    }

    previewObjectUrl =
      URL.createObjectURL(file);

    previewImg.src =
      previewObjectUrl;

    preview.hidden = false;
  }
);


/* =========================================
   SAVE / UPLOAD
========================================= */

save.addEventListener(
  "click",
  async () => {

    const file =
      photoInput.files?.[0];

    if (!file) {
      photoInput.click();
      return;
    }

    if (savingMemory) return;

    savingMemory = true;

    save.disabled = true;

    save.setAttribute(
      "aria-busy",
      "true"
    );

    try {
      const title =
        titleInput.value.trim();

      const memory =
        await saveMemoryToSupabase(
          file,
          title
        );

      memories.push(memory);

      memories.sort((a, b) => {
        const timeA =
          Date.parse(
            a.createdAt
          ) || 0;

        const timeB =
          Date.parse(
            b.createdAt
          ) || 0;

        return (
          timeA - timeB ||
          String(a.id).localeCompare(
            String(b.id)
          )
        );
      });

      renderGallery();

      close();

    } catch (error) {
      showDataError(
        `Could not save memory: ${
          error.message || error
        }`
      );

      alert(
        `Could not upload photo:\n\n${
          error.message || error
        }`
      );

    } finally {
      savingMemory = false;

      save.disabled = false;

      save.setAttribute(
        "aria-busy",
        "false"
      );
    }
  }
);


/* =========================================
   INITIALIZE
========================================= */

renderGallery();
loadMemories();
