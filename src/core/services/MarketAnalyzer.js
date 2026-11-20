const Trend = require('../entities/Trend');
const Recommendation = require('../entities/Recommendation');

class MarketAnalyzer {
  /**
   * @param {import('../../infrastructure/database/repositories/PostgresPriceRepository')} priceRepository
   */
  constructor(priceRepository) {
    this.priceRepository = priceRepository;
  }

  /**
   * Analisa tendências de preço dos itens para os últimos N dias.
   * @param {number[]} itemIds
   * @param {number}   days
   * @returns {Promise<Trend[]>}
   */
  async analyzeTrends(itemIds, days) {
    const since = new Date();
    since.setDate(since.getDate() - days);

    const trends = [];

    for (const itemId of itemIds) {
      const history = await this.priceRepository.getPriceHistory(itemId, since);
      if (history.length < 2) continue;

      // Ordena do mais antigo para o mais recente
      history.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

      const oldestRecord = history[0];
      const currentRecord = history[history.length - 1];
      const oldPrice = oldestRecord.sellPrice;
      const currentPrice = currentRecord.sellPrice;
      const oldPriceAt = oldestRecord.timestamp;
      const currentPriceAt = currentRecord.timestamp;
      const highestPriceInPeriod = Math.max(...history.map((r) => r.sellPrice));
      const lowestPriceInPeriod = Math.min(...history.map((r) => r.sellPrice));
      const highestRecord = history.find((r) => r.sellPrice === highestPriceInPeriod);
      const lowestRecord = history.find((r) => r.sellPrice === lowestPriceInPeriod);
      const highestPriceAt = highestRecord?.timestamp || currentPriceAt;
      const lowestPriceAt = lowestRecord?.timestamp || currentPriceAt;
      const growthPercentage = this._calculateGrowth(oldPrice, currentPrice);

      trends.push(
        new Trend(
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
        )
      );
    }

    return trends;
  }

  /**
   * Analisa a tendência curta em uma janela menor, como 12 horas.
   * @param {number[]} itemIds
   * @param {number} hours
   * @returns {Promise<Map<number, { direction: 'up'|'down'|'sideways', netChangePct: number, confidence: number }>>}
   */
  async analyzeShortTermTrend(itemIds, hours = 12) {
    const since = new Date();
    since.setHours(since.getHours() - hours);
    const result = new Map();

    for (const itemId of itemIds) {
      const history = await this.priceRepository.getPriceHistory(itemId, since);
      if (history.length < 2) continue;

      history.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

      const oldestRecord = history[0];
      const currentRecord = history[history.length - 1];
      const netChangePct = this._calculateGrowth(oldestRecord.sellPrice, currentRecord.sellPrice);

      result.set(itemId, {
        direction: this._calculateDirection(netChangePct),
        netChangePct,
        confidence: this._calculateConfidence(history.length, netChangePct),
      });
    }

    return result;
  }

  /**
   * Cruza o inventário do jogador com as tendências de mercado e gera recomendações.
   * @param {import('../entities/InventoryItem')[]} inventory
   * @param {Trend[]} trends
   * @returns {Recommendation[]}
   */
  generateRecommendations(inventory, trends) {
    const trendMap = new Map(trends.map((t) => [t.itemId, t]));
    const recommendations = [];

    for (const item of inventory) {
      const trend = trendMap.get(item.itemId);
      if (!trend) continue;

      // Lucro potencial = (preço mais alto no período - preço atual) * quantidade
      const potentialProfit = (trend.highestPriceInPeriod - trend.currentPrice) * item.quantity;

      recommendations.push(
        new Recommendation(item.itemId, item.quantity, trend, potentialProfit)
      );
    }

    // Ordena por maior lucro potencial primeiro
    return recommendations.sort((a, b) => b.potentialProfit - a.potentialProfit);
  }

  /**
   * Calcula a variação percentual entre dois preços.
   * @param {number} oldPrice
   * @param {number} currentPrice
   * @returns {number}
   */
  _calculateGrowth(oldPrice, currentPrice) {
    if (oldPrice === 0) return 0;
    return parseFloat((((currentPrice - oldPrice) / oldPrice) * 100).toFixed(2));
  }

  /**
   * @param {number} netChangePct
   * @returns {'up'|'down'|'sideways'}
   */
  _calculateDirection(netChangePct) {
    if (netChangePct > 1) return 'up';
    if (netChangePct < -1) return 'down';
    return 'sideways';
  }

  /**
   * @param {number} sampleSize
   * @param {number} netChangePct
   * @returns {number}
   */
  _calculateConfidence(sampleSize, netChangePct) {
    const sampleScore = Math.min(60, sampleSize * 12);
    const movementScore = Math.min(40, Math.abs(netChangePct) * 4);
    return Math.max(0, Math.min(100, Math.round(sampleScore + movementScore)));
  }
}

module.exports = MarketAnalyzer;
