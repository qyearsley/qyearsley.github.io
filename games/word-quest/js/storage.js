/**
 * Storage manager for persisting game state
 * Extends the common StorageManager with Word Quest specific functionality
 */
import { StorageManager as BaseStorageManager } from "../../common/js/StorageManager.js"

export class StorageManager extends BaseStorageManager {
  constructor() {
    super("wordQuest", "1.0")
  }
}
