class Trend {
  /**
   * @param {number} itemId
   * @param {number} currentPrice        - Preço atual de venda
   * @param {Date}   currentPriceAt      - Data/hora do preço atual consultado
   * @param {number} oldPrice            - Preço no início do período analisado
   * @param {Date}   oldPriceAt          - Data/hora do preço antigo consultado
   * @param {number} growthPercentage    - Variação % (positivo = valorização)
   * @param {number} highestPriceInPeriod
   * @param {Date}   highestPriceAt      - Data/hora em que o preço máximo ocorreu
   * @param {number} lowestPriceInPeriod
   * @param {Date}   lowestPriceAt       - Data/hora em que o preço mínimo ocorreu
   */
  constructor(
    itemId,
    currentPrice,
    currentPriceAt,
    oldPrice,
    oldPriceAt,
    growthPercentage,
    highestPriceInPeriod,
    highestPriceAt,
    lowestPriceInPeriod,
    lowestPriceAt
  ) {
    this.itemId = itemId;
    this.currentPrice = currentPrice;
    this.currentPriceAt = currentPriceAt;
    this.oldPrice = oldPrice;
    this.oldPriceAt = oldPriceAt;
    this.growthPercentage = growthPercentage;
    this.highestPriceInPeriod = highestPriceInPeriod;
    this.highestPriceAt = highestPriceAt;
    this.lowestPriceInPeriod = lowestPriceInPeriod;
    this.lowestPriceAt = lowestPriceAt;
  }
}

module.exports = Trend;
