import { describe, test, expect, beforeEach, jest } from "@jest/globals"
import { EventManager } from "../js/EventManager.js"

/**
 * jsdom reports a zero-sized rect for every element, which would make the
 * canvas scale factors infinite. Pin the rect so coordinate maths is testable:
 * a 400x300 canvas displayed at 200x150 means a 2x scale on both axes.
 */
function stubCanvasRect(canvas) {
  canvas.width = 400
  canvas.height = 300
  canvas.getBoundingClientRect = () => ({ left: 10, top: 20, width: 200, height: 150 })
}

function mouse(type, clientX, clientY) {
  return new MouseEvent(type, { clientX, clientY, bubbles: true })
}

function touch(type, clientX, clientY) {
  const event = new Event(type, { bubbles: true, cancelable: true })
  event.touches = [{ clientX, clientY }]
  return event
}

describe("EventManager", () => {
  let ui
  let callbacks
  let canvas

  beforeEach(() => {
    document.body.innerHTML = `
      <canvas id="game-canvas"></canvas>
      <div id="species-palette">
        <button class="species-btn" data-species-id="2"><span>emoji</span></button>
      </div>
      <button id="play-btn"></button>
      <button id="pause-btn"></button>
      <button id="step-btn"></button>
      <button id="step-back-btn"></button>
      <button id="reset-btn"></button>
      <button class="speed-btn active" data-speed="normal"></button>
      <button class="speed-btn" data-speed="fast"></button>
      <input id="text-field" />
    `
    canvas = document.getElementById("game-canvas")
    stubCanvasRect(canvas)

    ui = {
      elements: {
        canvas,
        speciesPalette: document.getElementById("species-palette"),
        playBtn: document.getElementById("play-btn"),
        pauseBtn: document.getElementById("pause-btn"),
        stepBtn: document.getElementById("step-btn"),
        stepBackBtn: document.getElementById("step-back-btn"),
        resetBtn: document.getElementById("reset-btn"),
      },
    }

    callbacks = {
      onCanvasProbe: jest.fn(() => false),
      onCanvasDrag: jest.fn(),
      onCanvasHover: jest.fn(),
      onCanvasLeave: jest.fn(),
      onPlay: jest.fn(),
      onPause: jest.fn(),
      onStep: jest.fn(),
      onStepBack: jest.fn(),
      onReset: jest.fn(),
      onSpeedChange: jest.fn(),
      onSpeciesSelect: jest.fn(),
      onTogglePlay: jest.fn(),
    }

    new EventManager(ui, callbacks)
  })

  describe("canvas coordinates", () => {
    test("scales client coordinates to canvas space", () => {
      canvas.dispatchEvent(mouse("mousedown", 60, 95))
      // (60 - 10) * (400 / 200) = 100, (95 - 20) * (300 / 150) = 150
      expect(callbacks.onCanvasDrag).toHaveBeenCalledWith(100, 150, "place")
    })
  })

  describe("drag mode", () => {
    test("starts an erase drag when the first cell is occupied", () => {
      callbacks.onCanvasProbe.mockReturnValue(true)
      canvas.dispatchEvent(mouse("mousedown", 60, 95))
      expect(callbacks.onCanvasDrag).toHaveBeenCalledWith(100, 150, "erase")
    })

    test("keeps the initial mode for the rest of the drag", () => {
      // Probe says "occupied" on mousedown, so the whole gesture erases -- even
      // as it passes over empty cells that would otherwise be placed on.
      callbacks.onCanvasProbe.mockReturnValueOnce(true).mockReturnValue(false)
      canvas.dispatchEvent(mouse("mousedown", 60, 95))
      canvas.dispatchEvent(mouse("mousemove", 110, 95))

      const modes = callbacks.onCanvasDrag.mock.calls.map((args) => args[2])
      expect(modes).toEqual(["erase", "erase"])
    })

    test("reports hover instead of drag when no button is held", () => {
      canvas.dispatchEvent(mouse("mousemove", 60, 95))
      expect(callbacks.onCanvasHover).toHaveBeenCalledWith(100, 150)
      expect(callbacks.onCanvasDrag).not.toHaveBeenCalled()
    })

    test("mouseup ends the drag", () => {
      canvas.dispatchEvent(mouse("mousedown", 60, 95))
      canvas.dispatchEvent(mouse("mouseup", 60, 95))
      callbacks.onCanvasDrag.mockClear()

      canvas.dispatchEvent(mouse("mousemove", 110, 95))

      expect(callbacks.onCanvasDrag).not.toHaveBeenCalled()
      expect(callbacks.onCanvasHover).toHaveBeenCalled()
    })

    test("leaving the canvas ends the drag and notifies", () => {
      canvas.dispatchEvent(mouse("mousedown", 60, 95))
      canvas.dispatchEvent(mouse("mouseleave", 0, 0))
      callbacks.onCanvasDrag.mockClear()

      canvas.dispatchEvent(mouse("mousemove", 110, 95))

      expect(callbacks.onCanvasLeave).toHaveBeenCalled()
      expect(callbacks.onCanvasDrag).not.toHaveBeenCalled()
    })
  })

  describe("touch", () => {
    test("touchstart begins a drag at the touch point", () => {
      canvas.dispatchEvent(touch("touchstart", 60, 95))
      expect(callbacks.onCanvasDrag).toHaveBeenCalledWith(100, 150, "place")
    })

    test("touchmove only drags while a touch is active", () => {
      canvas.dispatchEvent(touch("touchmove", 60, 95))
      expect(callbacks.onCanvasDrag).not.toHaveBeenCalled()

      canvas.dispatchEvent(touch("touchstart", 60, 95))
      canvas.dispatchEvent(touch("touchmove", 110, 95))
      expect(callbacks.onCanvasDrag).toHaveBeenCalledTimes(2)
    })

    test("touchstart prevents the default scroll gesture", () => {
      const event = touch("touchstart", 60, 95)
      canvas.dispatchEvent(event)
      expect(event.defaultPrevented).toBe(true)
    })
  })

  describe("buttons", () => {
    test.each([
      ["play-btn", "onPlay"],
      ["pause-btn", "onPause"],
      ["step-btn", "onStep"],
      ["step-back-btn", "onStepBack"],
      ["reset-btn", "onReset"],
    ])("%s calls %s", (id, callbackName) => {
      document.getElementById(id).click()
      expect(callbacks[callbackName]).toHaveBeenCalled()
    })

    test("speed buttons report the chosen speed", () => {
      document.querySelector('[data-speed="fast"]').click()
      expect(callbacks.onSpeedChange).toHaveBeenCalledWith("fast")
    })

    test("only the chosen speed button stays active", () => {
      document.querySelector('[data-speed="fast"]').click()
      const active = [...document.querySelectorAll(".speed-btn.active")]
      expect(active.map((b) => b.dataset.speed)).toEqual(["fast"])
    })

    test("clicking a species button selects it by numeric id", () => {
      document.querySelector(".species-btn span").click()
      expect(callbacks.onSpeciesSelect).toHaveBeenCalledWith(2)
    })

    test("clicking the palette background selects nothing", () => {
      document.getElementById("species-palette").click()
      expect(callbacks.onSpeciesSelect).not.toHaveBeenCalled()
    })
  })

  describe("keyboard", () => {
    function press(key) {
      // Dispatch on body, as a browser does when nothing is focused, and let it
      // bubble to the document listener. Dispatching on `document` directly
      // would make e.target the Document, which has no .closest().
      const event = new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true })
      document.body.dispatchEvent(event)
      return event
    }

    test.each([
      [" ", "onTogglePlay"],
      ["r", "onReset"],
      ["R", "onReset"],
      ["ArrowRight", "onStep"],
      ["ArrowLeft", "onStepBack"],
    ])("%s calls %s", (key, callbackName) => {
      press(key)
      expect(callbacks[callbackName]).toHaveBeenCalled()
    })

    test("number keys select a species", () => {
      press("3")
      expect(callbacks.onSpeciesSelect).toHaveBeenCalledWith(3)
    })

    test("space is swallowed so it does not scroll the page", () => {
      expect(press(" ").defaultPrevented).toBe(true)
    })

    test("unhandled keys do nothing", () => {
      press("q")
      for (const callback of Object.values(callbacks)) {
        expect(callback).not.toHaveBeenCalled()
      }
    })

    test("shortcuts are ignored while typing in a field", () => {
      const field = document.getElementById("text-field")
      field.dispatchEvent(new KeyboardEvent("keydown", { key: " ", bubbles: true }))
      expect(callbacks.onTogglePlay).not.toHaveBeenCalled()
    })

    test("space on a focused button activates the button, not the shortcut", () => {
      // The browser turns Space on a focused button into a click, so the
      // shortcut handler must keep its hands off both the callback and the
      // default action.
      const button = document.getElementById("reset-btn")
      const event = new KeyboardEvent("keydown", { key: " ", bubbles: true, cancelable: true })
      button.dispatchEvent(event)

      expect(callbacks.onTogglePlay).not.toHaveBeenCalled()
      expect(event.defaultPrevented).toBe(false)
    })

    test("arrow keys on a focused button do not step the simulation", () => {
      const button = document.getElementById("reset-btn")
      button.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }))
      expect(callbacks.onStep).not.toHaveBeenCalled()
    })

    test("shortcuts are ignored for elements inside a button", () => {
      const inner = document.querySelector(".species-btn span")
      inner.dispatchEvent(new KeyboardEvent("keydown", { key: " ", bubbles: true }))
      expect(callbacks.onTogglePlay).not.toHaveBeenCalled()
    })
  })

  test("constructs without a canvas", () => {
    // The page can render before the canvas exists; wiring must not throw.
    expect(() => new EventManager({ elements: {} }, callbacks)).not.toThrow()
  })
})
