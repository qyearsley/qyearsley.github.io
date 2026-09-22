/** Finishing a season, the boss at the end of one, and finishing the run. */

import { beforeEach, describe, expect, it, jest } from "@jest/globals"
import { PHASE, PLAY, SEASON_ORDER } from "../js/constants.js"
import { getSeason } from "../js/seasons.js"
import { hudCount, many, resultButtons, summaryRows } from "./helpers.js"
import {
  SPRING,
  SUMMER,
  LAST_SEASON,
  TITLE,
  perfectRun,
  PERFECT_SPRING,
  boot,
  byId,
  isActive,
  choices,
  seasonRowLabel,
  feedback,
  saved,
  chooseCharacter,
  tapWrong,
  answerCorrectly,
  answerWrongly,
  missThenRecover,
  playSeasonPerfectly,
  bootInto,
  setupGameHarness,
} from "./game-harness.js"

setupGameHarness()

// The single highest-value gap the audit found: nothing exercised the end of a
// season at all, so `_renderResult`, `_unlockAfter`, `_onAdvance`, `_onRetry`,
// `_startNewRun` and the totals bookkeeping were all untested.
describe("playing a season to the end", () => {
  beforeEach(async () => {
    chooseCharacter("sloth")
    await playSeasonPerfectly()
  })

  it("hands over to the result screen with the season's figures", () => {
    expect(isActive("screen-result")).toBe(true)
    expect(isActive("screen-play")).toBe(false)
    expect(byId("result-title").textContent).toBe(TITLE.seasonComplete(SPRING))
    // Shape, not sentence: the winning copy has to name what she just counted.
    // The rest of the line is Ella's to rewrite.
    expect(byId("result-text").textContent).toContain(many(SPRING))
    expect(summaryRows()).toEqual([
      [`${SPRING.itemPlural} delivered`, String(PERFECT_SPRING)],
      ["She asked for", String(SPRING.demand)],
      ["Questions right", `${SPRING.spaces + 1} of ${SPRING.spaces + 1}`],
      ["Best streak", String(SPRING.spaces + 1)],
    ])
  })

  it("offers exactly one way onward, named after the next season", () => {
    expect(resultButtons().map((button) => button.textContent)).toEqual(["On to Summer"])
    expect(resultButtons()[0].className).toBe("big-btn is-primary")
    // `render` moves focus to the screen's heading after drawing it, so a
    // screen-reader user hears "Spring complete" rather than landing on a
    // button with no idea what just happened.
    expect(document.activeElement).toBe(byId("result-title"))
    expect(byId("result-title").getAttribute("tabindex")).toBe("-1")
  })

  it("unlocks summer and counts the season as cleared", () => {
    expect(saved().unlocked).toEqual(["spring", "summer"])
    expect(saved().totals.seasonsCleared).toBe(1)
    expect(saved().totals.runsCompleted).toBe(0)
    expect(saved().totals.questionsAnswered).toBe(SPRING.spaces + 1)
    expect(saved().totals.questionsCorrect).toBe(SPRING.spaces + 1)
    expect(saved().run.phase).toBe(PHASE.SEASON_WON)
    expect(saved().run.collected).toEqual({ spring: PERFECT_SPRING })
  })

  it("starts summer when the button is pressed", () => {
    resultButtons()[0].click()

    expect(isActive("screen-play")).toBe(true)
    expect(byId("season-name").textContent).toBe("Summer")
    expect(byId("demand-line").textContent).toBe(SUMMER.demandText)
    expect(hudCount()).toMatchObject({ items: 0, demand: SUMMER.demand, noun: many(SUMMER) })
    expect(document.querySelectorAll("#item-track .item-pip")).toHaveLength(SUMMER.demand)
    expect(saved().run.seasonId).toBe("summer")
    expect(saved().run.position).toBe(0)
    expect(saved().run.items).toBe(0)
    // Spring's tally survives into the run summary; the per-season counters do not.
    expect(saved().run.collected).toEqual({ spring: PERFECT_SPRING })
    // Summer is the first timed season, and this run reached it on a fresh save,
    // which since 2026-09-18 means the countdown is off. So the clock stays
    // hidden: crossing into a timed season does not switch it back on. The
    // sloth's ten extra seconds are covered in "the countdown setting" below.
    expect(byId("timer-wrap").classList.contains("hidden")).toBe(true)
  })

  it("does not unlock summer twice when spring is cleared again", () => {
    resultButtons()[0].click()
    expect(saved().unlocked).toEqual(["spring", "summer"])
  })
})

