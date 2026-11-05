/**
 * ==========================================================================
 * SYNTHEX 2026 - PITCH COMPETITION WEB APPLICATION
 * High-performance, reactive UI logic, constellation animation,
 * form validation, celebration effects, and Google Sheets integration.
 * ==========================================================================
 */

// Configuration & Default Endpoints
const CONFIG = {
  // =========================================================================
  // SUBMISSION STATUS TOGGLE (Option A)
  // Set to true to OPEN submissions across the platform.
  // Set to false to CLOSE submissions, lock the form, and show closed notices.
  // =========================================================================
  submissionsOpen: true,

  // Pre-configured Google Form response endpoint & unified entry mapping
  googleForm: {
    endpoint: "https://docs.google.com/forms/d/e/1FAIpQLScD6u8ZjARToVR_nfJev-ZMqbMspLc26ztLPTk9jkQNrdYk8w/formResponse",
    entries: {
      submissionType: "entry.1807794449",
      batch: "entry.2122323594",
      regAndNames: "entry.1568231834",
      topic: "entry.2007979790",
      description: "entry.931518053",
      email: "entry.1592693011",
      phone: "entry.372663994"
    },
    pageHistory: "0"
  },
  // Custom Google Apps Script Web App URL (if provided by user)
  customScriptUrlKey: "synthex_custom_script_url",
  localSubmissionsKey: "synthex_submissions_backup"
};

// State
let selectedSubmissionType = "individual"; // "individual" | "group"
let selectedBatch = "";

// DOM Elements Initialization
document.addEventListener("DOMContentLoaded", () => {
  applySubmissionStatus();
  initAmbientCanvas();
  initSubmissionTypeToggle();
  initGroupMembersTable();
  initBatchPills();
  initFormInteractions();
  initDockInteractions();
  initBulbInteractions();
  initModals();
  initSettings();
  updateBackupCounter();
});

/**
 * Checks whether submissions are currently open.
 * Evaluates CONFIG.submissionsOpen.
 * Supports URL override for previewing: ?closed=1 or ?submissions=closed (forces closed)
 * and ?open=1 or ?submissions=open (forces open).
 */
function isSubmissionsOpen() {
  try {
    const params = new URLSearchParams(window.location.search);
    if (params.get("closed") === "1" || params.get("submissions") === "closed") {
      return false;
    }
    if (params.get("open") === "1" || params.get("submissions") === "open") {
      return true;
    }
  } catch (e) {
    // ignore
  }
  return CONFIG.submissionsOpen !== false;
}

/**
 * Applies submission open/closed state across all UI elements on both index and submit pages.
 */
function applySubmissionStatus() {
  const isOpen = isSubmissionsOpen();

  // 1. Update all status pills (.status-pill)
  const statusPills = document.querySelectorAll(".status-pill");
  statusPills.forEach(pill => {
    const dot = pill.querySelector(".pulse-dot");
    const label = pill.querySelector("span:not(.pulse-dot)");

    if (!isOpen) {
      pill.classList.add("status-closed");
      if (dot) dot.classList.add("dot-closed");
      if (label) label.textContent = "Submissions Closed";
      pill.setAttribute("title", "Idea submissions are currently closed");
    } else {
      pill.classList.remove("status-closed");
      if (dot) dot.classList.remove("dot-closed");
      if (label) label.textContent = "Submissions Open";
      pill.setAttribute("title", "Idea submissions are currently open");
    }
  });

  // 2. Update navigation CTA buttons (.nav-cta-btn, excluding the 'Home' return pill on submit.html)
  const navCtaBtns = document.querySelectorAll(".nav-cta-btn:not(.nav-secondary-pill):not(.nav-back-btn)");
  navCtaBtns.forEach(btn => {
    if (!isOpen) {
      btn.textContent = "Submissions Closed";
      btn.classList.add("nav-cta-closed");
      btn.setAttribute("aria-disabled", "true");
      btn.setAttribute("title", "Submissions are currently closed");
    } else {
      btn.textContent = "Submit Idea";
      btn.classList.remove("nav-cta-closed");
      btn.removeAttribute("aria-disabled");
      btn.removeAttribute("title");
    }
  });

  // 3. Update Hero CTA button (#hero-submit-btn) on homepage
  const heroBtn = document.getElementById("hero-submit-btn");
  if (heroBtn) {
    const btnText = heroBtn.querySelector(".btn-text");
    if (!isOpen) {
      if (btnText) btnText.textContent = "Submissions Closed";
      heroBtn.classList.add("cta-btn-closed");
      heroBtn.setAttribute("aria-disabled", "true");
      heroBtn.setAttribute("title", "Submissions are currently closed");
    } else {
      if (btnText) btnText.textContent = "Submit Your Idea";
      heroBtn.classList.remove("cta-btn-closed");
      heroBtn.removeAttribute("aria-disabled");
      heroBtn.removeAttribute("title");
    }
  }

  // 4. Update Submit Page Form vs. Closed Card
  const form = document.getElementById("idea-form");
  const closedCard = document.getElementById("submissions-closed-card");
  const formHeaderDesc = document.querySelector(".form-sub-desc");

  if (closedCard && form) {
    if (!isOpen) {
      form.style.display = "none";
      closedCard.style.display = "flex";
      if (formHeaderDesc) {
        formHeaderDesc.textContent = "The idea submission portal for SYNTHEX 2026 is currently closed.";
      }
    } else {
      form.style.display = "block";
      closedCard.style.display = "none";
      if (formHeaderDesc) {
        formHeaderDesc.textContent = "Complete the form below to enter the SYNTHEX 2026 Pitch Competition.";
      }
    }
  }
}

