// j/k keyboard navigation for links
document.addEventListener("keydown", (e) => {
  if (e.target.matches("input, textarea, select")) return

  const links = Array.from(document.querySelectorAll(".internal-links a, .game-list a"))
  const currentIndex = links.findIndex((link) => link === document.activeElement)

  if (e.key === "j" && currentIndex < links.length - 1) {
    e.preventDefault()
    links[currentIndex + 1].focus()
  } else if (e.key === "k" && currentIndex > 0) {
    e.preventDefault()
    links[currentIndex - 1].focus()
  } else if ((e.key === "j" || e.key === "k") && currentIndex === -1 && links.length > 0) {
    e.preventDefault()
    links[0].focus()
  }
})
