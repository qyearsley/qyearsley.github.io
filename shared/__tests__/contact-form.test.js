import { jest } from "@jest/globals"

import "../../shared/contact-form.js"

const REAL_ACTION = "https://formspree.io/f/abc123"
const PLACEHOLDER_ACTION = "https://formspree.io/f/YOUR_FORM_ID"

function setupDOM(action) {
  document.body.innerHTML = `
    <form id="contact-form" method="POST" action="${action}">
      <input type="text" id="contact-name" name="name" />
      <input type="email" id="contact-email" name="email" />
      <textarea id="contact-message" name="message"></textarea>
      <button type="submit" class="submit-btn">Send</button>
      <p id="contact-status" class="status-message"></p>
    </form>
  `
  document.dispatchEvent(new Event("DOMContentLoaded"))
}

function form() {
  return document.getElementById("contact-form")
}

function status() {
  return document.getElementById("contact-status")
}

function button() {
  return document.querySelector("button[type=submit]")
}

// The submit handler is async, so the status line updates a microtask or two
// after the event is dispatched.
function submitForm() {
  const event = new Event("submit", { bubbles: true, cancelable: true })
  form().dispatchEvent(event)
  return new Promise((resolve) => setTimeout(resolve, 0))
}

function jsonResponse(ok, payload) {
  return {
    ok,
    json: () => Promise.resolve(payload),
  }
}

describe("contact-form.js", () => {
  afterEach(() => {
    delete global.fetch
  })

  describe("with a real endpoint", () => {
    beforeEach(() => {
      setupDOM(REAL_ACTION)
    })

    test("posts to the form action and reports success", async () => {
      global.fetch = jest.fn(() => Promise.resolve(jsonResponse(true, {})))

      document.getElementById("contact-name").value = "Ada"
      await submitForm()

      expect(global.fetch).toHaveBeenCalledTimes(1)
      const [url, options] = global.fetch.mock.calls[0]
      expect(url).toBe(REAL_ACTION)
      expect(options.method).toBe("POST")
      expect(options.headers.Accept).toBe("application/json")
      expect(options.body.get("name")).toBe("Ada")

      expect(status().textContent).toMatch(/on its way/)
      expect(status().className).toBe("success-message")
    })

    test("clears the fields after a successful send", async () => {
      global.fetch = jest.fn(() => Promise.resolve(jsonResponse(true, {})))

      document.getElementById("contact-name").value = "Ada"
      await submitForm()

      expect(document.getElementById("contact-name").value).toBe("")
    })

    test("does not navigate away", async () => {
      global.fetch = jest.fn(() => Promise.resolve(jsonResponse(true, {})))

      const event = new Event("submit", { bubbles: true, cancelable: true })
      form().dispatchEvent(event)
      expect(event.defaultPrevented).toBe(true)
    })

    test("surfaces field-level errors from the response", async () => {
      global.fetch = jest.fn(() =>
        Promise.resolve(
          jsonResponse(false, { errors: [{ field: "email", message: "Email is invalid" }] }),
        ),
      )

      await submitForm()

      expect(status().textContent).toBe("Email is invalid")
      expect(status().className).toBe("error-message")
    })

    test("joins multiple field errors", async () => {
      global.fetch = jest.fn(() =>
        Promise.resolve(
          jsonResponse(false, {
            errors: [{ message: "Email is invalid" }, { message: "Message is required" }],
          }),
        ),
      )

      await submitForm()

      expect(status().textContent).toBe("Email is invalid Message is required")
    })

    test("falls back to a generic message when the error body has no messages", async () => {
      global.fetch = jest.fn(() => Promise.resolve(jsonResponse(false, { errors: [] })))

      await submitForm()

      expect(status().textContent).toMatch(/didn't go through/)
      expect(status().className).toBe("error-message")
    })

    test("falls back to a generic message when the error body is not JSON", async () => {
      global.fetch = jest.fn(() =>
        Promise.resolve({ ok: false, json: () => Promise.reject(new Error("not JSON")) }),
      )

      await submitForm()

      expect(status().textContent).toMatch(/didn't go through/)
    })

    test("reports network failures", async () => {
      global.fetch = jest.fn(() => Promise.reject(new Error("offline")))

      await submitForm()

      expect(status().textContent).toMatch(/didn't go through/)
      expect(status().className).toBe("error-message")
    })

    test("re-enables the submit button after a failure", async () => {
      global.fetch = jest.fn(() => Promise.reject(new Error("offline")))

      await submitForm()

      expect(button().disabled).toBe(false)
      expect(form().getAttribute("aria-busy")).toBe("false")
    })

    test("disables the submit button while in flight", async () => {
      let release
      global.fetch = jest.fn(() => new Promise((resolve) => (release = resolve)))

      form().dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }))
      await Promise.resolve()

      expect(button().disabled).toBe(true)
      expect(form().getAttribute("aria-busy")).toBe("true")
      expect(status().textContent).toMatch(/Sending/)
      expect(status().className).toBe("status-message")

      release(jsonResponse(true, {}))
    })
  })

  describe("with the placeholder endpoint", () => {
    beforeEach(() => {
      setupDOM(PLACEHOLDER_ACTION)
    })

    test("refuses to submit and explains why", async () => {
      global.fetch = jest.fn()

      await submitForm()

      expect(global.fetch).not.toHaveBeenCalled()
      expect(status().textContent).toMatch(/isn't connected yet/)
      expect(status().className).toBe("error-message")
    })
  })

  describe("on pages without the form", () => {
    test("does nothing", () => {
      document.body.innerHTML = `<p>No form here</p>`
      expect(() => document.dispatchEvent(new Event("DOMContentLoaded"))).not.toThrow()
    })
  })
})