// The end of the run, which nothing reached before: no test in this file had
// ever seen PHASE.RUN_COMPLETE, so the run-complete branch of `_renderResult`
// and the `runsCompleted` tally were both unexercised.
//
// The screen's whole reason for existing is that its summary is per-season.
// Every per-season counter has been reset by the time the last season ends, so
// the default summary -- the one every other result screen uses -- reports that
// one season as though it were the entire journey. The assertions below are
// written against each season's own figures, and against the default summary
// explicitly *not* being what is on screen.
//
// Everything here reads SEASON_ORDER rather than naming four seasons, so a
// fifth one in seasons.js costs this block nothing.
describe("finishing the whole journey", () => {
  /** What each season banks when nothing is missed, in play order. */
  const PERFECT = SEASON_ORDER.map((id) => perfectRun(getSeason(id)))

  /** Every season but the last, which the boss tests below bank up front. */
  const EARLIER_SEASONS = SEASON_ORDER.slice(0, -1)

  /** The best streak a perfect run reaches: the last trail plus its boss. */
  const PERFECT_STREAK = LAST_SEASON.spaces + 1

  /** The last season's own figures, banked from the seeded boss question. */
  const LAST_FROM_BOSS = LAST_SEASON.demand + LAST_SEASON.boss.rescue

  /** A streak set by the seed, so the row cannot be right by coincidence. */
  const SEEDED_STREAK = 9

  /**
   * Play every season perfectly, pressing on at each result screen. The last
   * press is "Finish the journey", which is what ends the run.
   */
  async function playWholeRun() {
    chooseCharacter("sloth")
    for (let i = 0; i < SEASON_ORDER.length; i += 1) {
      await playSeasonPerfectly()
      resultButtons()[0].click()
    }
  }

  /**
   * Boot onto the last season's boss with earlier seasons already banked, so a
   * test can play the last stretch instead of every question of a full run.
   *
   * @param {Object<string, number>} collected - Seasons already delivered
   */
  async function bootIntoLastBoss(collected) {
    await bootInto({
      seasonId: LAST_SEASON.id,
      phase: PHASE.BOSS,
      position: LAST_SEASON.spaces,
      items: LAST_SEASON.demand,
      bestStreak: SEEDED_STREAK,
      collected,
    })
  }

  /** Answer the last season's boss and press through to the end of the run. */
  async function finishLastSeason() {
    await answerCorrectly()
    expect(byId("result-title").textContent).toBe(TITLE.seasonComplete(LAST_SEASON))
    resultButtons()[0].click()
  }

  it("ends the run once the last season is cleared, played all the way through", async () => {
    await playWholeRun()

    expect(isActive("screen-result")).toBe(true)
    expect(isActive("screen-play")).toBe(false)
    expect(byId("result-title").textContent).toBe(TITLE.runComplete)
    // The ending copy is Ella's; all this needs is that there *is* some, and
    // that the title above says which branch drew it.
    expect(byId("result-text").textContent.length).toBeGreaterThan(0)
    expect(saved().run.phase).toBe(PHASE.RUN_COMPLETE)
    expect(document.activeElement).toBe(byId("result-title"))
    expect(saved().run.collected).toEqual(
      Object.fromEntries(SEASON_ORDER.map((id, index) => [id, PERFECT[index]])),
    )
  })

  // The headline: one row per season, from `state.collected`, and emphatically
  // not the default summary of winter's counters.
  it("summarises every season played rather than the last one over and over", async () => {
    await playWholeRun()

    expect(summaryRows()).toEqual([
      ...SEASON_ORDER.map((id, index) => [seasonRowLabel(id), String(PERFECT[index])]),
      ["Best streak", String(PERFECT_STREAK)],
    ])

    // The label format, pinned once and only here. Every other row assertion in
    // this file derives it, so this is the single line to update if the summary
    // ever reads something other than "Spring — roses".
    expect(summaryRows()[0][0]).toBe(`${SPRING.name} — ${SPRING.itemPlural.toLowerCase()}`)

    // The exact screen this replaced. Spelled out rather than implied, because
    // dropping the rows argument silently falls back to precisely this.
    expect(summaryRows()).not.toEqual([
      [`${LAST_SEASON.itemPlural} delivered`, String(PERFECT.at(-1))],
      ["She asked for", String(LAST_SEASON.demand)],
      ["Questions right", `${PERFECT_STREAK} of ${PERFECT_STREAK}`],
      ["Best streak", String(PERFECT_STREAK)],
    ])
  })

  it("counts the completed run once, and not at the end of each season", async () => {
    chooseCharacter("sloth")
    const perSeason = []
    for (let i = 0; i < SEASON_ORDER.length; i += 1) {
      await playSeasonPerfectly()
      perSeason.push(saved().totals.runsCompleted)
      resultButtons()[0].click()
    }

    expect(perSeason).toEqual(SEASON_ORDER.map(() => 0))
    expect(saved().totals.runsCompleted).toBe(1)
    expect(saved().totals.seasonsCleared).toBe(SEASON_ORDER.length)
  })

  describe("the last stretch of it", () => {
    beforeEach(async () => {
      await bootIntoLastBoss(
        Object.fromEntries(EARLIER_SEASONS.map((id, index) => [id, PERFECT[index]])),
      )
      await finishLastSeason()
    })

    it("shows each season's own tally, the last from the boss it just answered", () => {
      expect(byId("result-title").textContent).toBe(TITLE.runComplete)
      expect(summaryRows()).toEqual([
        ...EARLIER_SEASONS.map((id, index) => [seasonRowLabel(id), String(PERFECT[index])]),
        [seasonRowLabel(LAST_SEASON.id), String(LAST_FROM_BOSS)],
        ["Best streak", String(SEEDED_STREAK)],
      ])
    })

    // The high-water mark for the whole run, not for winter: one correct boss
    // answer is a streak of 1, and the row still reports the seeded best.
    it("reports the run's best streak, last", () => {
      expect(saved().run.streak).toBe(1)
      expect(saved().run.bestStreak).toBe(SEEDED_STREAK)
      expect(summaryRows().at(-1)).toEqual(["Best streak", String(SEEDED_STREAK)])
    })

    it("offers one way onward, and it is Play again", () => {
      expect(resultButtons().map((button) => button.textContent)).toEqual(["Play again"])
      expect(resultButtons()[0].className).toBe("big-btn is-primary")
    })

    it("throws the run away when Play again is confirmed", () => {
      jest.spyOn(window, "confirm").mockReturnValue(true)
      resultButtons()[0].click()

      expect(window.confirm).toHaveBeenCalledTimes(1)
      expect(isActive("screen-character")).toBe(true)
      expect(isActive("screen-result")).toBe(false)
      expect(saved().run.phase).toBe(PHASE.CHARACTER_SELECT)
      expect(saved().run.seasonId).toBeNull()
      expect(saved().run.collected).toEqual({})
      // The journey goes; the ledger of journeys stays.
      expect(saved().totals.runsCompleted).toBe(1)
    })

    it("keeps the finished run when the confirm is dismissed", () => {
      jest.spyOn(window, "confirm").mockReturnValue(false)
      resultButtons()[0].click()

      expect(window.confirm).toHaveBeenCalledTimes(1)
      expect(isActive("screen-result")).toBe(true)
      expect(byId("result-title").textContent).toBe(TITLE.runComplete)
      expect(saved().run.phase).toBe(PHASE.RUN_COMPLETE)
      expect(saved().run.collected[LAST_SEASON.id]).toBe(LAST_FROM_BOSS)
    })

    it("counts the run once, and not again when the finished page is reloaded", async () => {
      expect(saved().totals.runsCompleted).toBe(1)
      const rows = summaryRows()

      await boot()

      expect(byId("result-title").textContent).toBe(TITLE.runComplete)
      expect(summaryRows()).toEqual(rows)
      expect(saved().totals.runsCompleted).toBe(1)
    })
  })

  // The filter is load-bearing, not decoration. `collected` comes off a save
  // file, and `storage.js` drops any key that is not a current season id -- so
  // a run carried across a season rename, or one saved before a season existed,
  // arrives here with a gap in it. The summary lists what was delivered rather
  // than one row per season in the calendar; without the filter the missing
  // ones render as "undefined".
  it("lists only the seasons that were actually cleared", async () => {
    await bootIntoLastBoss({ [SEASON_ORDER[0]]: PERFECT[0] })
    await finishLastSeason()

    expect(summaryRows()).toEqual([
      [seasonRowLabel(SEASON_ORDER[0]), String(PERFECT[0])],
      [seasonRowLabel(LAST_SEASON.id), String(LAST_FROM_BOSS)],
      ["Best streak", String(SEEDED_STREAK)],
    ])
    // The seasons in between were never delivered, so they get no row at all.
    for (const id of EARLIER_SEASONS.slice(1)) {
      expect(summaryRows().map(([label]) => label)).not.toContain(seasonRowLabel(id))
    }
    expect(summaryRows().map(([, value]) => value)).not.toContain("undefined")
  })
})

