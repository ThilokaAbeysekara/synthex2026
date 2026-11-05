# ⚡ SYNTHEX 2026 - Pitch Competition Web Portal

A modern, responsive, and interactive web application designed for collecting student research ideas for the **SYNTHEX 2026 Pitch Competition**, replacing legacy forms with a next-generation UI/UX and real-time Google Spreadsheet synchronization.

---

## 🌟 Key Features

1. **Futuristic Dark-Blue Design System**:
   - Deep midnight blue palette (`#050B18`, `#081126`, `#0D1B3E`) tailored with neon cyan (`#00F2FE`), electric blue (`#38BDF8`), and violet gradients.
   - Large capital typography for **`SYNTHEX`** with luminous text-gradient clipping.
   - **`Pitch Competition`** subtitle with uppercase tracking and glowing rules.
   - Dynamic canvas constellation animation with floating research particles and interactive connecting lines.

2. **Intuitive & Interactive Form Experience**:
   - **Interactive Batch Selector**: One-click tactile pills for `23/24`, `22/23`, `21/22`, and `20/21` with neon feedback.
   - **Prompt Guidance Chips**: Quick-insert buttons for Problem Statement, Proposed Solution, Tech Stack, and Expected Impact.
   - **Live Character Counter** and real-time field validation.
   - **Celebration Effects**: Animated checkmark and celebratory confetti explosion upon submission.

3. **Google Spreadsheet Integration (2 Flexible Options)**:
   - **Option 1 (Instant / Default)**: Pre-wired directly to your existing Google Form response endpoint (`1FAIpQLScD6u8ZjARToVR_nfJev-ZMqbMspLc26ztLPTk9jkQNrdYk8w`). In Google Forms, simply click **Responses -> Link to Sheets** to see every entry instantly appear in your Google Sheet!
   - **Option 2 (Standalone Apps Script Webhook)**: Copy and paste `google-apps-script.js` into any new Google Sheet, deploy as a Web App, and configure the URL directly in the site's Settings modal.
   - **Built-in Local Backup**: Every submission is automatically backed up in the browser (`localStorage`), with a one-click **"Download CSV Backup"** feature so no idea is ever lost.

---

## 📁 File Structure

```
d:\SYNTHEX 2026\
├── index.html              # Main HTML5 structure & semantic layout
├── styles.css              # Cyber-academic dark blue styles & glassmorphic UI
├── app.js                  # Particle canvas, validation, animations, & Sheets sync
├── google-apps-script.js   # Ready-to-deploy Google Apps Script for Google Sheets
└── README.md               # Documentation and setup guide
```

---

## 🚀 How to Run and Preview

### Option A: Open directly in Browser
Simply double-click [`index.html`](file:///d:/SYNTHEX%202026/index.html) in your file manager to open it in Chrome, Edge, Brave, or Firefox.

### Option B: Local Web Server (Recommended)
Run a local HTTP server in PowerShell:
```powershell
python -m http.server 8000
```
Then visit: [http://localhost:8000](http://localhost:8000)

---

## 📊 Google Spreadsheet Setup Guide

### Method 1: Using Your Existing Form's Linked Sheet (Zero-code)
1. Open your Google Form: [Google Forms Edit](https://docs.google.com/forms/d/17yshc-_WReK7hkJFw-Rja6fRgYTfuDDETcJBow-sPzI/edit)
2. Click on the **Responses** tab at the top.
3. Click the green **"Link to Sheets"** icon (Create a new spreadsheet or select existing).
4. All submissions made through your new website will immediately flow into that Google Spreadsheet in real time!

### Method 2: Dedicated Google Apps Script Webhook
1. Create a new Google Spreadsheet at [sheets.new](https://sheets.new).
2. Go to **Extensions** > **Apps Script**.
3. Replace the code in the editor with the contents of [`google-apps-script.js`](file:///d:/SYNTHEX%202026/google-apps-script.js).
4. Click **Deploy** > **New deployment**.
5. Select **Web app**, set *Execute as* to **Me**, and *Who has access* to **Anyone**.
6. Click **Deploy** and copy the generated Web App URL.
7. On your SYNTHEX website, click the **Settings (Gear icon)** in the top navigation, paste your URL, and click **Save Settings**.

---

## 📝 Form Fields Specification

| Field Name | Type | Options / Format | Required |
| :--- | :--- | :--- | :--- |
| **Registration No** | Text | e.g., `2021/ICT/045` | Yes |
| **Name** | Text | Full student / team lead name | Yes |
| **Select Your Batch** | Selection Pills | `23/24`, `22/23`, `21/22`, `20/21` | Yes |
| **Topic of Your Idea** | Text | Catchy project/research title | Yes |
| **Describe Your Idea** | Textarea | Problem, solution, tech stack, impact | Optional |
