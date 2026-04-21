// Prev/next navigation — injects links at the bottom of content pages
// for sequential browsing within a section.
;(function () {
  "use strict"

  var sections = {
    "/javascript/": {
      label: "JavaScript Experiments",
      index: "/javascript/",
      pages: [
        { url: "/javascript/logic-engine/", title: "Logic Engine" },
        { url: "/javascript/markov/", title: "Markov Generator" },
        { url: "/javascript/truthtable.html", title: "Truth Tables" },
        { url: "/javascript/date.html", title: "Life Calculator" },
        { url: "/javascript/coinflip.html", title: "Coin Flipper" },
        { url: "/javascript/seriestest.html", title: "Series Tester" },
        { url: "/javascript/passgen.html", title: "Password Generator" },
        { url: "/javascript/float.html", title: "Floating Point Exposed" },
        { url: "/javascript/hashlab.html", title: "Hash Collision Lab" },
        { url: "/javascript/automata.html", title: "Cellular Automata" },
      ],
    },
    "/chinese/": {
      label: "Chinese Language Notes",
      index: "/chinese/",
      pages: [
        { url: "/chinese/syllabary.html", title: "Syllabary" },
        { url: "/chinese/tonetable.html", title: "Tone Table" },
        { url: "/chinese/pinyin_abbrev.html", title: "Pinyin Abbreviations" },
        { url: "/chinese/homophone_subs.html", title: "Homophones" },
        { url: "/chinese/tradsimp.html", title: "Character Converter" },
        { url: "/chinese/encoding.html", title: "Encoding Explorer" },
      ],
    },
  }

  document.addEventListener("DOMContentLoaded", function () {
    var path = window.location.pathname
    // Normalize: /javascript/logic-engine/index.html -> /javascript/logic-engine/
    path = path.replace(/index\.html$/, "")

    // Find which section this page belongs to
    var section = null
    var pageIndex = -1
    var keys = Object.keys(sections)
    for (var k = 0; k < keys.length; k++) {
      var s = sections[keys[k]]
      for (var i = 0; i < s.pages.length; i++) {
        var pageUrl = s.pages[i].url
        if (path === pageUrl || path === pageUrl.replace(/\/$/, "/index.html")) {
          section = s
          pageIndex = i
          break
        }
      }
      if (section) break
    }

    if (!section || pageIndex === -1) return

    var prev = pageIndex > 0 ? section.pages[pageIndex - 1] : null
    var next = pageIndex < section.pages.length - 1 ? section.pages[pageIndex + 1] : null

    if (!prev && !next) return

    // Inject styles once
    var style = document.createElement("style")
    style.textContent = [
      ".prevnext-nav {",
      "  display: flex;",
      "  justify-content: space-between;",
      "  gap: 1rem;",
      "  margin-top: 2rem;",
      "  padding-top: 1rem;",
      "  border-top: 1px solid var(--color-border, #e2e8f0);",
      "}",
      ".prevnext-link {",
      "  color: var(--color-primary, #3182ce);",
      "  text-decoration: none;",
      "  font-size: 0.9rem;",
      "}",
      ".prevnext-link:hover { text-decoration: underline; }",
      ".prevnext-link.next { margin-left: auto; text-align: right; }",
      ".prevnext-label {",
      "  display: block;",
      "  font-size: 0.75rem;",
      "  color: var(--color-text-muted, #6c757d);",
      "  text-transform: uppercase;",
      "  letter-spacing: 0.04em;",
      "}",
    ].join("\n")
    document.head.appendChild(style)

    // Build nav element
    var nav = document.createElement("nav")
    nav.className = "prevnext-nav"
    nav.setAttribute("aria-label", "Previous and next pages")

    if (prev) {
      var prevLink = document.createElement("a")
      prevLink.className = "prevnext-link prev"
      prevLink.href = prev.url
      prevLink.innerHTML =
        '<span class="prevnext-label">Previous</span>' + prev.title
      nav.appendChild(prevLink)
    }

    if (next) {
      var nextLink = document.createElement("a")
      nextLink.className = "prevnext-link next"
      nextLink.href = next.url
      nextLink.innerHTML =
        '<span class="prevnext-label">Next</span>' + next.title
      nav.appendChild(nextLink)
    }

    // Insert before the last </main> closing tag
    var main = document.querySelector(".main-content")
    if (main) {
      main.appendChild(nav)
    }
  })
})()