// The boss cannot be failed. Ella's rule was "if you miss the boss question you
// get a chance to go back and try again"; since 2026-09-21 the chance is the only
// outcome there is. Her question stays up until it is answered, the slip owes one
// more question, and the season resolves as won the moment both are done. The
// three failure options this block used to pin -- and the spare tries they
// counted -- are gone.
describe("the boss question", () => {
  /**
   * Spring's boss, reached with everything the trail pays already banked. Which
   * is the only way to arrive since the retune: her rescue makes up the rest of
   * the demand exactly.
   */
  const bootIntoBoss = () =>
    bootInto({
      phase: PHASE.BOSS,
      position: SPRING.spaces,
      items: SPRING.demand - SPRING.boss.rescue,
    })

  it("keeps her question up after a miss, without ending the season", async () => {
    await bootIntoBoss()
    answerWrongly()

    expect(isActive("screen-play")).toBe(true)
    expect(saved().run.phase).toBe(PHASE.BOSS)
    expect(saved().run.retrying).toBe(true)
    expect(saved().run.owed).toBe(1)
    expect(saved().run.position).toBe(SPRING.spaces)
    expect(choices()).toHaveLength(PLAY.CHOICE_COUNT)
    // Nothing has been taken, and nothing has been banked either.
    expect(hudCount()).toMatchObject({ items: SPRING.demand - SPRING.boss.rescue })
  })

  it("asks one more for the slip, then clears the season with the demand met", async () => {
    await bootIntoBoss()
    await missThenRecover()

    expect(isActive("screen-result")).toBe(true)
    expect(byId("result-title").textContent).toBe(TITLE.seasonComplete(SPRING))
    expect(saved().run.phase).toBe(PHASE.SEASON_WON)
    expect(saved().run.collected.spring).toBe(SPRING.demand)
    expect(saved().totals.seasonsCleared).toBe(1)
    expect(saved().unlocked).toEqual(["spring", "summer"])
    // One way on, and it goes to the next season rather than back here.
    expect(resultButtons().map((button) => button.textContent)).toEqual(["On to Summer"])
  })

  // The alignment the retune is for: the last answer of a season is the one that
  // finishes the count, however many tries it took to get there.
  it("lands on exactly the demand, missing nothing and overshooting nothing", async () => {
    await bootIntoBoss()
    await missThenRecover()

    expect(saved().run.items).toBe(SPRING.demand)
    expect(summaryRows().slice(0, 2)).toEqual([
      [`${SPRING.itemPlural} delivered`, String(SPRING.demand)],
      ["She asked for", String(SPRING.demand)],
    ])
  })
})

