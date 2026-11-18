// Generic table filter — looks for #table-filter input and .filterable-table,
// hides rows that don't match the search query.
// Handles: tables with <th> in first column (syllabary, tone-table),
// and tables with rowspan grouping (homophones).
;(function () {
  "use strict"

  document.addEventListener("DOMContentLoaded", function () {
    const input = document.getElementById("table-filter")
    const table = document.querySelector(".filterable-table")
    if (!input || !table) return

    const countEl = document.getElementById("filter-count")
    const hasRowspan = table.querySelector("[rowspan]") !== null

    if (hasRowspan) {
      initGroupFilter(input, table, countEl)
    } else {
      initRowFilter(input, table, countEl)
    }
  })

  // Standard row filter — for tables where each row is independent.
  // Detects header rows as rows where ALL cells are <th>.
  function initRowFilter(input, table, countEl) {
    const allRows = Array.from(table.querySelectorAll("tr"))
    const rows = allRows.filter(function (row) {
      const cells = row.children
      if (cells.length === 0) return false
      let allTh = true
      for (let i = 0; i < cells.length; i++) {
        if (cells[i].tagName !== "TH") {
          allTh = false
          break
        }
      }
      return !allTh
    })

    const highlight = table.hasAttribute("data-highlight-cells")

    input.addEventListener("input", function () {
      const query = input.value.trim().toLowerCase()
      let visible = 0

      if (highlight) highlightCells(table, rows, query)

      rows.forEach(function (row) {
        if (!query) {
          row.style.display = ""
          visible++
          return
        }

        const match = rowMatches(row, query)
        row.style.display = match ? "" : "none"
        if (match) visible++
      })

      updateCount(countEl, query, visible, rows.length)
    })
  }

  // Group filter — for tables with rowspan. Finds groups of rows that
  // belong together (sharing a rowspan parent) and shows/hides as a unit.
  function initGroupFilter(input, table, countEl) {
    const tbody = table.querySelector("tbody") || table
    const allRows = Array.from(tbody.querySelectorAll("tr"))

    const dataRows = allRows.filter(function (row) {
      return row.closest("thead") === null
    })

    // A group is the run of rows covered by one first-column cell. Inner
    // rowspans (sub-groups in later columns) stay inside it.
    const groups = []
    let remaining = 0

    dataRows.forEach(function (row) {
      if (remaining > 0) {
        groups[groups.length - 1].rows.push(row)
      } else {
        const first = row.firstElementChild
        remaining = (first && parseInt(first.getAttribute("rowspan"), 10)) || 1
        groups.push({ rows: [row] })
      }
      remaining--
    })

    input.addEventListener("input", function () {
      const query = input.value.trim().toLowerCase()
      let visibleGroups = 0

      groups.forEach(function (group) {
        if (!query) {
          group.rows.forEach(function (row) {
            row.style.display = ""
          })
          visibleGroups++
          return
        }

        const match = group.rows.some(function (row) {
          return rowMatches(row, query)
        })

        group.rows.forEach(function (row) {
          row.style.display = match ? "" : "none"
        })
        if (match) visibleGroups++
      })

      updateCount(countEl, query, visibleGroups, groups.length)
    })
  }

  // Opt-in (data-highlight-cells on the table): marks the cells that match so
  // the user can see which one made a row appear, and dims the rest.
  function highlightCells(table, rows, query) {
    table.classList.toggle("filtering", query !== "")
    rows.forEach(function (row) {
      // A match on the row's own <th> (the rhyme) highlights the whole row.
      const th = row.querySelector("th")
      const rowHit = query !== "" && th !== null && elementMatches(th, query)
      Array.from(row.querySelectorAll("td")).forEach(function (cell) {
        const hit = rowHit || (query !== "" && elementMatches(cell, query))
        cell.classList.toggle("filter-match", hit)
      })
    })
  }

  function rowMatches(row, query) {
    return elementMatches(row, query)
  }

  // Matches the text, plus each title. An element with data-search is matched
  // on that value instead of its title, so a title can show extra hover info
  // (such as a count) without being searchable.
  function elementMatches(el, query) {
    if (el.textContent.toLowerCase().indexOf(query) !== -1) return true

    const titled = el.querySelectorAll("[title]")
    for (let i = 0; i < titled.length; i++) {
      const search = titled[i].hasAttribute("data-search")
        ? titled[i].getAttribute("data-search")
        : titled[i].getAttribute("title")
      if (search.toLowerCase().indexOf(query) !== -1) return true
    }

    return false
  }

  function updateCount(el, query, visible, total) {
    if (!el) return
    el.textContent = query ? visible + " of " + total : ""
  }
})()
