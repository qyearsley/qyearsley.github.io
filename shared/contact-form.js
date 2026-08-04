// Contact form submission — progressive enhancement for the form on /contact/.
//
// Without JavaScript the form still works: the browser POSTs to Formspree and
// Formspree renders its own confirmation page. With JavaScript we submit in the
// background so the visitor stays on the page and gets inline feedback.
//
// The endpoint lives in the form's `action` attribute (see contact/index.html).
// If that action still carries the placeholder ID -- a copied page, or an ID
// that got blanked out -- submission is blocked and the status line says so
// rather than POSTing to a URL that 404s.
;(function () {
  "use strict"

  // Sentinel for an unconfigured form. The live page has a real ID.
  const PLACEHOLDER_ID = "YOUR_FORM_ID"

  const MESSAGES = {
    unconfigured: "This form isn't connected yet. Please reach me on LinkedIn instead.",
    sending: "Sending...",
    sent: "Thanks — your message is on its way.",
    failed: "That didn't go through. Please try again, or reach me on LinkedIn.",
  }

  document.addEventListener("DOMContentLoaded", function () {
    const form = document.getElementById("contact-form")
    const status = document.getElementById("contact-status")
    if (!form || !status) return

    form.addEventListener("submit", function (e) {
      e.preventDefault()
      submit(form, status)
    })
  })

  // Formspree reports validation problems as {errors: [{field, message}]} and
  // other failures as {error: "..."}. Fall back to a generic message when the
  // body is missing, non-JSON, or shaped some other way.
  function errorFrom(payload) {
    if (!payload) return null
    if (Array.isArray(payload.errors)) {
      const messages = payload.errors
        .map(function (err) {
          return err && err.message
        })
        .filter(Boolean)
      if (messages.length > 0) return messages.join(" ")
    }
    if (typeof payload.error === "string" && payload.error) return payload.error
    return null
  }

  function setStatus(status, message, kind) {
    status.textContent = message
    status.className = kind ? kind + "-message" : "status-message"
  }

  function setBusy(form, busy) {
    const button = form.querySelector("button[type=submit]")
    if (button) button.disabled = busy
    form.setAttribute("aria-busy", busy ? "true" : "false")
  }

  async function submit(form, status) {
    const action = form.getAttribute("action") || ""
    if (action.indexOf(PLACEHOLDER_ID) !== -1) {
      setStatus(status, MESSAGES.unconfigured, "error")
      return
    }

    setBusy(form, true)
    setStatus(status, MESSAGES.sending, null)

    try {
      const response = await fetch(action, {
        method: "POST",
        body: new FormData(form),
        headers: { Accept: "application/json" },
      })

      if (response.ok) {
        form.reset()
        setStatus(status, MESSAGES.sent, "success")
        return
      }

      let payload = null
      try {
        payload = await response.json()
      } catch (_) {
        /* error body wasn't JSON */
      }
      setStatus(status, errorFrom(payload) || MESSAGES.failed, "error")
    } catch (_) {
      // Network error, offline, or the request was blocked.
      setStatus(status, MESSAGES.failed, "error")
    } finally {
      setBusy(form, false)
    }
  }
})()
