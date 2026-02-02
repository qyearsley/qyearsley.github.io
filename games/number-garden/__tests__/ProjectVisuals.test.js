import { describe, test, expect } from "@jest/globals"
import { ProjectVisuals } from "../js/ProjectVisuals.js"

describe("ProjectVisuals", () => {
  describe("createCastle", () => {
    test("returns SVG string for 0 pieces", () => {
      const svg = ProjectVisuals.createCastle(0)
      expect(svg).toContain("<svg")
      expect(svg).toContain("</svg>")
      expect(svg).toContain("0/6 pieces complete")
    })

    test("includes foundation at 1 piece", () => {
      const svg = ProjectVisuals.createCastle(1)
      expect(svg).toContain("Foundation")
      expect(svg).toContain("1/6 pieces complete")
    })

    test("includes main walls at 2 pieces", () => {
      const svg = ProjectVisuals.createCastle(2)
      expect(svg).toContain("Foundation")
      expect(svg).toContain("Main walls")
      expect(svg).toContain("2/6 pieces complete")
    })

    test("includes towers at 3 pieces", () => {
      const svg = ProjectVisuals.createCastle(3)
      expect(svg).toContain("Left tower")
      expect(svg).toContain("Right tower")
      expect(svg).toContain("3/6 pieces complete")
    })

    test("includes door and windows at 4 pieces", () => {
      const svg = ProjectVisuals.createCastle(4)
      expect(svg).toContain("Door")
      expect(svg).toContain("Windows")
      expect(svg).toContain("4/6 pieces complete")
    })

    test("includes center tower at 5 pieces", () => {
      const svg = ProjectVisuals.createCastle(5)
      expect(svg).toContain("Center tower")
      expect(svg).toContain("5/6 pieces complete")
    })

    test("shows completion message at 6 pieces", () => {
      const svg = ProjectVisuals.createCastle(6)
      expect(svg).toContain("Victory flag")
      expect(svg).toContain("Castle Complete!")
      expect(svg).not.toContain("6/6 pieces complete")
    })

    test("includes all previous pieces in later stages", () => {
      const svg = ProjectVisuals.createCastle(6)
      expect(svg).toContain("Foundation")
      expect(svg).toContain("Main walls")
      expect(svg).toContain("Left tower")
      expect(svg).toContain("Door")
      expect(svg).toContain("Center tower")
      expect(svg).toContain("Victory flag")
    })

    test("changes sky gradient when complete", () => {
      const incomplete = ProjectVisuals.createCastle(5)
      const complete = ProjectVisuals.createCastle(6)

      expect(incomplete).toContain("#e8e8e8")
      expect(complete).toContain("#87CEEB")
    })
  })

  describe("createGarden", () => {
    test("returns SVG string for 0 pieces", () => {
      const svg = ProjectVisuals.createGarden(0)
      expect(svg).toContain("<svg")
      expect(svg).toContain("</svg>")
      expect(svg).toContain("0/6 pieces complete")
    })

    test("includes ground at 1 piece", () => {
      const svg = ProjectVisuals.createGarden(1)
      expect(svg).toContain("Ground")
      expect(svg).toContain("1/6 pieces complete")
    })

    test("includes sunflower at 2 pieces", () => {
      const svg = ProjectVisuals.createGarden(2)
      expect(svg).toContain("Sunflower")
      expect(svg).toContain("2/6 pieces complete")
    })

    test("includes rose at 3 pieces", () => {
      const svg = ProjectVisuals.createGarden(3)
      expect(svg).toContain("Rose")
      expect(svg).toContain("3/6 pieces complete")
    })

    test("includes tulip at 4 pieces", () => {
      const svg = ProjectVisuals.createGarden(4)
      expect(svg).toContain("Tulip")
      expect(svg).toContain("4/6 pieces complete")
    })

    test("includes daisy at 5 pieces", () => {
      const svg = ProjectVisuals.createGarden(5)
      expect(svg).toContain("Daisy")
      expect(svg).toContain("5/6 pieces complete")
    })

    test("shows completion message at 6 pieces", () => {
      const svg = ProjectVisuals.createGarden(6)
      expect(svg).toContain("Butterflies")
      expect(svg).toContain("Garden Complete!")
      expect(svg).not.toContain("6/6 pieces complete")
    })

    test("changes sky gradient when complete", () => {
      const incomplete = ProjectVisuals.createGarden(5)
      const complete = ProjectVisuals.createGarden(6)

      expect(incomplete).toContain("#e8e8e8")
      expect(complete).toContain("#87CEEB")
    })
  })

  describe("createRobot", () => {
    test("returns SVG string for 0 pieces", () => {
      const svg = ProjectVisuals.createRobot(0)
      expect(svg).toContain("<svg")
      expect(svg).toContain("</svg>")
      expect(svg).toContain("0/6 pieces complete")
    })

    test("includes legs at 1 piece", () => {
      const svg = ProjectVisuals.createRobot(1)
      expect(svg).toContain("Legs")
      expect(svg).toContain("1/6 pieces complete")
    })

    test("includes body at 2 pieces", () => {
      const svg = ProjectVisuals.createRobot(2)
      expect(svg).toContain("Body")
      expect(svg).toContain("2/6 pieces complete")
    })

    test("includes arms at 3 pieces", () => {
      const svg = ProjectVisuals.createRobot(3)
      expect(svg).toContain("Left arm")
      expect(svg).toContain("Right arm")
      expect(svg).toContain("3/6 pieces complete")
    })

    test("includes neck at 4 pieces", () => {
      const svg = ProjectVisuals.createRobot(4)
      expect(svg).toContain("Neck")
      expect(svg).toContain("4/6 pieces complete")
    })

    test("includes head at 5 pieces", () => {
      const svg = ProjectVisuals.createRobot(5)
      expect(svg).toContain("Head")
      expect(svg).toContain("Eyes")
      expect(svg).toContain("5/6 pieces complete")
    })

    test("shows completion message at 6 pieces", () => {
      const svg = ProjectVisuals.createRobot(6)
      expect(svg).toContain("Second antenna")
      expect(svg).toContain("Robot Complete!")
      expect(svg).not.toContain("6/6 pieces complete")
    })

    test("changes background gradient when complete", () => {
      const incomplete = ProjectVisuals.createRobot(5)
      const complete = ProjectVisuals.createRobot(6)

      expect(incomplete).toContain("#e8e8e8")
      expect(complete).toContain("#1a1a2e")
    })
  })

  describe("createSpaceship", () => {
    test("returns SVG string for 0 pieces", () => {
      const svg = ProjectVisuals.createSpaceship(0)
      expect(svg).toContain("<svg")
      expect(svg).toContain("</svg>")
      expect(svg).toContain("0/6 pieces complete")
    })

    test("includes fins at 1 piece", () => {
      const svg = ProjectVisuals.createSpaceship(1)
      expect(svg).toContain("Rocket fins")
      expect(svg).toContain("1/6 pieces complete")
    })

    test("includes lower body at 2 pieces", () => {
      const svg = ProjectVisuals.createSpaceship(2)
      expect(svg).toContain("Main body (lower section)")
      expect(svg).toContain("2/6 pieces complete")
    })

    test("includes middle body at 3 pieces", () => {
      const svg = ProjectVisuals.createSpaceship(3)
      expect(svg).toContain("Main body (middle section)")
      expect(svg).toContain("3/6 pieces complete")
    })

    test("includes upper body at 4 pieces", () => {
      const svg = ProjectVisuals.createSpaceship(4)
      expect(svg).toContain("Main body (upper section)")
      expect(svg).toContain("4/6 pieces complete")
    })

    test("includes nose cone at 5 pieces", () => {
      const svg = ProjectVisuals.createSpaceship(5)
      expect(svg).toContain("Nose cone")
      expect(svg).toContain("5/6 pieces complete")
    })

    test("shows completion message at 6 pieces", () => {
      const svg = ProjectVisuals.createSpaceship(6)
      expect(svg).toContain("Engine flames")
      expect(svg).toContain("Rocket Complete!")
      expect(svg).toContain("Stars in background")
      expect(svg).not.toContain("6/6 pieces complete")
    })

    test("changes background gradient when complete", () => {
      const incomplete = ProjectVisuals.createSpaceship(5)
      const complete = ProjectVisuals.createSpaceship(6)

      expect(incomplete).toContain("#e8e8e8")
      expect(complete).toContain("#0a0a1a")
    })
  })

  describe("SVG structure", () => {
    test("all methods return valid SVG structure", () => {
      const methods = [
        ProjectVisuals.createCastle,
        ProjectVisuals.createGarden,
        ProjectVisuals.createRobot,
        ProjectVisuals.createSpaceship,
      ]

      methods.forEach((method) => {
        for (let pieces = 0; pieces <= 6; pieces++) {
          const svg = method(pieces)
          expect(svg).toContain("<svg")
          expect(svg).toContain("viewBox")
          expect(svg).toContain("</svg>")
          expect(svg).toContain("<defs>")
        }
      })
    })

    test("progress increments correctly", () => {
      const methods = [
        { fn: ProjectVisuals.createCastle, name: "Castle" },
        { fn: ProjectVisuals.createGarden, name: "Garden" },
        { fn: ProjectVisuals.createRobot, name: "Robot" },
        { fn: ProjectVisuals.createSpaceship, name: "Rocket" },
      ]

      methods.forEach(({ fn, name }) => {
        for (let pieces = 0; pieces < 6; pieces++) {
          const svg = fn(pieces)
          expect(svg).toContain(`${pieces}/6 pieces complete`)
        }
        const complete = fn(6)
        expect(complete).toContain(`${name} Complete!`)
      })
    })
  })
})
