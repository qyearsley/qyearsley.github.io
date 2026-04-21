import {
  state,
  addPremise,
  addDerivedSteps,
  clearAll,
  setStatus,
  setError,
  clearError,
  loadExample,
} from "../state.js"

describe("Logic Engine State", () => {
  beforeEach(() => {
    clearAll()
  })

  describe("addPremise", () => {
    it("adds a step with correct fields", () => {
      const ast = { type: "variable", name: "p" }
      addPremise("p", ast)
      expect(state.steps.length).toBe(1)
      expect(state.steps[0].expression).toBe("p")
      expect(state.steps[0].ast).toBe(ast)
      expect(state.steps[0].isPremise).toBe(true)
      expect(state.steps[0].timestamp).toBeGreaterThan(0)
    })

    it("trims whitespace from expression", () => {
      addPremise("  p -> q  ", {})
      expect(state.steps[0].expression).toBe("p -> q")
    })

    it("increments IDs", () => {
      addPremise("p", {})
      addPremise("q", {})
      expect(state.steps[0].id).toBe(1)
      expect(state.steps[1].id).toBe(2)
    })
  })

  describe("addDerivedSteps", () => {
    it("adds multiple derived conclusions", () => {
      const conclusions = [
        {
          expression: "q",
          ast: {},
          justification: "Modus Ponens",
          referencedStepIds: [1, 2],
        },
        {
          expression: "r",
          ast: {},
          justification: "Simplification",
          referencedStepIds: [3],
        },
      ]
      addDerivedSteps(conclusions)
      expect(state.steps.length).toBe(2)
      expect(state.steps[0].isPremise).toBe(false)
      expect(state.steps[0].justification).toBe("Modus Ponens")
      expect(state.steps[0].referencedStepIds).toEqual([1, 2])
      expect(state.steps[1].justification).toBe("Simplification")
    })

    it("assigns sequential IDs after premises", () => {
      addPremise("p", {})
      addPremise("q", {})
      addDerivedSteps([
        { expression: "r", ast: {}, justification: "MP", referencedStepIds: [1, 2] },
      ])
      expect(state.steps[2].id).toBe(3)
    })
  })

  describe("clearAll", () => {
    it("resets all state", () => {
      addPremise("p", {})
      setError("something")
      clearAll()
      expect(state.steps).toEqual([])
      expect(state.nextId).toBe(1)
      expect(state.status).toBe("IDLE")
      expect(state.errorMessage).toBe("")
    })
  })

  describe("setStatus", () => {
    it("updates the status", () => {
      setStatus("LOADING")
      expect(state.status).toBe("LOADING")
      setStatus("SUCCESS")
      expect(state.status).toBe("SUCCESS")
    })
  })

  describe("setError", () => {
    it("sets error message and ERROR status", () => {
      setError("bad input")
      expect(state.errorMessage).toBe("bad input")
      expect(state.status).toBe("ERROR")
    })
  })

  describe("clearError", () => {
    it("clears error message and resets status to IDLE", () => {
      setError("something")
      clearError()
      expect(state.errorMessage).toBe("")
      expect(state.status).toBe("IDLE")
    })

    it("does not change non-ERROR status", () => {
      setStatus("LOADING")
      clearError()
      expect(state.status).toBe("LOADING")
    })
  })

  describe("loadExample", () => {
    it("clears existing state and loads premises", () => {
      addPremise("old", {})
      const premises = [
        { expression: "p", ast: { type: "var" } },
        { expression: "p -> q", ast: { type: "impl" } },
      ]
      loadExample(premises)
      expect(state.steps.length).toBe(2)
      expect(state.steps[0].expression).toBe("p")
      expect(state.steps[1].expression).toBe("p -> q")
      expect(state.steps[0].isPremise).toBe(true)
    })
  })
})