/**
 * The label above the boss question. It exists because Ella designed something
 * the screen never told the player: that answering the snake woman makes up for
 * the items the trail did not pay. Before this it was discoverable only by
 * getting it right.
 */
describe("the boss says what is at stake", () => {
  const atBoss = (run = {}) =>
    bootInto({
      phase: PHASE.BOSS,
      position: SPRING.spaces,
      items: SPRING.demand - SPRING.boss.rescue,
      ...run,
    })

  it("says what the question is worth, before it is answered", async () => {
    await atBoss()
    const tag = byId("question-tag").textContent
    expect(tag).toContain(String(SPRING.boss.rescue))
    expect(tag).toContain(SPRING.itemPlural.toLowerCase())
    expect(tag).toContain("snake woman")
    expect(byId("question-tag").classList.contains("hidden")).toBe(false)
  })

  // Her question has already happened by then, so the label says which one this
  // is rather than announcing her twice.
  it("says which question is which once the extra one is up", async () => {
    await atBoss({ extrasDone: 1 })
    const tag = byId("question-tag").textContent
    expect(tag).toMatch(/one more for her/i)
    expect(tag).toContain(String(SPRING.boss.rescue))
    expect(tag).not.toContain("snake woman")
  })

  // The rule Ella asked for applies to the boss like anywhere else: find the
  // answer yourself. Her question is the one place stating it would be most
  // tempting, since it is the last question of the season.
  it("gives nothing away when her question is missed", async () => {
    await atBoss()
    const answer = tapWrong()
    expect(feedback()).not.toContain(String(answer))
    expect(feedback()).toBe("Not quite — have another look.")
    expect(saved().run.phase).toBe(PHASE.BOSS)
  })
})
