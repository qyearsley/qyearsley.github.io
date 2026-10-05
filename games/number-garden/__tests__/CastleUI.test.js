import { describe, test, expect, beforeEach } from "@jest/globals"
import { CastleUI } from "../js/CastleUI.js"
import { AREAS, AREA_ICONS } from "../js/constants.js"

describe("CastleUI", () => {
  let castle
  let elements

  beforeEach(() => {
    document.body.innerHTML = `
      <div id="castle-screen-title"></div>
      <div id="castle-description"></div>
      <div id="castle-progress-text"></div>
      <div id="castle-pieces-display"></div>
      <button id="castle-button"></button>
      <div id="project-progress-modal" class="hidden"></div>
      <div id="project-modal-title"></div>
      <div id="project-visual"></div>
      <div id="project-progress-text"></div>
      <div id="level-stars-earned"></div>
      <div id="level-flowers-earned"></div>
      <div id="level-project-progress-container" class="hidden"></div>
      <div id="level-project-icon"></div>
      <div id="level-project-message"></div>
    `

    elements = {
      castleScreenTitle: document.getElementById("castle-screen-title"),
      castleDescription: document.getElementById("castle-description"),
      castleProgressText: document.getElementById("castle-progress-text"),
      castlePiecesDisplay: document.getElementById("castle-pieces-display"),
      castleButton: document.getElementById("castle-button"),
      projectProgressModal: document.getElementById("project-progress-modal"),
      projectModalTitle: document.getElementById("project-modal-title"),
      projectVisual: document.getElementById("project-visual"),
      projectProgressText: document.getElementById("project-progress-text"),
    }

    castle = new CastleUI(elements)
  })

  test("updateCastleScreen sets the title and a known project's description", () => {
    castle.updateCastleScreen({ title: "Grow a Garden" })

    expect(elements.castleScreenTitle.textContent).toBe("Grow a Garden")
    expect(elements.castleDescription.textContent).toBe("Complete all areas to grow your garden!")
  })

  test("updateCastleScreen falls back to a generated description for an unlisted title", () => {
    castle.updateCastleScreen({ title: "Explore a Cave" })

    expect(elements.castleDescription.textContent).toBe(
      "Complete all areas to build your explore a cave!",
    )
  })

  test("updateCastleProgress and displayCastlePieces show the count and each area's state", () => {
    castle.updateCastleProgress(2, 6)
    expect(elements.castleProgressText.textContent).toBe("Pieces: 2/6")

    castle.displayCastlePieces(new Set([AREAS.FLOWER_MEADOW]))

    const pieces = elements.castlePiecesDisplay.querySelectorAll(".castle-piece")
    expect(pieces).toHaveLength(Object.keys(AREA_ICONS).length)
    expect(pieces[0].classList.contains("completed")).toBe(true)
    expect(pieces[0].classList.contains("locked")).toBe(false)
    expect(pieces[1].classList.contains("locked")).toBe(true)
  })

  test("updateCastleBadge adds a badge with the count, then removes the old one before adding the next", () => {
    castle.updateCastleBadge(3)
    let badge = elements.castleButton.querySelector(".castle-badge")
    expect(badge.textContent).toBe("3")

    castle.updateCastleBadge(0)
    expect(elements.castleButton.querySelector(".castle-badge")).toBeNull()

    castle.updateCastleBadge(5)
    badge = elements.castleButton.querySelector(".castle-badge")
    expect(badge.textContent).toBe("5")
    expect(elements.castleButton.querySelectorAll(".castle-badge")).toHaveLength(1)
  })

  test("hideProjectProgress hides the modal", () => {
    elements.projectProgressModal.classList.remove("hidden")

    castle.hideProjectProgress()

    expect(elements.projectProgressModal.classList.contains("hidden")).toBe(true)
  })

  test("updateLevelCompleteScreen reads and writes real DOM ids directly, not the injected elements", () => {
    castle.updateLevelCompleteScreen(3, 2, true, "robot", 4)

    expect(document.getElementById("level-stars-earned").textContent).toBe("3 stars earned!")
    expect(document.getElementById("level-flowers-earned").textContent).toBe("2 flowers collected!")
    expect(
      document.getElementById("level-project-progress-container").classList.contains("hidden"),
    ).toBe(false)
    expect(document.getElementById("level-project-icon").textContent).toBe("🤖")
    expect(document.getElementById("level-project-message").textContent).toBe(
      "You earned a new robot part! (4/6)",
    )
  })
})
