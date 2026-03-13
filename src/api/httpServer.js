const express = require('express');
const cors = require('cors');
const InventoryItem = require('../core/entities/InventoryItem');

/**
 * @param {{ marketAnalyzer: import('../core/services/MarketAnalyzer'), worker: import('../workers/PriceHistoryWorker') }} deps
 */
function createHttpServer({ marketAnalyzer, worker }) {
  const app = express();

  app.use(cors());
  app.use(express.json({ limit: '1mb' }));

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', service: 'gw2-history-market-api' });
  });

  app.post('/fetch-now', async (_req, res) => {
    try {
      await worker._fetchAndSavePrices();
      return res.json({ status: 'ok', message: 'Coleta executada com sucesso.' });
    } catch (err) {
      console.error('[API] Erro no /fetch-now:', err.message);
      return res.status(500).json({ error: 'Erro ao executar coleta manual.' });
    }
  });

  app.post('/analyze', async (req, res) => {
    try {
      const days = Number.isInteger(req.body?.days) && req.body.days > 0 ? req.body.days : 7;
      const inputInventory = req.body?.inventory;

      if (!Array.isArray(inputInventory) || inputInventory.length === 0) {
        return res.status(400).json({
          error: 'Payload invalido. Envie { "inventory": [{"itemId": 123, "quantity": 2}], "days": 7 }',
        });
      }

      const normalized = normalizeInventory(inputInventory);
      const itemIds = normalized.map((item) => item.itemId);

      const trends = await marketAnalyzer.analyzeTrends(itemIds, days);
      const recommendations = marketAnalyzer.generateRecommendations(normalized, trends);

      return res.json({
        meta: {
          days,
          requestedItems: itemIds.length,
          analyzedItems: trends.length,
          recommendationCount: recommendations.length,
        },
        data: recommendations,
      });
    } catch (err) {
      console.error('[API] Erro no /analyze:', err.message);
      return res.status(500).json({ error: 'Erro interno ao processar analise.' });
    }
  });

  return app;
}

/**
 * Normaliza o inventario recebido do front e agrega quantidades de item repetido.
 * @param {{itemId:number, quantity:number}[]} rawInventory
 * @returns {InventoryItem[]}
 */
function normalizeInventory(rawInventory) {
  const map = new Map();

  for (const row of rawInventory) {
    const itemId = Number(row?.itemId);
    const quantity = Number(row?.quantity);

    if (!Number.isInteger(itemId) || itemId <= 0) continue;
    if (!Number.isInteger(quantity) || quantity <= 0) continue;

    map.set(itemId, (map.get(itemId) || 0) + quantity);
  }

  return Array.from(map.entries()).map(([itemId, quantity]) => new InventoryItem(itemId, quantity));
}

module.exports = createHttpServer;
