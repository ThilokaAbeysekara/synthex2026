/**
 * ==========================================================================
 * SYNTHEX 2026 - PITCH COMPETITION WEB APPLICATION
 * High-performance, reactive UI logic, constellation animation,
 * form validation, celebration effects, and private Supabase submissions.
 * ==========================================================================
 */

// Submission data is sent only to Supabase. Public config is built from env.
const CONFIG = { submissionsOpen: true, maxFileSize: 10 * 1024 * 1024,
  minGroupMembers: 2, maxGroupMembers: 6 };
let submissionInFlight = false;
let pendingSubmission = null;

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

      // Clear any group errors
      clearFieldError("groupMembers", false);

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

      // Clear any individual errors
      clearFieldError("regNo", false);
      clearFieldError("fullName", false);

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
  const seenRegs = new Set();

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
        regInput.classList.add("has-error");
        regInput.focus();
      }
      return {
        valid: false,
        message: `Please enter the Registration Number for Member ${memberNum}.`,
        compiled: ""
      };
    }

    const normalizedReg = reg.toUpperCase().replace(/\s+/g, "");
    if (!/^[A-Z0-9][A-Z0-9/._-]{1,49}$/.test(normalizedReg)) {
      if (regInput) {
        regInput.classList.add("has-error");
        regInput.focus();
      }
      return {
        valid: false,
        message: `Invalid Registration Number for Member ${memberNum} (e.g., 22APP1234).`,
        compiled: ""
      };
    }

    if (seenRegs.has(normalizedReg)) {
      if (regInput) {
        regInput.classList.add("has-error");
        regInput.focus();
      }
      return {
        valid: false,
        message: `Duplicate registration number (${normalizedReg}) found. Each member must have a unique registration number.`,
        compiled: ""
      };
    }
    seenRegs.add(normalizedReg);

    if (!name || name.length < 2) {
      if (nameInput) {
        nameInput.classList.add("has-error");
        nameInput.focus();
      }
      return {
        valid: false,
        message: `Please enter the Full Name for Member ${memberNum}.`,
        compiled: ""
      };
    }

    if (regInput) regInput.classList.remove("has-error");
    if (nameInput) nameInput.classList.remove("has-error");

    // Format one line per member
    const leadTag = memberNum === 1 ? " (Team Lead)" : "";
    lines.push(`${memberNum}. ${normalizedReg} - ${name}${leadTag}`);
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

  pills.forEach(pill => {
    pill.addEventListener("click", () => {
      pills.forEach(p => p.classList.remove("active"));
      pill.classList.add("active");
      selectedBatch = pill.getAttribute("data-batch");
      
      if (nativeSelect) {
        nativeSelect.value = selectedBatch;
      }

      clearFieldError("batch", true);
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

      // Allow PDF files only
      const isPDF =
        file.name.toLowerCase().endsWith(".pdf") &&
        (!file.type || file.type === "application/pdf");

      if (!isPDF) {
        fileInput.value = "";
        if (fileSelectedInfo) fileSelectedInfo.style.display = "none";
        if (fileUploadLabel) fileUploadLabel.style.display = "flex";
        fileWrapper.classList.remove("has-file");
        setFieldError("conceptPaper", "Only PDF files are allowed. Please upload a PDF document.");
        showAlert("Only PDF files are allowed. Please upload a PDF document.", "error");
        return;
      }

      // Maximum 10 MB
      if (file.size > CONFIG.maxFileSize) {
        fileInput.value = "";
        if (fileSelectedInfo) fileSelectedInfo.style.display = "none";
        if (fileUploadLabel) fileUploadLabel.style.display = "flex";
        fileWrapper.classList.remove("has-file");
        setFieldError("conceptPaper", "Your PDF must not exceed 10 MB.");
        showAlert("Your PDF must not exceed 10 MB.", "error");
        return;
      }

      if (file.size < 8) {
        fileInput.value = "";
        if (fileSelectedInfo) fileSelectedInfo.style.display = "none";
        if (fileUploadLabel) fileUploadLabel.style.display = "flex";
        fileWrapper.classList.remove("has-file");
        setFieldError("conceptPaper", "The uploaded file is empty or invalid.");
        showAlert("The uploaded file is empty or invalid.", "error");
        return;
      }

      // Valid PDF selected
      showAlert("", "");
      if (fileSelectedName) fileSelectedName.textContent = file.name;
      if (fileSelectedInfo) fileSelectedInfo.style.display = "flex";
      if (fileUploadLabel) fileUploadLabel.style.display = "none";
      fileWrapper.classList.add("has-file");
      clearFieldError("conceptPaper", true);
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
      clearFieldError("conceptPaper", false);
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

  // Real-time Field Validation Setup
  initFieldValidationHandlers();

  // Form Submit Handler
  if (form) {
    form.addEventListener("submit", handleFormSubmit);
  }
}

/* ==========================================================================
   FIELD VALIDATION SYSTEM
   ========================================================================== */
function setFieldError(fieldId, message) {
  const group = document.getElementById(`group-${fieldId}`);
  if (group) {
    group.classList.add("has-error");
    group.classList.remove("has-success");
  }
  const errorEl = document.getElementById(`error-${fieldId}`);
  if (errorEl) {
    const content = errorEl.querySelector(".error-msg-content");
    if (content) content.textContent = message;
    else errorEl.textContent = message;
  }
  const inputWrapper = group ? group.querySelector(".input-wrapper") : null;
  const badge = inputWrapper ? inputWrapper.querySelector(".validation-badge") : null;
  if (badge) {
    badge.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`;
  }
}

function clearFieldError(fieldId, markSuccess = true) {
  const group = document.getElementById(`group-${fieldId}`);
  if (group) {
    group.classList.remove("has-error");
    if (markSuccess) group.classList.add("has-success");
    else group.classList.remove("has-success");
  }
  const inputWrapper = group ? group.querySelector(".input-wrapper") : null;
  const badge = inputWrapper ? inputWrapper.querySelector(".validation-badge") : null;
  if (badge) {
    if (markSuccess) {
      badge.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`;
    } else {
      badge.innerHTML = "";
    }
  }
}

function validateBatch(showUi = true) {
  const batch = selectedBatch || (document.getElementById("batch") ? document.getElementById("batch").value : "");
  if (!batch) {
    if (showUi) setFieldError("batch", "Please select your academic batch.");
    return false;
  }
  clearFieldError("batch", true);
  return true;
}

function validateRegNo(showUi = true) {
  if (selectedSubmissionType !== "individual") return true;
  const input = document.getElementById("regNo");
  if (!input) return true;
  const val = input.value.trim();
  if (!val) {
    if (showUi) setFieldError("regNo", "Registration number is required.");
    return false;
  }
  const normalized = val.toUpperCase().replace(/\s+/g, "");
  if (!/^[A-Z0-9][A-Z0-9/._-]{1,49}$/.test(normalized)) {
    if (showUi) setFieldError("regNo", "Enter a valid registration number (e.g. 22APP1234).");
    return false;
  }
  clearFieldError("regNo", true);
  return true;
}

function validateFullName(showUi = true) {
  if (selectedSubmissionType !== "individual") return true;
  const input = document.getElementById("fullName");
  if (!input) return true;
  const val = input.value.trim();
  if (!val) {
    if (showUi) setFieldError("fullName", "Full name is required.");
    return false;
  }
  if (val.length < 2) {
    if (showUi) setFieldError("fullName", "Full name must be at least 2 characters.");
    return false;
  }
  clearFieldError("fullName", true);
  return true;
}

function validateGroupMembers(showUi = true) {
  if (selectedSubmissionType !== "group") return true;
  const tableBody = document.getElementById("members-table-body");
  if (!tableBody) return false;
  const rows = tableBody.querySelectorAll(".member-row");

  if (rows.length < MIN_GROUP_MEMBERS) {
    if (showUi) setFieldError("groupMembers", "Group submission requires at least 2 team members.");
    return false;
  }
  if (rows.length > MAX_GROUP_MEMBERS) {
    if (showUi) setFieldError("groupMembers", "Group submission allows at most 6 team members.");
    return false;
  }

  const seenRegs = new Set();
  let firstErrorMsg = "";
  let hasError = false;

  rows.forEach((row, idx) => {
    const memberNum = idx + 1;
    const regInput = row.querySelector(".member-reg");
    const nameInput = row.querySelector(".member-name");
    const reg = regInput ? regInput.value.trim() : "";
    const name = nameInput ? nameInput.value.trim() : "";

    let regErr = false;
    let nameErr = false;

    if (!reg) {
      regErr = true;
      if (!firstErrorMsg) firstErrorMsg = `Registration number required for Member ${memberNum}.`;
    } else {
      const normalized = reg.toUpperCase().replace(/\s+/g, "");
      if (!/^[A-Z0-9][A-Z0-9/._-]{1,49}$/.test(normalized)) {
        regErr = true;
        if (!firstErrorMsg) firstErrorMsg = `Invalid registration number for Member ${memberNum} (e.g. 22APP1234).`;
      } else if (seenRegs.has(normalized)) {
        regErr = true;
        if (!firstErrorMsg) firstErrorMsg = `Duplicate registration number (${normalized}) found in Member ${memberNum}.`;
      } else {
        seenRegs.add(normalized);
      }
    }

    if (!name || name.length < 2) {
      nameErr = true;
      if (!firstErrorMsg) firstErrorMsg = `Full name required for Member ${memberNum}.`;
    }

    if (regInput) {
      if (regErr && showUi) regInput.classList.add("has-error");
      else if (!regErr) regInput.classList.remove("has-error");
    }

    if (nameInput) {
      if (nameErr && showUi) nameInput.classList.add("has-error");
      else if (!nameErr) nameInput.classList.remove("has-error");
    }

    if (regErr || nameErr) hasError = true;
  });

  if (hasError) {
    if (showUi) setFieldError("groupMembers", firstErrorMsg);
    return false;
  }

  clearFieldError("groupMembers", true);
  return true;
}

function validateTopic(showUi = true) {
  const input = document.getElementById("topic");
  if (!input) return true;
  const val = input.value.trim();
  if (!val) {
    if (showUi) setFieldError("topic", "Please enter the topic of your idea.");
    return false;
  }
  if (val.length > 300) {
    if (showUi) setFieldError("topic", "Topic must be at most 300 characters.");
    return false;
  }
  clearFieldError("topic", true);
  return true;
}

function validateConceptPaperFile(showUi = true) {
  const input = document.getElementById("conceptPaper");
  if (!input) return true;
  const file = input.files && input.files[0];
  if (!file) {
    if (showUi) setFieldError("conceptPaper", "Please upload your concept paper in PDF format.");
    return false;
  }
  const isPDF = file.name.toLowerCase().endsWith(".pdf") && (!file.type || file.type === "application/pdf");
  if (!isPDF) {
    if (showUi) setFieldError("conceptPaper", "Only PDF files are allowed. Please upload a PDF document.");
    return false;
  }
  if (file.size > CONFIG.maxFileSize) {
    if (showUi) setFieldError("conceptPaper", `File size exceeds the 10 MB limit (${(file.size / (1024 * 1024)).toFixed(1)} MB).`);
    return false;
  }
  if (file.size < 8) {
    if (showUi) setFieldError("conceptPaper", "The uploaded file is empty or corrupted.");
    return false;
  }
  clearFieldError("conceptPaper", true);
  return true;
}

function validateEmailField(showUi = true) {
  const input = document.getElementById("email");
  if (!input) return true;
  const val = input.value.trim();
  if (!val) {
    if (showUi) setFieldError("email", "Email address is required.");
    return false;
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) {
    if (showUi) setFieldError("email", "Please enter a valid email address (e.g. perera@gmail.com).");
    return false;
  }
  if (val.length > 254) {
    if (showUi) setFieldError("email", "Email address is too long.");
    return false;
  }
  clearFieldError("email", true);
  return true;
}

function validatePhoneField(showUi = true) {
  const input = document.getElementById("phone");
  if (!input) return true;
  const val = input.value.trim().replace(/\D/g, "");
  if (!val) {
    clearFieldError("phone", false);
    return true;
  }
  if (!/^\d{10}$/.test(val)) {
    if (showUi) setFieldError("phone", "Contact number must be exactly 10 digits (e.g. 0712345678).");
    return false;
  }
  clearFieldError("phone", true);
  return true;
}

function validateAllFormFields() {
  let isAllValid = true;
  let firstInvalidEl = null;

  function runCheck(result, elId) {
    if (!result) {
      isAllValid = false;
      if (!firstInvalidEl) {
        firstInvalidEl = document.getElementById(elId) || document.getElementById(`group-${elId}`);
      }
    }
  }

  runCheck(validateBatch(true), "group-batch");

  if (selectedSubmissionType === "individual") {
    runCheck(validateRegNo(true), "regNo");
    runCheck(validateFullName(true), "fullName");
  } else {
    runCheck(validateGroupMembers(true), "group-groupMembers");
  }

  runCheck(validateTopic(true), "topic");
  runCheck(validateConceptPaperFile(true), "conceptPaper");
  runCheck(validateEmailField(true), "email");
  runCheck(validatePhoneField(true), "phone");

  if (!isAllValid && firstInvalidEl) {
    showAlert("Please correct the highlighted fields before submitting your idea.", "error");
    firstInvalidEl.scrollIntoView({ behavior: "smooth", block: "center" });
    const focusTarget = firstInvalidEl.querySelector("input:not([type=hidden]):not([disabled]), button") || firstInvalidEl;
    if (focusTarget && typeof focusTarget.focus === "function") {
      setTimeout(() => focusTarget.focus(), 300);
    }
  }

  return isAllValid;
}

function initFieldValidationHandlers() {
  // Individual Reg No (auto uppercase + live validation)
  const regNo = document.getElementById("regNo");
  if (regNo) {
    regNo.addEventListener("input", () => {
      const start = regNo.selectionStart;
      const end = regNo.selectionEnd;
      regNo.value = regNo.value.toUpperCase();
      regNo.setSelectionRange(start, end);
      const group = document.getElementById("group-regNo");
      if (group && group.classList.contains("has-error")) {
        validateRegNo(true);
      } else if (regNo.value.trim().length > 0) {
        validateRegNo(false);
      } else {
        clearFieldError("regNo", false);
      }
    });
    regNo.addEventListener("blur", () => {
      if (selectedSubmissionType === "individual") validateRegNo(true);
    });
  }

  // Full Name
  const fullName = document.getElementById("fullName");
  if (fullName) {
    fullName.addEventListener("input", () => {
      const group = document.getElementById("group-fullName");
      if (group && group.classList.contains("has-error")) {
        validateFullName(true);
      } else if (fullName.value.trim().length >= 2) {
        validateFullName(false);
      } else {
        clearFieldError("fullName", false);
      }
    });
    fullName.addEventListener("blur", () => {
      if (selectedSubmissionType === "individual") validateFullName(true);
    });
  }

  // Topic
  const topic = document.getElementById("topic");
  if (topic) {
    topic.addEventListener("input", () => {
      const group = document.getElementById("group-topic");
      if (group && group.classList.contains("has-error")) {
        validateTopic(true);
      } else if (topic.value.trim().length > 0) {
        validateTopic(false);
      } else {
        clearFieldError("topic", false);
      }
    });
    topic.addEventListener("blur", () => validateTopic(true));
  }

  // Email
  const email = document.getElementById("email");
  if (email) {
    email.addEventListener("input", () => {
      const group = document.getElementById("group-email");
      if (group && group.classList.contains("has-error")) {
        validateEmailField(true);
      } else if (email.value.trim().length > 0 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value.trim())) {
        validateEmailField(false);
      }
    });
    email.addEventListener("blur", () => validateEmailField(true));
  }

  // Phone (digits only, exactly 10 digits)
  const phone = document.getElementById("phone");
  if (phone) {
    phone.addEventListener("input", () => {
      // Restrict strictly to numbers and max 10 digits
      phone.value = phone.value.replace(/\D/g, "").slice(0, 10);
      const group = document.getElementById("group-phone");
      if (group && group.classList.contains("has-error")) {
        validatePhoneField(true);
      } else if (phone.value.length === 10) {
        validatePhoneField(false);
      } else if (phone.value.length === 0) {
        clearFieldError("phone", false);
      }
    });
    phone.addEventListener("blur", () => {
      if (phone.value.trim().length > 0) {
        validatePhoneField(true);
      } else {
        clearFieldError("phone", false);
      }
    });
  }

  // Group Members Dynamic Table Listeners
  const tableBody = document.getElementById("members-table-body");
  if (tableBody) {
    tableBody.addEventListener("input", (e) => {
      const target = e.target;
      if (target && target.classList.contains("member-input")) {
        if (target.classList.contains("member-reg")) {
          const start = target.selectionStart;
          const end = target.selectionEnd;
          target.value = target.value.toUpperCase();
          target.setSelectionRange(start, end);
        }
        if (target.value.trim().length > 0) {
          target.classList.remove("has-error");
        }
        const group = document.getElementById("group-groupMembers");
        if (group && group.classList.contains("has-error")) {
          validateGroupMembers(false);
        }
      }
    });
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
  if (submissionInFlight) return;

  if (!isSubmissionsOpen()) {
    showAlert("Submissions are currently closed. New ideas cannot be submitted at this time.", "error");
    return;
  }

  const form = document.getElementById("idea-form");
  const submitBtn = document.getElementById("submit-btn");
  const btnSpinner = document.getElementById("btn-spinner");
  const btnLabel = document.getElementById("btn-label");
  const alertBox = document.getElementById("form-alert");

  // 1. Comprehensive Field Validation
  const isFormValid = validateAllFormFields();
  if (!isFormValid) return;

  const batch = selectedBatch || (document.getElementById("batch") ? document.getElementById("batch").value : "");
  const topic = document.getElementById("topic") ? document.getElementById("topic").value.trim() : "";
  const fileElem = document.getElementById("conceptPaper");
  const email = document.getElementById("email") ? document.getElementById("email").value.trim() : "";
  const phone = document.getElementById("phone") ? document.getElementById("phone").value.trim() : "";

  let regAndNames = "";
  let participantSummary = "";
  let submissionTypeTitle = "";

  if (selectedSubmissionType === "individual") {
    submissionTypeTitle = "Individual Submission";
    const regNo = document.getElementById("regNo").value.trim().toUpperCase().replace(/\s+/g, "");
    const fullName = document.getElementById("fullName").value.trim();
    regAndNames = `1. ${regNo} - ${fullName}`;
    participantSummary = fullName;
  } else {
    submissionTypeTitle = "Group Submission";
    const membersData = getGroupMembersData();
    if (!membersData.valid) {
      setFieldError("groupMembers", membersData.message);
      showAlert(membersData.message, "error");
      const groupContainer = document.getElementById("group-groupMembers");
      if (groupContainer) groupContainer.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    regAndNames = membersData.compiled;
    participantSummary = `${membersData.leadName} & Team (${membersData.count} Members)`;
  }

  // Clear Alert
  showAlert("", "");

  // Button Loading State
  submissionInFlight = true;
  form.setAttribute("aria-busy", "true");
  submitBtn.disabled = true;
  btnSpinner.style.display = "inline-block";
  btnLabel.textContent = "Processing...";

  try {
    const { validateSubmission, validateConceptPaper } = await import('./submission-validation.mjs');
    const members = selectedSubmissionType === 'individual'
      ? [{ regNo: document.getElementById('regNo').value, fullName: document.getElementById('fullName').value }]
      : Array.from(document.querySelectorAll('#members-table-body .member-row'), row => ({
          regNo: row.querySelector('.member-reg').value, fullName: row.querySelector('.member-name').value
        }));
    const data = validateSubmission({ submissionType: selectedSubmissionType, batch, topic, email, phone, members });
    const file = fileElem?.files?.[0];
    await validateConceptPaper(file);
    // Reuse the request token when retrying the same payload after a lost response.
    const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer());
    const fingerprint = JSON.stringify(data) + Array.from(new Uint8Array(digest), n => n.toString(16).padStart(2, '0')).join('');
    if (!pendingSubmission || pendingSubmission.fingerprint !== fingerprint) {
      pendingSubmission = { fingerprint, token: crypto.randomUUID() };
    }
    const result = await transmitToSupabase(data, file, pendingSubmission.token);
    pendingSubmission = null;
    showSuccessModal({ ...data, id: result.id, syncStatus: result.syncStatus, submissionTypeTitle, participantSummary });

    // 5. Reset Form & Dynamic Member Table
    form.reset();
    resetGroupMembersTable();
    document.querySelectorAll(".batch-pill").forEach(p => p.classList.remove("active"));
    selectedBatch = "";
    document.querySelectorAll(".form-group").forEach(g => {
      g.classList.remove("has-success", "has-error");
    });
    document.querySelectorAll(".validation-badge").forEach(b => {
      b.innerHTML = "";
    });
    const c1 = document.getElementById("char-counter");
    if (c1) c1.textContent = "0 characters";

    // Reset file preview wrapper
    const fileWrapper = document.getElementById("file-upload-wrapper");
    const fileSelectedInfo = document.getElementById("file-selected-info");
    const fileUploadLabel = document.querySelector(".file-upload-label");
    if (fileWrapper) fileWrapper.classList.remove("has-file");
    if (fileSelectedInfo) fileSelectedInfo.style.display = "none";
    if (fileUploadLabel) fileUploadLabel.style.display = "flex";

  } catch (error) {
    console.error("Submission transmission error:", error);
    showAlert(error.message || 'Submission failed. Your form is unchanged; please try again.', 'error');
  } finally {
    submissionInFlight = false;
    form.removeAttribute('aria-busy');
    submitBtn.disabled = false;
    btnSpinner.style.display = "none";
    btnLabel.textContent = "Submit Research Idea";
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

  const syncMessage = document.getElementById('receipt-sync-status');
  if (syncMessage) syncMessage.textContent = data.syncStatus === 'synced'
    ? 'Registration saved successfully and synchronized with Google Sheets.'
    : 'Registration saved successfully. Google Sheets synchronization is pending; please do not submit again.';
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

// Keep the original settings icon and modal structure without a login screen.
function initSettings() {
  const modal = document.getElementById('config-modal');
  document.getElementById('open-config-btn')?.addEventListener('click', () => {
    if (modal) modal.style.display = 'flex';
  });
  document.getElementById('close-config-btn')?.addEventListener('click', () => {
    if (modal) modal.style.display = 'none';
  });
  modal?.addEventListener('click', event => {
    if (event.target === modal) modal.style.display = 'none';
  });
}

async function transmitToSupabase(data, file, token) {
  const config = await window.synthexConfig();
  const body = new FormData();
  body.append('payload', JSON.stringify(data));
  body.append('requestToken', token);
  body.append('conceptPaper', file, file.name);
  let response;
  try {
    response = await fetch(`${config.url}/functions/v1/submit-research`, {
      method: 'POST', headers: { apikey: config.publishableKey }, body,
      signal: AbortSignal.timeout(90000)
    });
  } catch (error) {
    if (error.name === 'TimeoutError' || error.name === 'AbortError') {
      throw new Error('The submission request timed out. Keep this page open and retry the same form to recover your confirmation safely.');
    }
    if (navigator.onLine === false) throw new Error('You are offline. Reconnect and retry; your form has been kept.');
    throw new Error(`Cannot reach the Supabase submission service. Check your connection and make sure the submit-research function is deployed with ${window.location.origin} in ALLOWED_ORIGINS. Your form has been kept; retry without reloading.`);
  }
  return window.synthexReadSubmissionResponse(response);
}
