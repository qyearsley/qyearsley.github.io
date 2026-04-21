import "../../shared/prevnext.js"

function setupPage(pathname) {
  // Use jsdom's navigation API to change the pathname
  window.history.pushState({}, "", pathname)
  document.body.innerHTML = '<main class="main-content"><p>Content</p></main>'
  document.dispatchEvent(new Event("DOMContentLoaded"))
}

function getNav() {
  return document.querySelector(".prevnext-nav")
}

function getPrevLink() {
  return document.querySelector(".prevnext-link.prev")
}

function getNextLink() {
  return document.querySelector(".prevnext-link.next")
}

describe("prevnext.js", () => {
  it("creates prev and next links for middle page", () => {
    setupPage("/javascript/coinflip.html")
    expect(getNav()).not.toBeNull()
    expect(getPrevLink().textContent).toContain("Life Calculator")
    expect(getNextLink().textContent).toContain("Series Tester")
  })

  it("shows only next link for first page", () => {
    setupPage("/javascript/logic-engine/")
    expect(getNav()).not.toBeNull()
    expect(getPrevLink()).toBeNull()
    expect(getNextLink().textContent).toContain("Markov Generator")
  })

  it("shows only prev link for last page", () => {
    setupPage("/javascript/automata.html")
    expect(getNav()).not.toBeNull()
    expect(getNextLink()).toBeNull()
    expect(getPrevLink().textContent).toContain("Hash Collision Lab")
  })

  it("normalizes index.html in pathname", () => {
    setupPage("/javascript/logic-engine/index.html")
    expect(getNav()).not.toBeNull()
    expect(getNextLink()).not.toBeNull()
  })

  it("works for chinese section", () => {
    setupPage("/chinese/tonetable.html")
    expect(getNav()).not.toBeNull()
    expect(getPrevLink().textContent).toContain("Syllabary")
    expect(getNextLink().textContent).toContain("Pinyin Abbreviations")
  })

  it("does not create nav for non-matching page", () => {
    setupPage("/games/something/")
    const navs = document.querySelectorAll(".prevnext-nav")
    // Previous tests may have created navs; check the latest state
    // The handler runs but returns early, so no new nav is appended
    // to the fresh .main-content
    const main = document.querySelector(".main-content")
    const navInMain = main.querySelector(".prevnext-nav")
    expect(navInMain).toBeNull()
  })

  it("has proper aria-label", () => {
    setupPage("/javascript/coinflip.html")
    const nav = getNav()
    expect(nav.getAttribute("aria-label")).toBe("Previous and next pages")
  })

  it("prev link has Previous label", () => {
    setupPage("/javascript/coinflip.html")
    const label = getPrevLink().querySelector(".prevnext-label")
    expect(label.textContent).toBe("Previous")
  })

  it("next link has Next label", () => {
    setupPage("/javascript/coinflip.html")
    const label = getNextLink().querySelector(".prevnext-label")
    expect(label.textContent).toBe("Next")
  })

  it("injects prevnext styles", () => {
    setupPage("/javascript/coinflip.html")
    const styles = Array.from(document.querySelectorAll("style"))
    const hasStyles = styles.some((s) =>
      s.textContent.includes(".prevnext-nav"),
    )
    expect(hasStyles).toBe(true)
  })

  it("links have correct href", () => {
    setupPage("/javascript/coinflip.html")
    expect(getPrevLink().href).toContain("/javascript/date.html")
    expect(getNextLink().href).toContain("/javascript/seriestest.html")
  })
})
