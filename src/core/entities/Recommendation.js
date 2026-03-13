class Recommendation {
  /**
   * @param {number}      itemId
   * @param {number}      quantityOwned
   * @param {Trend}       trendData
   * @param {number}      potentialProfit - Lucro potencial em copper coins
   */
  constructor(itemId, quantityOwned, trendData, potentialProfit) {
    this.itemId = itemId;
    this.quantityOwned = quantityOwned;
    this.trendData = trendData;
    this.potentialProfit = potentialProfit;
  }
}

module.exports = Recommendation;
