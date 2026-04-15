import { GOAL_TYPE } from "./constants.js"

export class GoalChecker {
  constructor() {
    // Track consecutive generation counts for "sustain" goals, keyed by goal index
    this.sustainCounters = {}
    // Track whether "reach" goals have been met at any point
    this.reachMet = {}
  }

  reset() {
    this.sustainCounters = {}
    this.reachMet = {}
  }

  /**
   * Check all goals against the current grid state.
   * @param {Array} goals - puzzle goal definitions
   * @param {import('./Grid.js').Grid} grid
   * @param {number} generation - current generation number
   * @returns {{ allMet: boolean, goalStatuses: Array<{ met: boolean, progress: string, label: string }> }}
   */
  check(goals, grid, generation) {
    const goalStatuses = goals.map((goal, i) => this._checkGoal(goal, grid, generation, i))
    return {
      allMet: goalStatuses.every((s) => s.met),
      goalStatuses,
    }
  }

  _checkGoal(goal, grid, generation, index) {
    switch (goal.type) {
      case GOAL_TYPE.SURVIVE:
        return this._checkSurvive(goal, grid, generation)
      case GOAL_TYPE.SUSTAIN:
        return this._checkSustain(goal, grid, index)
      case GOAL_TYPE.FILL_ZONE:
        return this._checkFillZone(goal, grid)
      case GOAL_TYPE.REACH:
        return this._checkReach(goal, grid, index)
      default:
        return { met: false, progress: "Unknown goal type", label: goal.type }
    }
  }

  _checkSurvive(goal, grid, generation) {
    const living = grid.countLiving()
    const met = generation >= goal.generations && living > 0
    return {
      met,
      progress: `Gen ${generation}/${goal.generations}, ${living} alive`,
      label: `Survive ${goal.generations} generations`,
    }
  }

  _checkSustain(goal, grid, index) {
    const count = grid.countSpecies(goal.species)
    if (count >= goal.count) {
      this.sustainCounters[index] = (this.sustainCounters[index] || 0) + 1
    } else {
      this.sustainCounters[index] = 0
    }
    const consecutive = this.sustainCounters[index] || 0
    const met = consecutive >= goal.generations
    const speciesName = goal.speciesName || `species ${goal.species}`
    return {
      met,
      progress: `${count}/${goal.count} ${speciesName}, ${consecutive}/${goal.generations} gens`,
      label: `Sustain ${goal.count}+ ${speciesName} for ${goal.generations} gens`,
    }
  }

  _checkFillZone(goal, grid) {
    const zone = goal.zone
    const totalCells = zone.w * zone.h
    const count = grid.countSpeciesInZone(goal.species, zone)
    const pct = Math.round((count / totalCells) * 100)
    const met = pct >= goal.percent
    const speciesName = goal.speciesName || `species ${goal.species}`
    return {
      met,
      progress: `${pct}%/${goal.percent}% ${speciesName}`,
      label: `Fill zone with ${goal.percent}%+ ${speciesName}`,
    }
  }

  _checkReach(goal, grid, index) {
    const count = grid.countSpecies(goal.species)
    if (count >= goal.count) {
      this.reachMet[index] = true
    }
    const met = !!this.reachMet[index]
    const speciesName = goal.speciesName || `species ${goal.species}`
    return {
      met,
      progress: met ? "Reached!" : `${count}/${goal.count} ${speciesName}`,
      label: `Reach ${goal.count} ${speciesName}`,
    }
  }
}
