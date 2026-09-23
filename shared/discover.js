// "Try something" homepage picker, the 404 page's random-page link, and the
// Game of Life glider in the homepage avatar.
//
// The picker fetches /pages.json (written by build.js from the tool pages
// under games/, javascript/, and chinese/). That file only exists after a
// build -- `npm run dev` serves source directly and never runs build.js -- so
// a failed fetch is expected, not an error: the markup it would have filled
// in stays hidden.
;(function () {
  "use strict"

  // --- Pure picking logic ---
  // Exposed on window.__discover (no bundler here, so this is how Jest gets
  // at them -- see the Shared Module Contract in docs/development.md).

  function sortByPath(pages) {
    return pages.slice().sort(function (a, b) {
      return a.path < b.path ? -1 : a.path > b.path ? 1 : 0
    })
  }

  // Whole days since 1970-01-01 in the visitor's *local* date, not UTC, so
  // the pick changes at local midnight rather than at a fixed UTC hour.
  function daysSinceEpoch(date) {
    const local = new Date(date.getFullYear(), date.getMonth(), date.getDate())
    return Math.floor(local.getTime() / 86400000)
  }

  // Cycles through every page once before repeating, and keeps working as
  // pages are added or removed -- there is no stored "last shown" state to
  // go stale.
  function dailyPick(pages, date) {
    if (pages.length === 0) return null
    const sorted = sortByPath(pages)
    const days = daysSinceEpoch(date)
    const index = ((days % sorted.length) + sorted.length) % sorted.length
    return sorted[index]
  }

  // Uniform, excluding the page at `excludePath` when there's another page to
  // pick from.
  function randomPick(pages, excludePath) {
    if (pages.length === 0) return null
    const candidates = pages.filter(function (p) {
      return p.path !== excludePath
    })
    const pool = candidates.length > 0 ? candidates : pages
    return pool[Math.floor(Math.random() * pool.length)]
  }

  // Resolves the href and title to show for `page`, given whether the
  // current page is a /zh/ one.
  function pageLink(page, isZh) {
    if (isZh && page.zh) {
      return { href: "/zh" + page.path, title: page.zhTitle }
    }
    return { href: page.path, title: page.title }
  }

  // One generation of Conway's Game of Life on a toroidal `size` x `size`
  // grid. `liveSet` holds "col,row" strings; returns a new Set in the same
  // form. Shared with shared/life-background.js in spirit, not in code: that
  // one draws to a canvas at whatever resolution the viewport gives it, this
  // one is fixed at 5x5 and draws SVG rects.
  function lifeStep(liveSet, size) {
    const next = new Set()
    for (let row = 0; row < size; row++) {
      for (let col = 0; col < size; col++) {
        let neighbors = 0
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (dx === 0 && dy === 0) continue
            const nx = (col + dx + size) % size
            const ny = (row + dy + size) % size
            if (liveSet.has(nx + "," + ny)) neighbors++
          }
        }
        const alive = liveSet.has(col + "," + row)
        if (alive && (neighbors === 2 || neighbors === 3)) next.add(col + "," + row)
        else if (!alive && neighbors === 3) next.add(col + "," + row)
      }
    }
    return next
  }

  window.__discover = { dailyPick, randomPick, pageLink, lifeStep }

  // --- DOM wiring: homepage picker + 404 random link ---

  function currentPageInfo() {
    const isZh = location.pathname.indexOf("/zh/") === 0
    const path = isZh ? location.pathname.slice(3) : location.pathname
    return { isZh: isZh, path: path }
  }

  function renderHomepagePicker(pages) {
    const section = document.getElementById("discover-section")
    if (!section) return

    const info = currentPageInfo()
    const daily = dailyPick(pages, new Date())
    const random = randomPick(pages, info.path)
    if (!daily || !random) return

    const dailyEl = document.getElementById("discover-daily")
    const dailyTitleEl = document.getElementById("discover-daily-title")
    const randomEl = document.getElementById("discover-random")
    if (dailyEl) {
      const link = pageLink(daily, info.isZh)
      dailyEl.href = link.href
      if (dailyTitleEl) dailyTitleEl.textContent = link.title
    }
    if (randomEl) {
      randomEl.href = pageLink(random, info.isZh).href
    }

    section.hidden = false
  }

  function renderNotFoundLink(pages) {
    const link = document.getElementById("discover-404-random")
    if (!link) return

    const info = currentPageInfo()
    const random = randomPick(pages, info.path)
    if (!random) return

    link.href = pageLink(random, info.isZh).href
    link.hidden = false
  }

  function initPicker() {
    if (
      !document.getElementById("discover-section") &&
      !document.getElementById("discover-404-random")
    ) {
      return
    }
    fetch("/pages.json")
      .then(function (response) {
        if (!response.ok) throw new Error("pages.json request failed")
        return response.json()
      })
      .then(function (pages) {
        if (!Array.isArray(pages) || pages.length === 0) return
        renderHomepagePicker(pages)
        renderNotFoundLink(pages)
      })
      .catch(function () {
        // No dist/pages.json (npm run dev) or a network hiccup. The picker
        // markup starts hidden, so there's nothing to undo.
      })
  }

  // --- Glider avatar (homepage only) ---
  //
  // The QY avatar's <g class="qy-life"> starts with a 5-cell glider baked
  // into index.html. Each click/Enter/Space reads the current live cells
  // back out of the SVG, advances one generation, and redraws. No autoplay:
  // the pattern only moves when the visitor asks it to.

  const GLIDER_GRID_SIZE = 5
  const GLIDER_CELL_SIZE = 20
  const SVG_NS = "http://www.w3.org/2000/svg"

  function readLiveCells(group) {
    const live = new Set()
    const rects = group.querySelectorAll("rect")
    for (let i = 0; i < rects.length; i++) {
      const col = Math.round(parseFloat(rects[i].getAttribute("x")) / GLIDER_CELL_SIZE)
      const row = Math.round(parseFloat(rects[i].getAttribute("y")) / GLIDER_CELL_SIZE)
      live.add(col + "," + row)
    }
    return live
  }

  function renderLiveCells(group, live) {
    while (group.firstChild) group.removeChild(group.firstChild)
    live.forEach(function (key) {
      const parts = key.split(",")
      const rect = document.createElementNS(SVG_NS, "rect")
      rect.setAttribute("x", String(Number(parts[0]) * GLIDER_CELL_SIZE))
      rect.setAttribute("y", String(Number(parts[1]) * GLIDER_CELL_SIZE))
      rect.setAttribute("width", String(GLIDER_CELL_SIZE))
      rect.setAttribute("height", String(GLIDER_CELL_SIZE))
      group.appendChild(rect)
    })
  }

  function initGliderAvatar() {
    const button = document.querySelector(".profile-image-button")
    const group = button && button.querySelector(".qy-life")
    if (!button || !group) return

    button.addEventListener("click", function () {
      const next = lifeStep(readLiveCells(group), GLIDER_GRID_SIZE)
      renderLiveCells(group, next)
    })
  }

  document.addEventListener("DOMContentLoaded", function () {
    initPicker()
    initGliderAvatar()
  })
})()
