/**
 * Manages NPC interactions and dialogs for NetGuard
 * Handles NPC dialog display and communication
 */
export class NPCManager {
  /**
   * @param {GameState} gameState - Game state instance
   * @param {GameUI} gameUI - Game UI instance
   */
  constructor(gameState, gameUI) {
    this.gameState = gameState
    this.gameUI = gameUI
  }

  /**
   * Talk to NPC at current node
   */
  talkToNPC() {
    const node = this.gameState.getCurrentNode()

    if (!node || !node.npc) {
      return
    }

    this.showDialog(node.npc.name, node.npc.dialog)
  }

  /**
   * Show dialog modal with NPC message
   * @param {string} npcName - NPC name
   * @param {string} message - Dialog message
   */
  showDialog(npcName, message) {
    this.gameUI.showDialog(npcName, message)
  }

  /**
   * Close dialog modal
   */
  closeDialog() {
    this.gameUI.closeDialog()
  }
}
