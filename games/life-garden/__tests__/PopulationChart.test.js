import { describe, test, expect, beforeEach, afterEach } from "@jest/globals"
import { SPECIES } from "../js/constants.js"
import { SpeciesRegistry } from "../js/Species.js"
import { Grid } from "../js/Grid.js"
import { PopulationChart } from "../js/PopulationChart.js"

/**
 * jsdom has no 2d context, so drawing is stubbed out and the tests cover the
 * series bookkeeping -- which is the part that can silently go wrong, notably
 * when the player rewinds.
 */
function stubCtx() {
  return {
    clearRect() {},
    fillRect() {},
    beginPath() {},
    moveTo() {},
    lineTo() {},
    stroke() {},
    fillText() {},
  }
}

function makeChart({ legend = null } = {}) {
  const canvas = { width: 640, height: 120, getContext: () => stubCtx() }
  return new PopulationChart(canvas, new SpeciesRegistry(), legend)
}

function gridWith(counts) {
  const grid = new Grid(20, 20, new SpeciesRegistry())
  let placed = 0
  for (const [species, n] of Object.entries(counts)) {
    for (let i = 0; i < n; i++) {
      // Spread cells out; the chart only ever counts them.
      grid.setCell(placed % 20, Math.floor(placed / 20), Number(species))
      placed++
    }
  }
  return grid
}

