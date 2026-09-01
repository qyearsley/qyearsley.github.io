/**
 * Where theme.js puts its toggle button.
 *
 * Separate from theme.test.js because theme.js places the button once, from a
 * DOMContentLoaded handler, against whatever DOM exists at that moment. Each
 * Jest file gets its own module registry and its own jsdom, so a second file is
 * the only way to exercise a second starting DOM.
 *
 * The case that matters: Number Garden and Times Trail reuse `.header` for a
 * HUD row inside each of their stacked `.screen` panels. All but one of those
 * are `display: none`, so picking the first `.header` on the page put the
 * toggle inside a hidden element and it disappeared from the whole game.
 */
localStorage.clear()

document.body.innerHTML = `
  <main id="game-container">
    <div id="title-screen" class="screen active">
      <h1>A Game</h1>
    </div>
    <div id="hub-screen" class="screen">
      <div class="header"><span class="stats">HUD</span></div>
    </div>
  </main>
`

await import("../../shared/theme.js")

document.dispatchEvent(new Event("DOMContentLoaded"))

describe("theme.js toggle placement", () => {
  it("does not put the toggle inside a screen's header", () => {
    const btn = document.querySelector(".theme-toggle")
    expect(btn).not.toBeNull()
    expect(btn.closest(".screen")).toBeNull()
  })

  it("falls back to the body, where the fixed position rule applies", () => {
    const btn = document.querySelector(".theme-toggle")
    expect(btn.parentElement).toBe(document.body)
  })

  it("does not inject a .header-controls wrapper into a screen header", () => {
    expect(document.querySelector(".screen .header-controls")).toBeNull()
  })
})
