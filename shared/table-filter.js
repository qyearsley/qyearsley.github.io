// Generic table filter — looks for #table-filter input and .filterable-table,
// hides rows that don't match the search query.
// Handles: tables with <th> in first column (syllabary, tonetable),
// and tables with rowspan grouping (homophone_subs).
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

    input.addEventListener("input", function () {
      const query = input.value.trim().toLowerCase()
      let visible = 0

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

    const groups = []
    let currentGroup = null

    dataRows.forEach(function (row) {
      const spanCell = row.querySelector("[rowspan]")
      if (spanCell) {
        currentGroup = { rows: [row] }
        groups.push(currentGroup)
      } else if (currentGroup) {
        currentGroup.rows.push(row)
      } else {
        groups.push({ rows: [row] })
      }
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

  function rowMatches(row, query) {
    const text = row.textContent.toLowerCase()
    if (text.indexOf(query) !== -1) return true

    const titled = row.querySelectorAll("[title]")
    for (let i = 0; i < titled.length; i++) {
      if (titled[i].getAttribute("title").toLowerCase().indexOf(query) !== -1) {
        return true
      }
    }

    return false
  }

  function updateCount(el, query, visible, total) {
    if (!el) return
    el.textContent = query ? visible + " of " + total : ""
  }
})()
