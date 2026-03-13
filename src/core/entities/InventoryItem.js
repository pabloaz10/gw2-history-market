class InventoryItem {
  /**
   * @param {number} itemId
   * @param {number} quantity
   */
  constructor(itemId, quantity) {
    this.itemId = itemId;
    this.quantity = quantity;
  }
}

module.exports = InventoryItem;
