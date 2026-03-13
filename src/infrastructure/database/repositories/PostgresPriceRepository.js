const pool = require('../../../config/database');
const PriceRecord = require('../../../core/entities/PriceRecord');

/**
 * Implementação PostgreSQL da interface PriceRepository.
 * Toda interação com a tabela price_history passa por aqui.
 */
class PostgresPriceRepository {
  /**
   * Persiste um lote de registros de preço.
   * Usa INSERT em batch para reduzir round-trips ao banco.
   * @param {PriceRecord[]} prices
   * @returns {Promise<void>}
   */
  async savePrices(prices) {
    if (!prices.length) return;

    // Garante a existência dos itens para satisfazer a FK de price_history.
    const uniqueItemIds = [...new Set(prices.map((p) => p.itemId))];
    const itemPlaceholders = uniqueItemIds.map((_, i) => `($${i + 1})`).join(', ');
    await pool.query(
      `INSERT INTO items (item_id)
       VALUES ${itemPlaceholders}
       ON CONFLICT (item_id) DO NOTHING`,
      uniqueItemIds
    );

    const values = [];
    const placeholders = prices.map((p, i) => {
      const base = i * 4;
      values.push(p.itemId, p.buyPrice, p.sellPrice, p.timestamp);
      return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4})`;
    });

    const sql = `
      INSERT INTO price_history (item_id, buy_price, sell_price, recorded_at)
      VALUES ${placeholders.join(', ')}
    `;

    await pool.query(sql, values);
  }

  /**
   * Retorna o histórico de preços de um item desde uma data.
   * @param {number} itemId
   * @param {Date}   since
   * @returns {Promise<PriceRecord[]>}
   */
  async getPriceHistory(itemId, since) {
    const result = await pool.query(
      `SELECT item_id, buy_price, sell_price, recorded_at
       FROM price_history
       WHERE item_id = $1 AND recorded_at >= $2
       ORDER BY recorded_at ASC`,
      [itemId, since]
    );

    return result.rows.map(
      (row) => new PriceRecord(row.item_id, row.buy_price, row.sell_price, row.recorded_at)
    );
  }

  /**
   * Retorna o maior preço de venda registrado para um item num período.
   * @param {number} itemId
   * @param {Date}   since
   * @returns {Promise<number>}
   */
  async getHighestPrice(itemId, since) {
    const result = await pool.query(
      `SELECT MAX(sell_price) AS highest
       FROM price_history
       WHERE item_id = $1 AND recorded_at >= $2`,
      [itemId, since]
    );

    return parseInt(result.rows[0]?.highest) || 0;
  }

  /**
   * Retorna o preço de venda mais próximo de uma data específica.
   * @param {number} itemId
   * @param {Date}   date
   * @returns {Promise<number>}
   */
  async getPriceAtDate(itemId, date) {
    const result = await pool.query(
      `SELECT sell_price
       FROM price_history
       WHERE item_id = $1
       ORDER BY ABS(EXTRACT(EPOCH FROM (recorded_at - $2::timestamptz)))
       LIMIT 1`,
      [itemId, date]
    );

    return parseInt(result.rows[0]?.sell_price) || 0;
  }
}

module.exports = PostgresPriceRepository;
