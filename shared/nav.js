// Keyboard navigation, language preference, and help overlay
;(function () {
  "use strict"

  // --- Language preference persistence ---
  const TRANSLATED_PATHS = window.__translatedPaths || []

  const isZhPage = location.pathname.startsWith("/zh/")
  let preferredLang = null
  try {
    preferredLang = localStorage.getItem("preferred-lang")
  } catch (_) {
    /* private browsing */
  }

  if (isZhPage) {
    try {
      localStorage.setItem("preferred-lang", "zh")
    } catch (_) {
      /* ignored */
    }
    preferredLang = "zh"
  }

  document.addEventListener("click", function (e) {
    const link = e.target.closest(".lang-switch")
    if (!link) return
    try {
      localStorage.setItem("preferred-lang", link.getAttribute("lang"))
    } catch (_) {
      /* ignored */
    }
  })

  if (!isZhPage && preferredLang === "zh") {
    document.addEventListener("DOMContentLoaded", function () {
      for (const link of document.querySelectorAll(".breadcrumbs a[href]")) {
        const href = link.getAttribute("href")
        if (TRANSLATED_PATHS.includes(href)) {
          link.setAttribute("href", "/zh" + href)
        }
      }
    })
  }

  // --- Keyboard shortcuts ---
  const shortcuts = [
    { key: "j", description: "Next link" },
    { key: "k", description: "Previous link" },
    { key: "u", description: "Up to section index", condition: "breadcrumb" },
    { key: "?", description: "Show keyboard shortcuts" },
    { key: "h", description: "Go to homepage" },
    { key: "l", description: "Toggle language", condition: "lang" },
    { key: "t", description: "Cycle theme", condition: "theme" },
    { key: "Escape", description: "Close overlay" },
  ]

  window.__registerShortcut = function (key, description, handler) {
    const existing = shortcuts.find((s) => s.key === key)
    if (existing) {
      existing.handler = handler
      return
    }
    shortcuts.push({ key: key, description: description, handler: handler })
  }

  // --- Help overlay ---
  // Styles for .keyboard-help-* and .shortcut-list live in css/style.css.
  let overlay = null
  // Element that had focus when the overlay opened, so it can be restored.
  let previouslyFocused = null

  const FOCUSABLE_SELECTOR = [
    "a[href]",
    "button:not([disabled])",
    "input:not([disabled])",
    "select:not([disabled])",
    "textarea:not([disabled])",
    '[tabindex]:not([tabindex="-1"])',
  ].join(", ")

  function buildOverlay() {
    const backdrop = document.createElement("div")
    backdrop.className = "keyboard-help-backdrop"
    backdrop.setAttribute("role", "dialog")
    backdrop.setAttribute("aria-modal", "true")
    backdrop.setAttribute("aria-label", "Keyboard shortcuts")

    const panel = document.createElement("div")
    panel.className = "keyboard-help-panel"

    const heading = document.createElement("h2")
    heading.textContent = "Keyboard Shortcuts"

    const closeBtn = document.createElement("button")
    closeBtn.className = "keyboard-help-close"
    closeBtn.setAttribute("aria-label", "Close")
    closeBtn.innerHTML = "&times;"
    closeBtn.addEventListener("click", hideHelp)

    const dl = document.createElement("dl")
    dl.className = "shortcut-list"

    for (const s of shortcuts) {
      if (s.condition === "theme" && !window.__themeToggle) continue
      if (s.condition === "breadcrumb" && !getParentLink()) continue
      if (s.condition === "lang" && !getLangToggleUrl()) continue

      const dt = document.createElement("dt")
      dt.innerHTML = "<kbd>" + s.key + "</kbd>"
      const dd = document.createElement("dd")
      dd.textContent = s.description
      dl.appendChild(dt)
      dl.appendChild(dd)
    }

    panel.appendChild(heading)
    panel.appendChild(closeBtn)
    panel.appendChild(dl)
    backdrop.appendChild(panel)

    backdrop.addEventListener("click", function (e) {
      if (e.target === backdrop) hideHelp()
    })

    return backdrop
  }

  // Queried at trap time, not cached at build time, so shortcut-list content
  // added later is included.
  function getFocusable() {
    if (!overlay) return []
    const panel = overlay.querySelector(".keyboard-help-panel")
    if (!panel) return []
    return Array.from(panel.querySelectorAll(FOCUSABLE_SELECTOR)).filter(function (el) {
      return !el.hasAttribute("hidden") && el.getAttribute("aria-hidden") !== "true"
    })
  }

  // Keeps Tab / Shift+Tab inside the panel, so aria-modal is not a lie. With a
  // single focusable element both ends are the same element and focus stays put.
  function trapTab(e) {
    const focusable = getFocusable()
    if (focusable.length === 0) {
      e.preventDefault()
      return
    }
    const first = focusable[0]
    const last = focusable[focusable.length - 1]
    const active = document.activeElement
    const inside = overlay.contains(active)

    if (e.shiftKey) {
      if (!inside || active === first) {
        e.preventDefault()
        last.focus()
      }
    } else if (!inside || active === last) {
      e.preventDefault()
      first.focus()
    }
  }

  function showHelp() {
    if (overlay) return
    previouslyFocused = document.activeElement
    overlay = buildOverlay()
    document.body.appendChild(overlay)
    overlay.querySelector(".keyboard-help-close").focus()
  }

  function hideHelp() {
    if (!overlay) return
    overlay.remove()
    overlay = null

    const restoreTo = previouslyFocused
    previouslyFocused = null
    // The opener may have been removed from the page while the overlay was up.
    if (restoreTo && document.contains(restoreTo) && typeof restoreTo.focus === "function") {
      restoreTo.focus()
    }
  }

  function isHelpOpen() {
    return overlay !== null
  }

  window.__helpOverlayIsOpen = isHelpOpen

  // --- Language toggle ---
  function getLangToggleUrl() {
    const langSwitch = document.querySelector(".lang-switch")
    if (langSwitch) return langSwitch.href
    if (isZhPage) {
      return location.pathname.replace(/^\/zh\//, "/")
    }
    const path = location.pathname
    if (TRANSLATED_PATHS.includes(path)) {
      return "/zh" + path
    }
    return null
  }

  // --- Navigation helpers ---
  function getParentLink() {
    const links = document.querySelectorAll(".breadcrumbs a")
    return links.length >= 1 ? links[links.length - 1] : null
  }

  function getLinks() {
    return Array.from(document.querySelectorAll(".internal-links a, .game-list a"))
  }

  document.addEventListener("keydown", function (e) {
    // Handled before the filters below: the trap has to hold even when focus is
    // on a form field the overlay may grow later.
    if (e.key === "Tab" && isHelpOpen() && !e.ctrlKey && !e.altKey && !e.metaKey) {
      trapTab(e)
      return
    }

    if (e.target.matches("input, textarea, select")) return
    if (e.ctrlKey || e.altKey || e.metaKey) return

    const links = getLinks()
    const currentIndex = links.findIndex(function (link) {
      return link === document.activeElement
    })

    switch (e.key) {
      case "?":
        e.preventDefault()
        if (isHelpOpen()) {
          hideHelp()
        } else {
          showHelp()
        }
        return

      case "Escape":
        if (isHelpOpen()) {
          e.preventDefault()
          hideHelp()
          return
        }
        if (window.__themePopoverIsOpen && window.__themePopoverIsOpen()) {
          return
        }
        return
    }

    // All remaining shortcuts are disabled while the help overlay is open.
    if (isHelpOpen()) return

    switch (e.key) {
      case "h": {
        const homePath = preferredLang === "zh" ? "/zh/" : "/"
        if (window.location.pathname !== homePath) {
          e.preventDefault()
          window.location.href = homePath
        }
        return
      }

      case "l": {
        const langUrl = getLangToggleUrl()
        if (langUrl) {
          e.preventDefault()
          const targetLang = isZhPage ? "en" : "zh"
          try {
            localStorage.setItem("preferred-lang", targetLang)
          } catch (_) {
            /* ignored */
          }
          window.location.href = langUrl
        }
        return
      }

      case "u": {
        const parent = getParentLink()
        if (parent) {
          e.preventDefault()
          window.location.href = parent.href
        }
        return
      }

      case "t":
        if (window.__themeToggle) {
          e.preventDefault()
          window.__themeToggle()
        }
        return

      case "j":
        e.preventDefault()
        if (currentIndex === -1 && links.length > 0) {
          links[0].focus()
        } else if (currentIndex < links.length - 1) {
          links[currentIndex + 1].focus()
        }
        return

      case "k":
        e.preventDefault()
        if (currentIndex === -1 && links.length > 0) {
          links[0].focus()
        } else if (currentIndex > 0) {
          links[currentIndex - 1].focus()
        }
        return

      default:
        for (let i = 0; i < shortcuts.length; i++) {
          if (shortcuts[i].handler && shortcuts[i].key === e.key) {
            e.preventDefault()
            shortcuts[i].handler(e)
            return
          }
        }
    }
  })
})()
