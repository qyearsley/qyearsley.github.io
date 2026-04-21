// Theme switcher — synchronous head portion for FOUC prevention,
// deferred UI injection on DOMContentLoaded.
;(function () {
  "use strict"

  // Part 1: Apply saved preferences immediately (runs in <head>, blocks render)
  var theme = localStorage.getItem("theme")
  var accent = localStorage.getItem("accent")
  if (theme) document.documentElement.dataset.theme = theme
  if (accent) document.documentElement.dataset.accent = accent

  // Part 2: UI injection after DOM is ready
  document.addEventListener("DOMContentLoaded", function () {
    // Inject styles
    var style = document.createElement("style")
    style.textContent = [
      ".theme-toggle {",
      "  position: fixed;",
      "  top: 1rem;",
      "  right: 1rem;",
      "  z-index: 9999;",
      "  width: 36px;",
      "  height: 36px;",
      "  border-radius: 50%;",
      "  border: 1px solid var(--color-border);",
      "  background: var(--color-bg-container);",
      "  color: var(--color-text-muted);",
      "  cursor: pointer;",
      "  display: flex;",
      "  align-items: center;",
      "  justify-content: center;",
      "  opacity: 0.6;",
      "  transition: opacity 0.2s, box-shadow 0.2s;",
      "  padding: 0;",
      "}",
      ".theme-toggle:hover, .theme-toggle:focus { opacity: 1; }",
      ".theme-toggle:focus { outline: 2px solid var(--color-primary); outline-offset: 2px; }",
      ".theme-toggle svg { width: 18px; height: 18px; }",
      "",
      ".theme-popover {",
      "  position: fixed;",
      "  top: 3.5rem;",
      "  right: 1rem;",
      "  z-index: 9999;",
      "  background: var(--color-bg-container);",
      "  border: 1px solid var(--color-border);",
      "  border-radius: 8px;",
      "  padding: 1rem;",
      "  box-shadow: 0 4px 16px rgb(0, 0, 0, 0.15);",
      "  min-width: 180px;",
      "  opacity: 0;",
      "  transform: scale(0.95) translateY(-4px);",
      "  transition: opacity 0.15s, transform 0.15s;",
      "  pointer-events: none;",
      "}",
      ".theme-popover.open {",
      "  opacity: 1;",
      "  transform: scale(1) translateY(0);",
      "  pointer-events: auto;",
      "}",
      "",
      ".theme-popover fieldset {",
      "  border: none;",
      "  padding: 0;",
      "  margin: 0 0 0.75rem;",
      "}",
      ".theme-popover fieldset:last-child { margin-bottom: 0; }",
      ".theme-popover legend {",
      "  font-size: 0.75rem;",
      "  font-weight: 600;",
      "  text-transform: uppercase;",
      "  letter-spacing: 0.05em;",
      "  color: var(--color-text-muted);",
      "  margin-bottom: 0.5rem;",
      "}",
      "",
      ".theme-options {",
      "  display: flex;",
      "  gap: 0.25rem;",
      "}",
      ".theme-option {",
      "  flex: 1;",
      "  padding: 0.375rem 0.5rem;",
      "  border: 1px solid var(--color-border);",
      "  border-radius: 4px;",
      "  background: transparent;",
      "  color: var(--color-text);",
      "  font-size: 0.8rem;",
      "  cursor: pointer;",
      "  transition: background 0.15s, border-color 0.15s;",
      "}",
      ".theme-option:hover { background: var(--color-bg-card); }",
      ".theme-option.active {",
      "  border-color: var(--color-primary);",
      "  background: var(--color-bg-card);",
      "  font-weight: 600;",
      "}",
      ".theme-option:focus { outline: 2px solid var(--color-primary); outline-offset: 1px; }",
      "",
      ".accent-options {",
      "  display: flex;",
      "  gap: 0.5rem;",
      "}",
      ".accent-swatch {",
      "  width: 24px;",
      "  height: 24px;",
      "  border-radius: 50%;",
      "  border: 2px solid var(--color-border);",
      "  cursor: pointer;",
      "  transition: border-color 0.15s, transform 0.15s;",
      "  padding: 0;",
      "}",
      ".accent-swatch:hover { transform: scale(1.15); }",
      ".accent-swatch.active { border-color: var(--color-text); border-width: 3px; }",
      ".accent-swatch:focus { outline: 2px solid var(--color-text); outline-offset: 2px; }",
      ".accent-blue { background: #3182ce; }",
      ".accent-green { background: #16a34a; }",
      ".accent-amber { background: #d97706; }",
      ".accent-purple { background: #7c3aed; }",
    ].join("\n")
    document.head.appendChild(style)

    // SVG icons
    var sunIcon =
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">' +
      '<circle cx="12" cy="12" r="5"/>' +
      '<line x1="12" y1="1" x2="12" y2="3"/>' +
      '<line x1="12" y1="21" x2="12" y2="23"/>' +
      '<line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>' +
      '<line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>' +
      '<line x1="1" y1="12" x2="3" y2="12"/>' +
      '<line x1="21" y1="12" x2="23" y2="12"/>' +
      '<line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>' +
      '<line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>' +
      "</svg>"

    var moonIcon =
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">' +
      '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>' +
      "</svg>"

    var autoIcon =
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">' +
      '<circle cx="12" cy="12" r="10"/>' +
      '<path d="M12 2a10 10 0 0 1 0 20" fill="currentColor"/>' +
      "</svg>"

    // Current state
    function getTheme() {
      return localStorage.getItem("theme") || "system"
    }
    function getAccent() {
      return localStorage.getItem("accent") || ""
    }

    function getIcon() {
      var t = getTheme()
      if (t === "light") return sunIcon
      if (t === "dark") return moonIcon
      return autoIcon
    }

    // Create toggle button
    var btn = document.createElement("button")
    btn.className = "theme-toggle"
    btn.setAttribute("aria-label", "Theme settings")
    btn.setAttribute("aria-expanded", "false")
    btn.innerHTML = getIcon()

    // Create popover
    var popover = document.createElement("div")
    popover.className = "theme-popover"
    popover.setAttribute("role", "dialog")
    popover.setAttribute("aria-label", "Theme settings")

    var themes = ["light", "dark", "system"]
    var accents = [
      { value: "", label: "Blue", cls: "accent-blue" },
      { value: "green", label: "Green", cls: "accent-green" },
      { value: "amber", label: "Amber", cls: "accent-amber" },
      { value: "purple", label: "Purple", cls: "accent-purple" },
    ]

    popover.innerHTML =
      "<fieldset>" +
      "<legend>Theme</legend>" +
      '<div class="theme-options">' +
      themes
        .map(function (t) {
          var active = getTheme() === t ? " active" : ""
          var label = t.charAt(0).toUpperCase() + t.slice(1)
          return (
            '<button class="theme-option' +
            active +
            '" data-set-theme="' +
            t +
            '">' +
            label +
            "</button>"
          )
        })
        .join("") +
      "</div>" +
      "</fieldset>" +
      "<fieldset>" +
      "<legend>Accent</legend>" +
      '<div class="accent-options">' +
      accents
        .map(function (a) {
          var active = getAccent() === a.value ? " active" : ""
          return (
            '<button class="accent-swatch ' +
            a.cls +
            active +
            '" data-set-accent="' +
            a.value +
            '" aria-label="' +
            a.label +
            '"></button>'
          )
        })
        .join("") +
      "</div>" +
      "</fieldset>"

    document.body.appendChild(btn)
    document.body.appendChild(popover)

    // Toggle popover
    function openPopover() {
      popover.classList.add("open")
      btn.setAttribute("aria-expanded", "true")
    }
    function closePopover() {
      popover.classList.remove("open")
      btn.setAttribute("aria-expanded", "false")
    }
    function isOpen() {
      return popover.classList.contains("open")
    }

    btn.addEventListener("click", function () {
      if (isOpen()) {
        closePopover()
      } else {
        openPopover()
      }
    })

    // Close on outside click
    document.addEventListener("click", function (e) {
      if (isOpen() && !popover.contains(e.target) && e.target !== btn) {
        closePopover()
      }
    })

    // Close on Escape
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && isOpen()) {
        closePopover()
        btn.focus()
      }
    })

    // Apply theme
    function applyTheme(t) {
      if (t === "system") {
        delete document.documentElement.dataset.theme
        localStorage.removeItem("theme")
      } else {
        document.documentElement.dataset.theme = t
        localStorage.setItem("theme", t)
      }
      btn.innerHTML = getIcon()
      updateActiveStates()
    }

    // Apply accent
    function applyAccent(a) {
      if (a === "") {
        delete document.documentElement.dataset.accent
        localStorage.removeItem("accent")
      } else {
        document.documentElement.dataset.accent = a
        localStorage.setItem("accent", a)
      }
      updateActiveStates()
    }

    // Update UI active states
    function updateActiveStates() {
      var currentTheme = getTheme()
      var currentAccent = getAccent()
      popover.querySelectorAll(".theme-option").forEach(function (el) {
        el.classList.toggle("active", el.dataset.setTheme === currentTheme)
      })
      popover.querySelectorAll(".accent-swatch").forEach(function (el) {
        el.classList.toggle("active", el.dataset.setAccent === currentAccent)
      })
    }

    // Theme button handlers
    popover.addEventListener("click", function (e) {
      var target = e.target
      if (target.dataset.setTheme !== undefined) {
        applyTheme(target.dataset.setTheme)
      } else if (target.dataset.setAccent !== undefined) {
        applyAccent(target.dataset.setAccent)
      }
    })

    // Cycle theme: system -> light -> dark -> system
    function cycleTheme() {
      var order = ["system", "light", "dark"]
      var current = getTheme()
      var next = order[(order.indexOf(current) + 1) % order.length]
      applyTheme(next)
    }

    // Expose for nav.js keyboard shortcut
    window.__themeToggle = cycleTheme
    window.__themePopoverClose = closePopover
    window.__themePopoverIsOpen = isOpen

    // Register keyboard shortcut if nav.js loaded first
    if (window.__registerShortcut) {
      window.__registerShortcut("t", "Cycle theme (light/dark/system)", cycleTheme)
    }
  })
})()
