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
      const links = document.querySelectorAll(".breadcrumbs a[href]")
      for (let i = 0; i < links.length; i++) {
        const href = links[i].getAttribute("href")
        if (TRANSLATED_PATHS.indexOf(href) !== -1) {
          links[i].setAttribute("href", "/zh" + href)
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
    for (let i = 0; i < shortcuts.length; i++) {
      if (shortcuts[i].key === key) {
        shortcuts[i].handler = handler
        return
      }
    }
    shortcuts.push({ key: key, description: description, handler: handler })
  }

  // --- Help overlay ---
  let overlay = null

  function injectStyles() {
    if (document.getElementById("nav-help-styles")) return
    const style = document.createElement("style")
    style.id = "nav-help-styles"
    style.textContent = [
      ".keyboard-help-backdrop {",
      "  position: fixed;",
      "  inset: 0;",
      "  z-index: 10000;",
      "  background: rgb(0, 0, 0, 0.5);",
      "  display: flex;",
      "  align-items: center;",
      "  justify-content: center;",
      "}",
      ".keyboard-help-panel {",
      "  background: var(--color-bg-container, #fff);",
      "  color: var(--color-text, #333);",
      "  border: 1px solid var(--color-border, #e2e8f0);",
      "  border-radius: 8px;",
      "  padding: 1.5rem;",
      "  max-width: 360px;",
      "  width: 90vw;",
      "  box-shadow: 0 8px 32px rgb(0, 0, 0, 0.2);",
      "  position: relative;",
      "}",
      ".keyboard-help-panel h2 {",
      "  font-size: 1.1rem;",
      "  font-weight: 600;",
      "  margin: 0 0 1rem;",
      "  color: var(--color-text-heading, #2d3748);",
      "}",
      ".keyboard-help-close {",
      "  position: absolute;",
      "  top: 0.75rem;",
      "  right: 0.75rem;",
      "  background: none;",
      "  border: none;",
      "  font-size: 1.25rem;",
      "  color: var(--color-text-muted, #6c757d);",
      "  cursor: pointer;",
      "  padding: 0.25rem;",
      "  line-height: 1;",
      "}",
      ".keyboard-help-close:hover { color: var(--color-text, #333); }",
      ".shortcut-list {",
      "  display: grid;",
      "  grid-template-columns: auto 1fr;",
      "  gap: 0.5rem 1rem;",
      "  align-items: baseline;",
      "}",
      ".shortcut-list dt {",
      "  text-align: right;",
      "}",
      ".shortcut-list dd {",
      "  margin: 0;",
      "  color: var(--color-text-secondary, #4a5568);",
      "  font-size: 0.9rem;",
      "}",
      "kbd {",
      "  display: inline-block;",
      "  padding: 0.15rem 0.4rem;",
      "  font-family: monospace;",
      "  font-size: 0.8rem;",
      "  background: var(--color-bg-card, #f8fafc);",
      "  border: 1px solid var(--color-border, #e2e8f0);",
      "  border-radius: 3px;",
      "  box-shadow: 0 1px 0 var(--color-border, #e2e8f0);",
      "}",
    ].join("\n")
    document.head.appendChild(style)
  }

  function buildOverlay() {
    injectStyles()
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

    shortcuts.forEach(function (s) {
      if (s.condition === "theme" && !window.__themeToggle) return
      if (s.condition === "breadcrumb" && !getParentLink()) return
      if (s.condition === "lang" && !getLangToggleUrl()) return

      const dt = document.createElement("dt")
      dt.innerHTML = "<kbd>" + s.key + "</kbd>"
      const dd = document.createElement("dd")
      dd.textContent = s.description
      dl.appendChild(dt)
      dl.appendChild(dd)
    })

    panel.appendChild(heading)
    panel.appendChild(closeBtn)
    panel.appendChild(dl)
    backdrop.appendChild(panel)

    backdrop.addEventListener("click", function (e) {
      if (e.target === backdrop) hideHelp()
    })

    return backdrop
  }

  function showHelp() {
    if (overlay) return
    overlay = buildOverlay()
    document.body.appendChild(overlay)
    overlay.querySelector(".keyboard-help-close").focus()
  }

  function hideHelp() {
    if (!overlay) return
    overlay.remove()
    overlay = null
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
    if (TRANSLATED_PATHS.indexOf(path) !== -1) {
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

      case "h": {
        if (isHelpOpen()) return
        const homePath = preferredLang === "zh" ? "/zh/" : "/"
        if (window.location.pathname !== homePath) {
          e.preventDefault()
          window.location.href = homePath
        }
        return
      }

      case "l": {
        if (isHelpOpen()) return
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
        if (isHelpOpen()) return
        const parent = getParentLink()
        if (parent) {
          e.preventDefault()
          window.location.href = parent.href
        }
        return
      }

      case "t":
        if (isHelpOpen()) return
        if (window.__themeToggle) {
          e.preventDefault()
          window.__themeToggle()
        }
        return

      case "j":
        if (isHelpOpen()) return
        e.preventDefault()
        if (currentIndex === -1 && links.length > 0) {
          links[0].focus()
        } else if (currentIndex < links.length - 1) {
          links[currentIndex + 1].focus()
        }
        return

      case "k":
        if (isHelpOpen()) return
        e.preventDefault()
        if (currentIndex === -1 && links.length > 0) {
          links[0].focus()
        } else if (currentIndex > 0) {
          links[currentIndex - 1].focus()
        }
        return

      default:
        if (isHelpOpen()) return
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