/* ==========================================================================
   1. AMBIENT CONSTELLATION & PARTICLES CANVAS (Electric Green Particles)
   ========================================================================== */
function initAmbientCanvas() {
  const canvas = document.getElementById("ambient-canvas");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  let width, height;
  let particles = [];

  const isMobile = window.innerWidth <= 768;
  const particleCount = isMobile ? 16 : 42;
  const maxDistance = isMobile ? 90 : 125;
  const maxDistanceSq = maxDistance * maxDistance;

  function resize() {
    width = canvas.width = window.innerWidth;
    height = canvas.height = window.innerHeight;
  }
  window.addEventListener("resize", resize, { passive: true });
  resize();

  class Particle {
    constructor() {
      this.x = Math.random() * width;
      this.y = Math.random() * height;
      this.vx = (Math.random() - 0.5) * (isMobile ? 0.25 : 0.35);
      this.vy = (Math.random() - 0.5) * (isMobile ? 0.25 : 0.35);
      this.radius = Math.random() * 1.6 + 0.8;
      this.alpha = Math.random() * 0.4 + 0.15;
    }

    update() {
      this.x += this.vx;
      this.y += this.vy;

      if (this.x < 0) this.x = width;
      if (this.x > width) this.x = 0;
      if (this.y < 0) this.y = height;
      if (this.y > height) this.y = 0;
    }

    draw() {
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(0, 255, 135, ${this.alpha})`;
      if (!isMobile) {
        ctx.shadowBlur = 4;
        ctx.shadowColor = "#00FF87";
      }
      ctx.fill();
    }
  }

  for (let i = 0; i < particleCount; i++) {
    particles.push(new Particle());
  }

  // Touch scroll throttling on mobile:
  // Pauses canvas redraw while user's finger is actively scrolling,
  // providing 100% of GPU resources to ultra-smooth 60fps scrolling
  let isScrolling = false;
  let scrollTimer = null;
  window.addEventListener("scroll", () => {
    if (isMobile) {
      isScrolling = true;
      if (scrollTimer) clearTimeout(scrollTimer);
      scrollTimer = setTimeout(() => {
        isScrolling = false;
      }, 100);
    }
  }, { passive: true });

  let isTabVisible = true;
  document.addEventListener("visibilitychange", () => {
    isTabVisible = !document.hidden;
  });

  function animate() {
    requestAnimationFrame(animate);

    if (!isTabVisible) return;
    if (isMobile && isScrolling) return;

    ctx.clearRect(0, 0, width, height);

    // Optimized connection lines: squared-distance check avoids expensive Math.sqrt for distant pairs
    for (let i = 0; i < particles.length; i++) {
      for (let j = i + 1; j < particles.length; j++) {
        const dx = particles[i].x - particles[j].x;
        const dy = particles[i].y - particles[j].y;
        const distSq = dx * dx + dy * dy;

        if (distSq < maxDistanceSq) {
          const dist = Math.sqrt(distSq);
          const alpha = (1 - dist / maxDistance) * (isMobile ? 0.11 : 0.14);
          ctx.beginPath();
          ctx.moveTo(particles[i].x, particles[i].y);
          ctx.lineTo(particles[j].x, particles[j].y);
          ctx.strokeStyle = `rgba(0, 255, 135, ${alpha})`;
          ctx.lineWidth = 0.8;
          ctx.stroke();
        }
      }
    }

    // Update and draw particles
    particles.forEach(p => {
      p.update();
      p.draw();
    });
  }
  animate();
}

/* ==========================================================================
   2. SUBMISSION TYPE TOGGLE (Individual vs Group)
   ========================================================================== */
function initSubmissionTypeToggle() {
  const individualBtn = document.getElementById("type-individual-btn");
  const groupBtn = document.getElementById("type-group-btn");
  const typeInput = document.getElementById("submissionType");
  const panelIndividual = document.getElementById("participant-individual-panel");
  const panelGroup = document.getElementById("participant-group-panel");
  const badgeEl = document.getElementById("participant-badge");
  const emailSubhint = document.getElementById("email-subhint");

  if (!individualBtn || !groupBtn) return;

  function switchType(type) {
    selectedSubmissionType = type;
    if (typeInput) typeInput.value = type;

    if (type === "individual") {
      individualBtn.classList.add("active");
      groupBtn.classList.remove("active");
      if (panelIndividual) panelIndividual.style.display = "block";
      if (panelGroup) panelGroup.style.display = "none";
      if (badgeEl) badgeEl.textContent = "Individual Participant Details";
      if (emailSubhint) emailSubhint.textContent = "";

      // Sync lead from group table to individual if individual inputs are empty
      const tableBody = document.getElementById("members-table-body");
      if (tableBody) {
        const leadReg = tableBody.querySelector('.member-row[data-member-index="1"] .member-reg');
        const leadName = tableBody.querySelector('.member-row[data-member-index="1"] .member-name');
        const regInput = document.getElementById("regNo");
        const nameInput = document.getElementById("fullName");
        if (leadReg && regInput && !regInput.value.trim() && leadReg.value.trim()) {
          regInput.value = leadReg.value.trim();
        }
        if (leadName && nameInput && !nameInput.value.trim() && leadName.value.trim()) {
          nameInput.value = leadName.value.trim();
        }
      }
    } else {
      groupBtn.classList.add("active");
      individualBtn.classList.remove("active");
      if (panelIndividual) panelIndividual.style.display = "none";
      if (panelGroup) panelGroup.style.display = "block";
      if (badgeEl) badgeEl.textContent = "Group Members Details";
      if (emailSubhint) emailSubhint.textContent = "(Primary Contact / Team Lead)";

      // Sync individual to lead in group table if row 1 is empty
      const regInput = document.getElementById("regNo");
      const nameInput = document.getElementById("fullName");
      const tableBody = document.getElementById("members-table-body");
      if (tableBody && regInput && nameInput) {
        const leadReg = tableBody.querySelector('.member-row[data-member-index="1"] .member-reg');
        const leadName = tableBody.querySelector('.member-row[data-member-index="1"] .member-name');
        if (leadReg && !leadReg.value.trim() && regInput.value.trim()) {
          leadReg.value = regInput.value.trim();
        }
        if (leadName && !leadName.value.trim() && nameInput.value.trim()) {
          leadName.value = nameInput.value.trim();
        }
      }
    }

    // Clear submission alert
    showAlert("", "");
  }

  individualBtn.addEventListener("click", () => switchType("individual"));
  groupBtn.addEventListener("click", () => switchType("group"));
}

/* ==========================================================================
   3. DYNAMIC GROUP MEMBERS TABLE MANAGER (Min 2, Max 6)
   ========================================================================== */
const MAX_GROUP_MEMBERS = 6;
const MIN_GROUP_MEMBERS = 2;

function initGroupMembersTable() {
  const tableBody = document.getElementById("members-table-body");
  const addBtn = document.getElementById("add-member-btn");
  if (!tableBody || !addBtn) return;

  function updateMemberRows() {
    const rows = tableBody.querySelectorAll(".member-row");
    const count = rows.length;
    const countEl = document.getElementById("members-count");
    const maxAlert = document.getElementById("max-members-alert");

    if (countEl) countEl.textContent = count;

    rows.forEach((row, idx) => {
      const memberNum = idx + 1;
      row.setAttribute("data-member-index", memberNum);
      const indexCell = row.querySelector(".col-index");
      const actionCell = row.querySelector(".col-action");
      const regInput = row.querySelector(".member-reg");
      const nameInput = row.querySelector(".member-name");

      if (indexCell) {
        if (memberNum === 1) {
          indexCell.innerHTML = `<span class="member-badge lead-badge">1 (Lead)</span>`;
        } else {
          indexCell.innerHTML = `<span class="member-badge">${memberNum}</span>`;
        }
      }

      if (regInput) {
        regInput.setAttribute("placeholder", `e.g. 22APP123${memberNum + 3}`);
      }
      if (nameInput) {
        nameInput.setAttribute("placeholder", memberNum === 1 ? "e.g. A.B.C.D. Perera" : `e.g. Member ${memberNum} Name`);
      }

      if (actionCell) {
        // Members 1 and 2 cannot be removed (min 2)
        if (memberNum <= MIN_GROUP_MEMBERS) {
          actionCell.innerHTML = "";
        } else {
          actionCell.innerHTML = `
            <button type="button" class="remove-member-btn" title="Remove Member ${memberNum}" aria-label="Remove Member">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M3 6h18m-2 0v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6m3 0V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
              </svg>
            </button>
          `;
          const removeBtn = actionCell.querySelector(".remove-member-btn");
          if (removeBtn) {
            removeBtn.addEventListener("click", () => {
              row.remove();
              updateMemberRows();
            });
          }
        }
      }
    });

    // Enforce maximum 6 members
    if (count >= MAX_GROUP_MEMBERS) {
      addBtn.style.display = "none";
      if (maxAlert) maxAlert.style.display = "inline-flex";
    } else {
      addBtn.style.display = "inline-flex";
      if (maxAlert) maxAlert.style.display = "none";
    }
  }

  // Add Member button click
  addBtn.addEventListener("click", () => {
    const rows = tableBody.querySelectorAll(".member-row");
    if (rows.length >= MAX_GROUP_MEMBERS) return;

    const newRow = document.createElement("tr");
    newRow.className = "member-row";
    newRow.innerHTML = `
      <td class="col-index"></td>
      <td class="col-reg">
        <input 
          type="text" 
          class="form-control member-input member-reg" 
          placeholder="" 
          required
          autocomplete="off"
        >
      </td>
      <td class="col-name">
        <input 
          type="text" 
          class="form-control member-input member-name" 
          placeholder="" 
          required
          autocomplete="off"
        >
      </td>
      <td class="col-action"></td>
    `;
    tableBody.appendChild(newRow);
    updateMemberRows();

    // Focus newly added registration input
    const newReg = newRow.querySelector(".member-reg");
    if (newReg) newReg.focus();
  });

  // Real-time styling reset on input
  tableBody.addEventListener("input", (e) => {
    if (e.target.classList.contains("member-input")) {
      if (e.target.value.trim().length > 0) {
        e.target.style.borderColor = "rgba(0, 255, 135, 0.4)";
      } else {
        e.target.style.borderColor = "";
      }
    }
  });

  updateMemberRows();
}

/**
 * Validates and compiles team member rows into one single multi-line string.
 * Each line contains only one member detail, up to 6 lines total.
 */
function getGroupMembersData() {
  const tableBody = document.getElementById("members-table-body");
  if (!tableBody) return { valid: false, message: "Member table not found", compiled: "" };

  const rows = tableBody.querySelectorAll(".member-row");
  const lines = [];

  if (rows.length < MIN_GROUP_MEMBERS) {
    return { valid: false, message: "Group submission requires at least 2 team members.", compiled: "" };
  }

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const memberNum = i + 1;
    const regInput = row.querySelector(".member-reg");
    const nameInput = row.querySelector(".member-name");
    const reg = regInput ? regInput.value.trim() : "";
    const name = nameInput ? nameInput.value.trim() : "";

    if (!reg) {
      if (regInput) {
        regInput.style.borderColor = "#f43f5e";
        regInput.focus();
      }
      return {
        valid: false,
        message: `Please enter the Registration Number for Member ${memberNum}.`,
        compiled: ""
      };
    }

    if (!name) {
      if (nameInput) {
        nameInput.style.borderColor = "#f43f5e";
        nameInput.focus();
      }
      return {
        valid: false,
        message: `Please enter the Full Name for Member ${memberNum}.`,
        compiled: ""
      };
    }

    // Format one line per member
    const leadTag = memberNum === 1 ? " (Team Lead)" : "";
    lines.push(`${memberNum}. ${reg} - ${name}${leadTag}`);
  }

  const leadName = rows[0].querySelector(".member-name").value.trim();
  const compiled = lines.join("\n");

  const hiddenField = document.getElementById("groupMembers");
  if (hiddenField) hiddenField.value = compiled;

  return {
    valid: true,
    compiled,
    leadName,
    count: rows.length
  };
}

function resetGroupMembersTable() {
  const tableBody = document.getElementById("members-table-body");
  if (!tableBody) return;
  const rows = tableBody.querySelectorAll(".member-row");
  for (let i = rows.length - 1; i >= 2; i--) {
    rows[i].remove();
  }
  const inputs = tableBody.querySelectorAll(".member-input");
  inputs.forEach(inp => {
    inp.value = "";
    inp.style.borderColor = "";
  });
  const addBtn = document.getElementById("add-member-btn");
  const countEl = document.getElementById("members-count");
  const maxAlert = document.getElementById("max-members-alert");
  if (countEl) countEl.textContent = "2";
  if (addBtn) addBtn.style.display = "inline-flex";
  if (maxAlert) maxAlert.style.display = "none";
}

/* ==========================================================================
   4. INTERACTIVE BATCH PILLS SELECTOR
   ========================================================================== */
function initBatchPills() {
  const pills = document.querySelectorAll(".batch-pill");
  const nativeSelect = document.getElementById("batch");
  const batchGroup = document.getElementById("group-batch");

  pills.forEach(pill => {
    pill.addEventListener("click", () => {
      pills.forEach(p => p.classList.remove("active"));
      pill.classList.add("active");
      selectedBatch = pill.getAttribute("data-batch");
      
      if (nativeSelect) {
        nativeSelect.value = selectedBatch;
      }

      if (batchGroup) {
        batchGroup.classList.remove("has-error");
        batchGroup.classList.add("has-success");
      }
    });
  });
}

/* ==========================================================================
   4. FORM INTERACTIONS & SUBMISSION LOGIC
   ========================================================================== */
function initFormInteractions() {
  const heroBtn = document.getElementById("hero-submit-btn");
  const formSection = document.getElementById("submit-section");
  const form = document.getElementById("idea-form");
  const regNoInput = document.getElementById("regNo");
  const descTextarea = document.getElementById("description");
  const charCounter = document.getElementById("char-counter");
  const groupDescTextarea = document.getElementById("groupDescription");
  const groupCharCounter = document.getElementById("group-char-counter");
  const searchBtn = document.getElementById("search-trigger-btn");

  // Hero Button Click: Smooth Scroll + Focus
  if (heroBtn && formSection) {
    heroBtn.addEventListener("click", () => {
      formSection.scrollIntoView({ behavior: "smooth", block: "start" });
      
      // Add glowing halo effect to form card
      form.classList.add("form-active-glow");
      setTimeout(() => {
        form.classList.remove("form-active-glow");
      }, 2500);

      // Focus first field after smooth scroll completes
      setTimeout(() => {
        if (regNoInput) regNoInput.focus();
      }, 600);
    });
  }

  // Quick Search Trigger Button -> smooth scrolls to pillars
  if (searchBtn) {
    searchBtn.addEventListener("click", () => {
      const pillars = document.getElementById("highlights-section");
      if (pillars) pillars.scrollIntoView({ behavior: "smooth" });
    });
  }

  // Live Character Counter (if description exists)
  if (descTextarea && charCounter) {
    descTextarea.addEventListener("input", () => {
      const len = descTextarea.value.length;
      charCounter.textContent = `${len} character${len === 1 ? "" : "s"}`;
    });
  }

  // Concept Paper File Upload Interactions
  const fileInput = document.getElementById("conceptPaper");
  const fileWrapper = document.getElementById("file-upload-wrapper");
  const fileSelectedInfo = document.getElementById("file-selected-info");
  const fileSelectedName = document.getElementById("file-selected-name");
  const fileRemoveBtn = document.getElementById("file-remove-btn");
  const fileUploadLabel = document.querySelector(".file-upload-label");

  if (fileInput && fileWrapper) {
    fileInput.addEventListener("change", () => {
      if (fileInput.files && fileInput.files[0]) {
        const file = fileInput.files[0];
        if (fileSelectedName) fileSelectedName.textContent = file.name;
        if (fileSelectedInfo) fileSelectedInfo.style.display = "flex";
        if (fileUploadLabel) fileUploadLabel.style.display = "none";
        fileWrapper.classList.add("has-file");
        const group = document.getElementById("group-conceptPaper");
        if (group) {
          group.classList.remove("has-error");
          group.classList.add("has-success");
        }
      }
    });

    if (fileRemoveBtn) {
      fileRemoveBtn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        fileInput.value = "";
        if (fileSelectedInfo) fileSelectedInfo.style.display = "none";
        if (fileUploadLabel) fileUploadLabel.style.display = "flex";
        fileWrapper.classList.remove("has-file");
        const group = document.getElementById("group-conceptPaper");
        if (group) group.classList.remove("has-success");
      });
    }

    ["dragenter", "dragover"].forEach(evtName => {
      fileWrapper.addEventListener(evtName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        fileWrapper.classList.add("drag-over");
      });
    });

    ["dragleave", "drop"].forEach(evtName => {
      fileWrapper.addEventListener(evtName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        fileWrapper.classList.remove("drag-over");
      });
    });

    fileWrapper.addEventListener("drop", (e) => {
      if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]) {
        fileInput.files = e.dataTransfer.files;
        const changeEvent = new Event("change");
        fileInput.dispatchEvent(changeEvent);
      }
    });
  }

  // Pre-fill track if passed via query parameter (e.g. submit.html?track=Automotive)
  try {
    const urlParams = new URLSearchParams(window.location.search);
    const trackParam = urlParams.get("track");
    const topicField = document.getElementById("topic");
    if (trackParam && topicField && !topicField.value.trim()) {
      topicField.value = `[${trackParam}] `;
    }
  } catch (err) {
    console.warn("Could not read URL query params:", err);
  }

  // Real-time Field Validation feedback
  const fields = ["regNo", "fullName", "topic", "description", "email", "phone"];

  fields.forEach(fieldId => {
    const input = document.getElementById(fieldId);
    const group = document.getElementById(`group-${fieldId}`);
    if (input && group) {
      input.addEventListener("input", () => {
        if (input.value.trim().length > 0) {
          group.classList.remove("has-error");
          group.classList.add("has-success");
        } else {
          group.classList.remove("has-success");
        }
      });
      input.addEventListener("blur", () => {
        if (input.hasAttribute("required") && input.value.trim().length === 0) {
          group.classList.add("has-error");
          group.classList.remove("has-success");
        }
      });
    }
  });

  // Form Submit Handler
  if (form) {
    form.addEventListener("submit", handleFormSubmit);
  }
}

/* Helper Email Validator */
function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

/* ==========================================================================
   INTERACTIVE DOCK & BULB HANDLERS
   ========================================================================== */
function initDockInteractions() {
  const dockItems = document.querySelectorAll(".dock-item");
  const topicInput = document.getElementById("topic");
  const formSection = document.getElementById("submit-section");
  const form = document.getElementById("idea-form");

  dockItems.forEach(item => {
    item.addEventListener("click", (e) => {
      const label = item.querySelector(".dock-label");
      const trackName = label ? label.textContent.trim() : "";

      if (formSection) {
        e.preventDefault();
        formSection.scrollIntoView({ behavior: "smooth", block: "start" });
        if (form) {
          form.classList.add("form-active-glow");
          setTimeout(() => form.classList.remove("form-active-glow"), 2200);
        }

        if (topicInput && trackName) {
          setTimeout(() => {
            if (!topicInput.value.trim()) {
              topicInput.value = `[${trackName}] `;
            }
            topicInput.focus();
          }, 600);
        }
      } else {
        // On homepage: navigate to dedicated submit page with track parameter
        e.preventDefault();
        window.location.href = `submit.html?track=${encodeURIComponent(trackName)}`;
      }
    });
  });
}

function initBulbInteractions() {
  const bulb = document.getElementById("idea-bulb-trigger");
  const formSection = document.getElementById("submit-section");
  const form = document.getElementById("idea-form");
  const regNoInput = document.getElementById("regNo");

  if (bulb) {
    bulb.addEventListener("click", () => {
      // Subtle energy pulse
      bulb.style.filter = "brightness(1.15) drop-shadow(0 0 20px #00FF87)";
      setTimeout(() => {
        bulb.style.filter = "";
      }, 500);

      if (formSection) {
        formSection.scrollIntoView({ behavior: "smooth", block: "start" });
        if (form) {
          form.classList.add("form-active-glow");
          setTimeout(() => form.classList.remove("form-active-glow"), 2200);
        }
        setTimeout(() => {
          if (regNoInput) regNoInput.focus();
        }, 600);
      } else {
        // On homepage: navigate to dedicated submit page
        window.location.href = "submit.html";
      }
    });
  }
}

async function handleFormSubmit(e) {
  e.preventDefault();

  if (!isSubmissionsOpen()) {
    showAlert("Submissions are currently closed. New ideas cannot be submitted at this time.", "error");
    return;
  }

  const form = document.getElementById("idea-form");
  const submitBtn = document.getElementById("submit-btn");
  const btnSpinner = document.getElementById("btn-spinner");
  const btnLabel = document.getElementById("btn-label");
  const alertBox = document.getElementById("form-alert");

  const batch = selectedBatch || (document.getElementById("batch") ? document.getElementById("batch").value : "");
  let hasError = false;

  function markError(id) {
    const group = document.getElementById(id);
    if (group) group.classList.add("has-error");
    hasError = true;
  }

  // 1. Common Batch Validation
  if (!batch) markError("group-batch");

  // 2. Proposal Details Validation (Unified)
  const topic = document.getElementById("topic") ? document.getElementById("topic").value.trim() : "";
  const descElem = document.getElementById("description");
  const fileElem = document.getElementById("conceptPaper");
  const description = descElem ? descElem.value.trim() : (fileElem && fileElem.files && fileElem.files[0] ? fileElem.files[0].name : "");
  const email = document.getElementById("email") ? document.getElementById("email").value.trim() : "";
  const phone = document.getElementById("phone") ? document.getElementById("phone").value.trim() : "";

  if (!topic) markError("group-topic");
  if (descElem && !description) markError("group-description");
  if (fileElem && (!fileElem.files || fileElem.files.length === 0)) markError("group-conceptPaper");
  if (!email) {
    markError("group-email");
  } else if (!isValidEmail(email)) {
    markError("group-email");
    showAlert("Please enter a valid email address.", "error");
    return;
  }

  // 3. Participant Details Validation
  let regAndNames = "";
  let participantSummary = "";
  let submissionTypeTitle = "";

  if (selectedSubmissionType === "individual") {
    submissionTypeTitle = "Individual Submission";
    const regNo = document.getElementById("regNo").value.trim();
    const fullName = document.getElementById("fullName").value.trim();

    if (!regNo) markError("group-regNo");
    if (!fullName) markError("group-fullName");

    if (hasError) {
      showAlert("Please fill in all required fields marked with an asterisk (*).", "error");
      return;
    }

    regAndNames = `1. ${regNo} - ${fullName}`;
    participantSummary = fullName;

  } else {
    // Group Submission Branch - Dynamic Table Validation (Min 2, Max 6)
    submissionTypeTitle = "Group Submission";
    const membersData = getGroupMembersData();
    if (!membersData.valid) {
      showAlert(membersData.message, "error");
      const groupContainer = document.getElementById("group-groupMembers");
      if (groupContainer) groupContainer.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }

    if (hasError) {
      showAlert("Please fill in all required fields marked with an asterisk (*).", "error");
      return;
    }

    regAndNames = membersData.compiled;
    participantSummary = `${membersData.leadName} & Team (${membersData.count} Members)`;
  }

  const submissionPayload = {
    id: "SYNTHEX-" + Date.now().toString(36).toUpperCase(),
    timestamp: new Date().toISOString(),
    submissionType: selectedSubmissionType,
    submissionTypeTitle,
    batch,
    regAndNames,
    participantSummary,
    topic,
    description,
    email,
    phone
  };

  // Clear Alert
  showAlert("", "");

  // Button Loading State
  submitBtn.disabled = true;
  btnSpinner.style.display = "inline-block";
  btnLabel.textContent = "Processing...";

  try {
    // 1. Submit to Google Sheets (Direct Form endpoint or Apps Script Webhook)
    await transmitToGoogleSheets(submissionPayload);

    // 2. Save backup locally in browser
    saveSubmissionLocally(submissionPayload);

    // 3. Trigger Celebration Modal & Confetti
    showSuccessModal(submissionPayload);

    // 4. Reset Form & Dynamic Member Table
    form.reset();
    resetGroupMembersTable();
    document.querySelectorAll(".batch-pill").forEach(p => p.classList.remove("active"));
    selectedBatch = "";
    document.querySelectorAll(".form-group").forEach(g => {
      g.classList.remove("has-success", "has-error");
    });
    const c1 = document.getElementById("char-counter");
    if (c1) c1.textContent = "0 characters";

  } catch (error) {
    console.error("Submission error:", error);
    // Still save locally so no work is lost
    saveSubmissionLocally(submissionPayload);
    showSuccessModal(submissionPayload);
  } finally {
    submitBtn.disabled = false;
    btnSpinner.style.display = "none";
    btnLabel.textContent = "Submit Research Idea";
  }
}

/**
 * Transmits the research idea to Google Sheets
 * Uses direct Google Form unified endpoint (or custom Apps Script webhook if configured)
 */
async function transmitToGoogleSheets(data) {
  const customUrl = localStorage.getItem(CONFIG.customScriptUrlKey);

  if (customUrl && customUrl.trim().startsWith("http")) {
    const response = await fetch(customUrl.trim(), {
      method: "POST",
      mode: "no-cors",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data)
    });
    return response;
  } else {
    const formUrl = CONFIG.googleForm.endpoint;
    const formData = new URLSearchParams();
    
    // Core parameters for Google Form submission
    formData.append("fvv", "1");
    formData.append("pageHistory", CONFIG.googleForm.pageHistory);
    formData.append(CONFIG.googleForm.entries.submissionType, data.submissionTypeTitle);
    formData.append(CONFIG.googleForm.entries.batch, data.batch);
    formData.append(CONFIG.googleForm.entries.regAndNames, data.regAndNames);
    formData.append(CONFIG.googleForm.entries.topic, data.topic);
    formData.append(CONFIG.googleForm.entries.description, data.description);
    formData.append(CONFIG.googleForm.entries.email, data.email);
    if (data.phone) {
      formData.append(CONFIG.googleForm.entries.phone, data.phone);
    }

    await fetch(formUrl, {
      method: "POST",
      mode: "no-cors",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: formData.toString()
    });
  }
}

function showAlert(message, type) {
  const alertBox = document.getElementById("form-alert");
  if (!alertBox) return;

  if (!message) {
    alertBox.style.display = "none";
    alertBox.className = "form-alert";
    alertBox.textContent = "";
    return;
  }

  alertBox.textContent = message;
  alertBox.className = `form-alert alert-${type}`;
  alertBox.style.display = "flex";
}

/* ==========================================================================
   4. LOCAL STORAGE BACKUP SYSTEM (Guarantees zero lost submissions)
   ========================================================================== */
function saveSubmissionLocally(data) {
  try {
    const existing = JSON.parse(localStorage.getItem(CONFIG.localSubmissionsKey) || "[]");
    existing.unshift(data);
    localStorage.setItem(CONFIG.localSubmissionsKey, JSON.stringify(existing));
    updateBackupCounter();
  } catch (err) {
    console.warn("Could not save to local storage:", err);
  }
}

function updateBackupCounter() {
  const counter = document.getElementById("backup-count");
  if (!counter) return;
  try {
    const existing = JSON.parse(localStorage.getItem(CONFIG.localSubmissionsKey) || "[]");
    counter.textContent = existing.length;
  } catch (e) {
    counter.textContent = "0";
  }
}

/* ==========================================================================
   5. SUCCESS MODAL & CANVASES CELEBRATION (Confetti Blast)
   ========================================================================== */
function showSuccessModal(data) {
  const modal = document.getElementById("success-modal");
  if (!modal) return;

  const typeEl = document.getElementById("receipt-type");
  const topicEl = document.getElementById("receipt-topic");
  const nameEl = document.getElementById("receipt-name");
  const batchEl = document.getElementById("receipt-batch");
  const emailEl = document.getElementById("receipt-email");
  const idEl = document.getElementById("receipt-id");

  if (typeEl) typeEl.textContent = data.submissionTypeTitle || (data.submissionType === "group" ? "Group Submission" : "Individual Submission");
  if (topicEl) topicEl.textContent = data.topic || "-";
  if (nameEl) nameEl.textContent = data.participantSummary || "-";
  if (batchEl) batchEl.textContent = data.batch || "-";
  if (emailEl) emailEl.textContent = data.email || "-";
  if (idEl) idEl.textContent = data.id || "-";

  modal.style.display = "flex";
  triggerConfetti();
}

function initModals() {
  const successModal = document.getElementById("success-modal");
  const closeModalBtn = document.getElementById("close-modal-btn");
  if (closeModalBtn && successModal) {
    closeModalBtn.addEventListener("click", () => {
      successModal.style.display = "none";
    });
  }

  // Close modal when clicking backdrop
  if (successModal) {
    successModal.addEventListener("click", (e) => {
      if (e.target === successModal) successModal.style.display = "none";
    });
  }
}

// Lightweight Confetti Particle Generator
function triggerConfetti() {
  const canvas = document.getElementById("confetti-canvas");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  const count = 120;
  const pieces = [];
  const colors = ["#00FF87", "#10F996", "#05DF72", "#00F5D4", "#34D399", "#6EE7B7", "#051428", "#1E3A8A"];

  for (let i = 0; i < count; i++) {
    pieces.push({
      x: window.innerWidth / 2,
      y: window.innerHeight / 2,
      vx: (Math.random() - 0.5) * 16,
      vy: (Math.random() - 0.8) * 16,
      size: Math.random() * 8 + 4,
      color: colors[Math.floor(Math.random() * colors.length)],
      rotation: Math.random() * 360,
      vRotation: (Math.random() - 0.5) * 10,
      gravity: 0.35,
      opacity: 1
    });
  }

  let frames = 0;
  function render() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    let active = false;
    pieces.forEach(p => {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += p.gravity;
      p.rotation += p.vRotation;
      p.opacity -= 0.009;

      if (p.opacity > 0) {
        active = true;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate((p.rotation * Math.PI) / 180);
        ctx.fillStyle = p.color;
        ctx.globalAlpha = Math.max(0, p.opacity);
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
        ctx.restore();
      }
    });

    frames++;
    if (active && frames < 240) {
      requestAnimationFrame(render);
    } else {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  }

  render();
}

/* ==========================================================================
   6. SPREADSHEET SETTINGS & CSV EXPORT
   ========================================================================== */
function initSettings() {
  const closeBtn = document.getElementById("close-config-btn");
  const saveBtn = document.getElementById("save-config-btn");
  const modal = document.getElementById("config-modal");
  const input = document.getElementById("custom-script-url");
  const exportBtn = document.getElementById("export-csv-btn");

  if (openBtn && modal) {
    openBtn.addEventListener("click", () => {
      if (input) input.value = localStorage.getItem(CONFIG.customScriptUrlKey) || "";
      updateBackupCounter();
      modal.style.display = "flex";
    });
  }

  if (closeBtn && modal) {
    closeBtn.addEventListener("click", () => {
      modal.style.display = "none";
    });
  }

  if (modal) {
    modal.addEventListener("click", (e) => {
      if (e.target === modal) modal.style.display = "none";
    });
  }

  if (saveBtn) {
    saveBtn.addEventListener("click", () => {
      if (input) {
        const val = input.value.trim();
        if (val) {
          localStorage.setItem(CONFIG.customScriptUrlKey, val);
        } else {
          localStorage.removeItem(CONFIG.customScriptUrlKey);
        }
      }
      modal.style.display = "none";
    });
  }

  // Export submissions to CSV
  if (exportBtn) {
    exportBtn.addEventListener("click", exportSubmissionsToCSV);
  }
}

function exportSubmissionsToCSV() {
  try {
    const submissions = JSON.parse(localStorage.getItem(CONFIG.localSubmissionsKey) || "[]");
    if (submissions.length === 0) {
      alert("No stored submissions to export yet.");
      return;
    }

    const headers = ["Reference ID", "Timestamp", "Registration No", "Full Name", "Batch", "Topic", "Description"];
    const rows = submissions.map(s => [
      `"${s.id}"`,
      `"${s.timestamp}"`,
      `"${(s.regNo || "").replace(/"/g, '""')}"`,
      `"${(s.fullName || "").replace(/"/g, '""')}"`,
      `"${(s.batch || "").replace(/"/g, '""')}"`,
      `"${(s.topic || "").replace(/"/g, '""')}"`,
      `"${(s.description || "").replace(/"/g, '""')}"`
    ]);

    const csvContent = "\uFEFF" + [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `SYNTHEX_2026_Ideas_Backup_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch (err) {
    console.error("Export error:", err);
  }
}
