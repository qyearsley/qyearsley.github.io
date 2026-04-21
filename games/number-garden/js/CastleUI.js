import { AREA_ICONS } from "./constants.js"

export class CastleUI {
  constructor(elements) {
    this.elements = elements
  }

  updateCastleScreen(projectInfo) {
    if (this.elements.castleScreenTitle) {
      this.elements.castleScreenTitle.textContent = projectInfo.title
    }
    if (this.elements.castleDescription) {
      const descriptions = {
        "Build a Castle": "Complete all areas to build the castle!",
        "Grow a Garden": "Complete all areas to grow your garden!",
        "Build a Robot": "Complete all areas to build your robot!",
        "Build a Rocket": "Complete all areas to build your rocket!",
      }
      this.elements.castleDescription.textContent =
        descriptions[projectInfo.title] ||
        `Complete all areas to build your ${projectInfo.title.toLowerCase()}!`
    }
  }

  updateCastleProgress(completed, total) {
    if (this.elements.castleProgressText) {
      this.elements.castleProgressText.textContent = `Pieces: ${completed}/${total}`
    }
  }

  displayCastlePieces(completedAreas) {
    if (!this.elements.castlePiecesDisplay) return

    this.elements.castlePiecesDisplay.innerHTML = ""

    Object.entries(AREA_ICONS).forEach(([areaId, emoji]) => {
      const piece = document.createElement("div")
      piece.className = "castle-piece"
      piece.textContent = emoji

      if (completedAreas.has(areaId)) {
        piece.classList.add("completed")
      } else {
        piece.classList.add("locked")
      }

      this.elements.castlePiecesDisplay.appendChild(piece)
    })
  }

  updateCastleBadge(completedCount) {
    if (!this.elements.castleButton) return

    const existingBadge = this.elements.castleButton.querySelector(".castle-badge")
    if (existingBadge) {
      existingBadge.remove()
    }

    if (completedCount > 0) {
      const badge = document.createElement("span")
      badge.className = "castle-badge"
      badge.textContent = completedCount
      this.elements.castleButton.appendChild(badge)
    }
  }

  showCastleNotification(
    areaName,
    totalPieces,
    projectInfo = { icon: "🏰", pieceName: "Castle Piece" },
  ) {
    if (!this.elements.castleNotification) return

    this.elements.castleNotification.innerHTML = `
      <div class="castle-notification-content">
        <div class="castle-notification-icon">${projectInfo.icon}</div>
        <div class="castle-notification-text">
          <strong>${areaName} Complete!</strong>
          <span>${projectInfo.pieceName} ${totalPieces}/6 collected!</span>
        </div>
      </div>
    `

    this.elements.castleNotification.classList.add("show")

    setTimeout(() => {
      this.elements.castleNotification.classList.remove("show")
    }, 2500)
  }

  showProjectProgress(projectType, completedCount, isComplete = false) {
    if (!this.elements.projectProgressModal) return

    const projectVisuals = {
      castle: ["🧱", "🧱🧱", "🧱🧱🧱", "🏰🧱", "🏰🏰", "🏰✨"],
      garden: ["🌱", "🌱🌱", "🌻", "🌻🌸", "🌻🌸🌺", "🌻🌸🌺🌷"],
      robot: ["🔧", "🔧⚙️", "🦾", "🦿🦾", "🤖", "🤖✨"],
      spaceship: ["🔩", "🔩🔧", "🛸", "🛸⚡", "🚀", "🚀✨"],
    }

    const projectTitles = {
      castle: "Building Your Castle!",
      garden: "Growing Your Garden!",
      robot: "Building Your Robot!",
      spaceship: "Building Your Rocket!",
    }

    const visual = projectVisuals[projectType]?.[completedCount - 1] || "🎯"
    const title = isComplete
      ? projectTitles[projectType]?.replace("Building", "Completed") ||
        projectTitles[projectType]?.replace("Growing", "Grew")
      : projectTitles[projectType]

    this.elements.projectModalTitle.textContent = title
    this.elements.projectVisual.textContent = visual
    this.elements.projectProgressText.textContent = isComplete
      ? "🎉 All areas complete! 🎉"
      : `Progress: ${completedCount}/6 areas complete`

    this.elements.projectProgressModal.classList.remove("hidden")
  }

  hideProjectProgress() {
    if (this.elements.projectProgressModal) {
      this.elements.projectProgressModal.classList.add("hidden")
    }
  }

  updateLevelCompleteScreen(
    starsEarned,
    flowersEarned,
    wasAreaCompleted,
    projectType,
    completedAreasCount,
  ) {
    const starsText = document.getElementById("level-stars-earned")
    if (starsText) {
      starsText.textContent = `${starsEarned} stars earned!`
    }

    const flowersText = document.getElementById("level-flowers-earned")
    if (flowersText) {
      flowersText.textContent = `${flowersEarned} flowers collected!`
    }

    const projectProgressContainer = document.getElementById("level-project-progress-container")
    if (projectProgressContainer) {
      if (wasAreaCompleted) {
        projectProgressContainer.classList.remove("hidden")

        const projectIcon = document.getElementById("level-project-icon")
        const projectMessage = document.getElementById("level-project-message")

        const projectVisuals = {
          castle: { icon: "🏰", pieceName: "Castle Piece" },
          garden: { icon: "🌻", pieceName: "Garden Section" },
          robot: { icon: "🤖", pieceName: "Robot Part" },
          spaceship: { icon: "🚀", pieceName: "Rocket Part" },
        }

        const projectInfo = projectVisuals[projectType] || projectVisuals.castle

        if (projectIcon) {
          projectIcon.textContent = projectInfo.icon
        }
        if (projectMessage) {
          projectMessage.textContent = `You earned a new ${projectInfo.pieceName.toLowerCase()}! (${completedAreasCount}/6)`
        }
      } else {
        projectProgressContainer.classList.add("hidden")
      }
    }
  }
}
