import "../../shared/table-filter.js"

function setupDOM(html) {
  document.body.innerHTML = html
  document.dispatchEvent(new Event("DOMContentLoaded"))
}

function typeFilter(value) {
  const input = document.getElementById("table-filter")
  input.value = value
  input.dispatchEvent(new Event("input"))
}

function visibleDataRows() {
  return Array.from(document.querySelectorAll("tr")).filter((row) => {
    const cells = row.children
    const allTh = Array.from(cells).every((c) => c.tagName === "TH")
    return !allTh && row.style.display !== "none"
  })
}

describe("table-filter.js", () => {
  describe("standard row filter", () => {
    beforeEach(() => {
      setupDOM(`
        <input id="table-filter">
        <span id="filter-count"></span>
        <table class="filterable-table">
          <tr><th>Name</th><th>Color</th></tr>
          <tr><td>Apple</td><td>Red</td></tr>
          <tr><td>Banana</td><td>Yellow</td></tr>
          <tr><td>Cherry</td><td>Red</td></tr>
        </table>
      `)
    })

    it("shows all rows when filter is empty", () => {
      typeFilter("")
      expect(visibleDataRows().length).toBe(3)
    })

    it("filters rows by text content", () => {
      typeFilter("apple")
      expect(visibleDataRows().length).toBe(1)
      expect(visibleDataRows()[0].textContent).toContain("Apple")
    })

    it("is case insensitive", () => {
      typeFilter("BANANA")
      expect(visibleDataRows().length).toBe(1)
    })

    it("matches partial text", () => {
      typeFilter("an")
      expect(visibleDataRows().length).toBe(1) // Banana
    })

    it("filters by column content", () => {
      typeFilter("red")
      expect(visibleDataRows().length).toBe(2) // Apple and Cherry
    })

    it("shows no rows when nothing matches", () => {
      typeFilter("grape")
      expect(visibleDataRows().length).toBe(0)
    })

    it("restores rows when clearing filter", () => {
      typeFilter("apple")
      expect(visibleDataRows().length).toBe(1)
      typeFilter("")
      expect(visibleDataRows().length).toBe(3)
    })

    it("updates count display", () => {
      const count = document.getElementById("filter-count")
      typeFilter("red")
      expect(count.textContent).toBe("2 of 3")
    })

    it("clears count when filter is empty", () => {
      const count = document.getElementById("filter-count")
      typeFilter("red")
      typeFilter("")
      expect(count.textContent).toBe("")
    })

    it("excludes header rows from filtering", () => {
      typeFilter("name")
      // "Name" is in the header, but header rows aren't counted as data rows
      // The header row should always be visible
      const headerRow = document.querySelector("tr:first-child")
      expect(headerRow.style.display).not.toBe("none")
    })
  })

  describe("title attribute matching", () => {
    beforeEach(() => {
      setupDOM(`
        <input id="table-filter">
        <table class="filterable-table">
          <tr><th>Character</th></tr>
          <tr><td><span title="ma; freq=high">马</span></td></tr>
          <tr><td><span title="shi; freq=low">是</span></td></tr>
        </table>
      `)
    })

    it("matches title attributes", () => {
      typeFilter("ma")
      expect(visibleDataRows().length).toBe(1)
    })

    it("matches title attributes case insensitively", () => {
      typeFilter("FREQ=HIGH")
      expect(visibleDataRows().length).toBe(1)
    })
  })

  describe("group filter (rowspan tables)", () => {
    beforeEach(() => {
      setupDOM(`
        <input id="table-filter">
        <span id="filter-count"></span>
        <table class="filterable-table">
          <thead><tr><th>Group</th><th>Item</th></tr></thead>
          <tbody>
            <tr><td rowspan="2">Fruits</td><td>Apple</td></tr>
            <tr><td>Banana</td></tr>
            <tr><td rowspan="2">Vegetables</td><td>Carrot</td></tr>
            <tr><td>Daikon</td></tr>
          </tbody>
        </table>
      `)
    })

    it("shows all groups when filter is empty", () => {
      typeFilter("")
      const rows = document.querySelectorAll("tbody tr")
      Array.from(rows).forEach((row) => {
        expect(row.style.display).not.toBe("none")
      })
    })

    it("shows entire group when any row matches", () => {
      typeFilter("banana")
      // Fruits group has Apple and Banana; Banana matches so both should be visible
      const rows = document.querySelectorAll("tbody tr")
      expect(rows[0].style.display).toBe("") // Fruits + Apple
      expect(rows[1].style.display).toBe("") // Banana
      expect(rows[2].style.display).toBe("none") // Vegetables + Carrot
      expect(rows[3].style.display).toBe("none") // Daikon
    })

    it("shows group when group header matches", () => {
      typeFilter("fruits")
      const rows = document.querySelectorAll("tbody tr")
      expect(rows[0].style.display).toBe("")
      expect(rows[1].style.display).toBe("")
    })

    it("hides all groups when nothing matches", () => {
      typeFilter("xyz")
      const rows = document.querySelectorAll("tbody tr")
      Array.from(rows).forEach((row) => {
        expect(row.style.display).toBe("none")
      })
    })

    it("updates count with group count", () => {
      const count = document.getElementById("filter-count")
      typeFilter("fruits")
      expect(count.textContent).toBe("1 of 2")
    })
  })

  describe("missing elements", () => {
    it("does nothing without #table-filter input", () => {
      setupDOM('<table class="filterable-table"><tr><td>Data</td></tr></table>')
      // Should not throw
    })

    it("does nothing without .filterable-table", () => {
      setupDOM('<input id="table-filter">')
      // Should not throw
    })

    it("works without #filter-count element", () => {
      setupDOM(`
        <input id="table-filter">
        <table class="filterable-table">
          <tr><td>Apple</td></tr>
          <tr><td>Banana</td></tr>
        </table>
      `)
      typeFilter("apple")
      expect(visibleDataRows().length).toBe(1)
    })
  })
})
