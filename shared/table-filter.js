// Generic table filter — looks for #table-filter input and .filterable-table,
// hides rows that don't match the search query.
// Handles: tables with <th> in first column (syllabary, tonetable),
// and tables with rowspan grouping (homophone_subs).
;(function () {
  "use strict"

  document.addEventListener("DOMContentLoaded", function () {
    var input = document.getElementById("table-filter")
    var table = document.querySelector(".filterable-table")
    if (!input || !table) return

    var countEl = document.getElementById("filter-count")
    var hasRowspan = table.querySelector("[rowspan]") !== null

    if (hasRowspan) {
      initGroupFilter(input, table, countEl)
    } else {
      initRowFilter(input, table, countEl)
    }
  })

  // Standard row filter — for tables where each row is independent.
  // Detects header rows as rows where ALL cells are <th>.
  function initRowFilter(input, table, countEl) {
    var allRows = Array.from(table.querySelectorAll("tr"))
    var rows = allRows.filter(function (row) {
      var cells = row.children
      if (cells.length === 0) return false
      // Header row = every cell is <th> (e.g. column headers)
      var allTh = true
      for (var i = 0; i < cells.length; i++) {
        if (cells[i].tagName !== "TH") {
          allTh = false
          break
        }
      }
      return !allTh
    })

    input.addEventListener("input", function () {
      var query = input.value.trim().toLowerCase()
      var visible = 0

      rows.forEach(function (row) {
        if (!query) {
          row.style.display = ""
          visible++
          return
        }

        var match = rowMatches(row, query)
        row.style.display = match ? "" : "none"
        if (match) visible++
      })

      updateCount(countEl, query, visible, rows.length)
    })
  }

  // Group filter — for tables with rowspan. Finds groups of rows that
  // belong together (sharing a rowspan parent) and shows/hides as a unit.
  function initGroupFilter(input, table, countEl) {
    var tbody = table.querySelector("tbody") || table
    var allRows = Array.from(tbody.querySelectorAll("tr"))

    // Skip pure header rows (in thead or all-th rows)
    var dataRows = allRows.filter(function (row) {
      return row.closest("thead") === null
    })

    // Build groups: a group starts at a row containing a cell with rowspan > 1
    var groups = []
    var currentGroup = null

    dataRows.forEach(function (row) {
      var spanCell = row.querySelector("[rowspan]")
      if (spanCell) {
        currentGroup = { rows: [row] }
        groups.push(currentGroup)
      } else if (currentGroup) {
        currentGroup.rows.push(row)
      } else {
        // Row without a group start — treat as its own group
        groups.push({ rows: [row] })
      }
    })

    input.addEventListener("input", function () {
      var query = input.value.trim().toLowerCase()
      var visibleGroups = 0

      groups.forEach(function (group) {
        if (!query) {
          group.rows.forEach(function (row) {
            row.style.display = ""
          })
          visibleGroups++
          return
        }

        // Check if any row in the group matches
        var match = group.rows.some(function (row) {
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
    // Check all text content (includes <th> first column with pinyin)
    var text = row.textContent.toLowerCase()
    if (text.indexOf(query) !== -1) return true

    // Check title attributes (syllabary spans have title="pinyin; freq")
    var titled = row.querySelectorAll("[title]")
    for (var i = 0; i < titled.length; i++) {
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