describe("PopulationChart", () => {
  let chart

  beforeEach(() => {
    // jsdom implements no matchMedia, and render() asks it which palette to
    // paint. Stub the theme.js hook the chart prefers anyway.
    window.__prefersDark = () => false
    chart = makeChart()
  })

  afterEach(() => {
    delete window.__prefersDark
  })

  test("tracks every living species, life stages included", () => {
    expect(chart.species.map((s) => s.id)).toEqual([
      SPECIES.GRASS,
      SPECIES.BEE,
      SPECIES.RABBIT,
      SPECIES.FOX,
      SPECIES.FLOWERING_GRASS,
    ])
  })

  test("starts empty", () => {
    expect(chart.points).toHaveLength(0)
  })

  test("records one point per generation", () => {
    chart.record(0, gridWith({ [SPECIES.GRASS]: 3 }))
    chart.record(1, gridWith({ [SPECIES.GRASS]: 5 }))
    expect(chart.points.map((p) => p.gen)).toEqual([0, 1])
    expect(chart.points[1].counts[SPECIES.GRASS]).toBe(5)
  })

  test("counts each species separately", () => {
    chart.record(0, gridWith({ [SPECIES.GRASS]: 4, [SPECIES.RABBIT]: 2 }))
    const { counts } = chart.points[0]
    expect(counts[SPECIES.GRASS]).toBe(4)
    expect(counts[SPECIES.RABBIT]).toBe(2)
    expect(counts[SPECIES.FOX]).toBe(0)
  })

  test("re-recording the same generation replaces it", () => {
    // Painting cells before pressing play must move the last point, not stack
    // a column of samples at the same generation.
    chart.record(0, gridWith({ [SPECIES.GRASS]: 1 }))
    chart.record(0, gridWith({ [SPECIES.GRASS]: 7 }))
    expect(chart.points).toHaveLength(1)
    expect(chart.points[0].counts[SPECIES.GRASS]).toBe(7)
  })

  test("reset drops every point", () => {
    chart.record(0, gridWith({ [SPECIES.GRASS]: 1 }))
    chart.record(1, gridWith({ [SPECIES.GRASS]: 2 }))
    chart.reset()
    expect(chart.points).toHaveLength(0)
  })

  describe("rolling window", () => {
    test("keeps at most 200 points", () => {
      for (let gen = 0; gen <= 250; gen++) chart.record(gen, gridWith({ [SPECIES.GRASS]: 1 }))
      expect(chart.points).toHaveLength(200)
    })

    test("drops the oldest, not the newest", () => {
      for (let gen = 0; gen <= 250; gen++) chart.record(gen, gridWith({ [SPECIES.GRASS]: 1 }))
      expect(chart.points[0].gen).toBe(51)
      expect(chart.points[chart.points.length - 1].gen).toBe(250)
    })
  })

  describe("truncate, for Back", () => {
    beforeEach(() => {
      for (let gen = 0; gen <= 10; gen++) {
        chart.record(gen, gridWith({ [SPECIES.GRASS]: gen }))
      }
    })

    test("drops the generations that were rewound past", () => {
      chart.truncate(5)
      expect(chart.points.map((p) => p.gen)).toEqual([0, 1, 2, 3, 4, 5])
    })

    test("keeps the generation rewound to", () => {
      chart.truncate(5)
      expect(chart.points[chart.points.length - 1].counts[SPECIES.GRASS]).toBe(5)
    })

    test("stepping forward again overwrites the old future", () => {
      chart.truncate(5)
      chart.record(6, gridWith({ [SPECIES.GRASS]: 99 }))
      expect(chart.points.map((p) => p.gen)).toEqual([0, 1, 2, 3, 4, 5, 6])
      expect(chart.points[6].counts[SPECIES.GRASS]).toBe(99)
    })

    test("truncating to before the first point clears the chart", () => {
      chart.truncate(-1)
      expect(chart.points).toHaveLength(0)
    })

    test("truncating past the end changes nothing", () => {
      chart.truncate(100)
      expect(chart.points).toHaveLength(11)
    })
  })

  describe("scale", () => {
    test("is at least 1, so an empty grid still has a usable axis", () => {
      chart.record(0, gridWith({}))
      expect(chart._peak()).toBe(1)
    })

    test("follows the highest count across all species", () => {
      chart.record(0, gridWith({ [SPECIES.GRASS]: 3 }))
      chart.record(1, gridWith({ [SPECIES.RABBIT]: 12 }))
      expect(chart._peak()).toBe(12)
    })

    test("falls back when the peak is rewound away", () => {
      chart.record(0, gridWith({ [SPECIES.GRASS]: 3 }))
      chart.record(1, gridWith({ [SPECIES.RABBIT]: 12 }))
      chart.truncate(0)
      expect(chart._peak()).toBe(3)
    })
  })

  describe("legend", () => {
    test("writes a name and count for every species", () => {
      const legend = document.createElement("div")
      const withLegend = makeChart({ legend })
      withLegend.record(0, gridWith({ [SPECIES.GRASS]: 4 }))

      const items = [...legend.querySelectorAll(".chart-legend-item")]
      expect(items).toHaveLength(5)
      expect(items[0].textContent).toBe("Grass 4")
    })

    test("replaces the previous readout instead of appending", () => {
      const legend = document.createElement("div")
      const withLegend = makeChart({ legend })
      withLegend.record(0, gridWith({ [SPECIES.GRASS]: 4 }))
      withLegend.record(1, gridWith({ [SPECIES.GRASS]: 6 }))
      expect(legend.querySelectorAll(".chart-legend-item")).toHaveLength(5)
      expect(legend.querySelector(".chart-legend-item").textContent).toBe("Grass 6")
    })

    test("shows zeroes when there is nothing recorded", () => {
      const legend = document.createElement("div")
      makeChart({ legend }).reset()
      expect(legend.querySelector(".chart-legend-item").textContent).toBe("Grass 0")
    })
  })

  test("survives a canvas with no 2d context", () => {
    const chartWithoutCtx = new PopulationChart(
      { width: 640, height: 120, getContext: () => null },
      new SpeciesRegistry(),
    )
    expect(() => chartWithoutCtx.record(0, gridWith({ [SPECIES.GRASS]: 1 }))).not.toThrow()
    expect(chartWithoutCtx.points).toHaveLength(1)
  })

  test("renders without throwing at every point count", () => {
    for (const n of [0, 1, 2, 50]) {
      const c = makeChart()
      for (let gen = 0; gen < n; gen++) c.record(gen, gridWith({ [SPECIES.GRASS]: gen }))
      expect(() => c.render()).not.toThrow()
    }
  })

  describe("theme", () => {
    test("follows the site theme picker when it is present", () => {
      window.__prefersDark = () => true
      expect(chart._bgColor()).toBe("#1a202c")
      window.__prefersDark = () => false
      expect(chart._bgColor()).toBe("#f8fafc")
    })

    test("falls back to the OS preference when it is not", () => {
      delete window.__prefersDark
      window.matchMedia = () => ({ matches: true })
      expect(chart._bgColor()).toBe("#1a202c")
      delete window.matchMedia
    })
  })
})
