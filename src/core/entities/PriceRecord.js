class PriceRecord {
  /**
   * @param {number} itemId
   * @param {number} buyPrice  - Melhor preço de compra (bid) em copper coins
   * @param {number} sellPrice - Melhor preço de venda (ask) em copper coins
   * @param {Date}   timestamp
   */
  constructor(itemId, buyPrice, sellPrice, timestamp = new Date()) {
    this.itemId = itemId;
    this.buyPrice = buyPrice;
    this.sellPrice = sellPrice;
    this.timestamp = timestamp;
  }
}

module.exports = PriceRecord;
