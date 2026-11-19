// Runs before first paint to apply saved theme/accent, preventing flash of wrong theme.
;(function () {
  "use strict"

  // Part 1: Apply saved preferences immediately (runs in <head>, blocks render)
  let theme, accent
  try {
    theme = localStorage.getItem("theme")
    accent = localStorage.getItem("accent")
  } catch (_) {
    /* localStorage unavailable */
  }
  if (theme) document.documentElement.dataset.theme = theme
  if (accent) document.documentElement.dataset.accent = accent

  // Resolve "is the page dark right now" the same way CSS does: an explicit
  // choice beats the OS preference. Exposed because canvas and SVG can't read a
  // media query the way a stylesheet can.
  window.__prefersDark = function () {
    const explicit = document.documentElement.dataset.theme
    if (explicit === "dark") return true
    if (explicit === "light") return false
    return window.matchMedia("(prefers-color-scheme: dark)").matches
  }

  // Part 2: UI injection after DOM is ready
  document.addEventListener("DOMContentLoaded", function () {
    // The popover styles live in css/style.css. This one rule stays here so it
    // lands after each game's own stylesheet; in style.css a game's
    // `.game-top-bar { padding }` would override it.
    //
    // The toggle is fixed at the top right, where a game's top bar puts its own
    // right-hand control. 60px clears the 36px button plus both margins.
    // `.screen > .header` is the same case in Number Garden and Times Trail,
    // whose HUD ends in a settings gear.
    const style = document.createElement("style")
    style.textContent = ".game-top-bar, .screen > .header { padding-right: 60px; }"
    document.head.appendChild(style)

    // SVG icons
    const sunIcon =
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

    const moonIcon =
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">' +
      '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>' +
      "</svg>"

    const autoIcon =
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">' +
      '<circle cx="12" cy="12" r="10"/>' +
      '<path d="M12 2a10 10 0 0 1 0 20" fill="currentColor"/>' +
      "</svg>"

    // Current state. Guarded like Part 1: Chrome throws on `localStorage`
    // itself when cookies are blocked, and an unguarded read here would stop
    // the toggle and window.__themeToggle from being set up.
    function readStored(key) {
      try {
        return localStorage.getItem(key)
      } catch (_) {
        return null
      }
    }

    function writeStored(key, value) {
      try {
        if (value === null) localStorage.removeItem(key)
        else localStorage.setItem(key, value)
      } catch (_) {
        /* preference is not persisted; the page still applies it */
      }
    }

    function getTheme() {
      return readStored("theme") || "system"
    }
    function getAccent() {
      return readStored("accent") || ""
    }

    function getIcon() {
      const t = getTheme()
      if (t === "light") return sunIcon
      if (t === "dark") return moonIcon
      return autoIcon
    }

    // Create toggle button
    const btn = document.createElement("button")
    btn.className = "theme-toggle"
    btn.setAttribute("aria-label", "Theme settings")
    btn.setAttribute("aria-expanded", "false")
    btn.innerHTML = getIcon()

    // Create popover
    const popover = document.createElement("div")
    popover.className = "theme-popover"
    popover.setAttribute("role", "dialog")
    popover.setAttribute("aria-label", "Theme settings")

    const themes = ["light", "dark", "system"]
    const accents = [
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
          const active = getTheme() === t ? " active" : ""
          const label = t.charAt(0).toUpperCase() + t.slice(1)
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
          const active = getAccent() === a.value ? " active" : ""
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

    // Place button in header controls if available, else fall back to body.
    //
    // Only a page-level header counts. Number Garden and Times Trail reuse
    // `.header` for a HUD row inside each hidden `.screen` panel, so those two
    // games get the fixed top-right button instead.
    const header = Array.from(document.querySelectorAll(".header")).find(function (el) {
      return !el.closest(".screen")
    })
    let controls = header ? header.querySelector(".header-controls") : null
    if (header && !controls) {
      controls = document.createElement("div")
      controls.className = "header-controls"
      header.appendChild(controls)
    }
    if (controls) {
      controls.appendChild(btn)
    } else {
      document.body.appendChild(btn)
    }
    document.body.appendChild(popover)

    // Toggle popover
    function openPopover() {
      const rect = btn.getBoundingClientRect()
      popover.style.top = rect.bottom + 8 + "px"
      popover.style.right = window.innerWidth - rect.right + "px"
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
        writeStored("theme", null)
      } else {
        document.documentElement.dataset.theme = t
        writeStored("theme", t)
      }
      btn.innerHTML = getIcon()
      updateActiveStates()
      // Stylesheets re-resolve themselves; anything painted into a canvas does
      // not. Life Garden listens for this to repaint its grid.
      window.dispatchEvent(new CustomEvent("themechange", { detail: { theme: t } }))
    }

    // Apply accent
    function applyAccent(a) {
      if (a === "") {
        delete document.documentElement.dataset.accent
        writeStored("accent", null)
      } else {
        document.documentElement.dataset.accent = a
        writeStored("accent", a)
      }
      updateActiveStates()
    }

    // Update UI active states
    function updateActiveStates() {
      const currentTheme = getTheme()
      const currentAccent = getAccent()
      popover.querySelectorAll(".theme-option").forEach(function (el) {
        el.classList.toggle("active", el.dataset.setTheme === currentTheme)
      })
      popover.querySelectorAll(".accent-swatch").forEach(function (el) {
        el.classList.toggle("active", el.dataset.setAccent === currentAccent)
      })
    }

    // Theme button handlers
    popover.addEventListener("click", function (e) {
      const target = e.target
      if (target.dataset.setTheme !== undefined) {
        applyTheme(target.dataset.setTheme)
      } else if (target.dataset.setAccent !== undefined) {
        applyAccent(target.dataset.setAccent)
      }
    })

    // Cycle theme: system -> light -> dark -> system
    function cycleTheme() {
      const order = ["system", "light", "dark"]
      const current = getTheme()
      const next = order[(order.indexOf(current) + 1) % order.length]
      applyTheme(next)
    }

    // nav.js owns the `t` shortcut and lists it in the help overlay; it only
    // needs this global to exist.
    window.__themeToggle = cycleTheme
  })
})()
