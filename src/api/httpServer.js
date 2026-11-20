const express = require('express');
const cors = require('cors');
const InventoryItem = require('../core/entities/InventoryItem');

/**
 * @param {{ marketAnalyzer: import('../core/services/MarketAnalyzer'), worker: import('../workers/PriceHistoryWorker'), alertService: import('../core/services/MarketAlertService') }} deps
 */
function createHttpServer({ marketAnalyzer, worker, alertService }) {
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
    return analyzeMarket(req, res);
  });

  app.post('/api/market/analyze', async (req, res) => {
    return analyzeMarket(req, res);
  });

  app.get('/api/market-alerts', async (_req, res) => {
    try {
      const subscriptions = await alertService.listSubscriptions();
      return res.json({ data: subscriptions });
    } catch (err) {
      console.error('[API] Erro no GET /api/market-alerts:', err.message);
      return res.status(500).json({ error: 'Erro interno ao listar assinaturas.' });
    }
  });

  app.post('/api/market-alerts', async (req, res) => {
    try {
      const result = await alertService.upsertSubscription(req.body || {});
      return res.status(result.created ? 201 : 200).json({ data: result.subscription });
    } catch (err) {
      console.error('[API] Erro no POST /api/market-alerts:', err.message);
      return res.status(400).json({ error: err.message || 'Erro ao salvar assinatura.' });
    }
  });

  app.delete('/api/market-alerts/:itemId', async (req, res) => {
    try {
      const conditionType = String(req.query?.conditionType || 'period_high_reached');
      const parsedPeriodDays = Number.parseInt(req.query?.periodDays, 10);
      const periodDays = Number.isInteger(parsedPeriodDays) && parsedPeriodDays > 0 ? parsedPeriodDays : 7;
      const removed = await alertService.deactivateSubscription(req.params.itemId, conditionType, periodDays);

      if (!removed) {
        return res.status(404).json({ error: 'Assinatura nao encontrada.' });
      }

      return res.json({ ok: true });
    } catch (err) {
      console.error('[API] Erro no DELETE /api/market-alerts/:itemId:', err.message);
      return res.status(400).json({ error: err.message || 'Erro ao desativar assinatura.' });
    }
  });

  app.get('/api/market-notifications/unread-count', async (_req, res) => {
    try {
      const unreadCount = await alertService.getUnreadCount();
      return res.json({ unreadCount, serverTime: new Date().toISOString() });
    } catch (err) {
      console.error('[API] Erro no GET /api/market-notifications/unread-count:', err.message);
      return res.status(500).json({ error: 'Erro interno ao contar notificacoes.' });
    }
  });

  app.get('/api/market-notifications', async (req, res) => {
    try {
      const status = ['all', 'read', 'unread'].includes(String(req.query?.status))
        ? String(req.query.status)
        : 'all';
      const parsedPage = Number.parseInt(req.query?.page, 10);
      const parsedPageSize = Number.parseInt(req.query?.pageSize, 10);
      const page = Number.isInteger(parsedPage) && parsedPage > 0 ? parsedPage : 1;
      const pageSize = Number.isInteger(parsedPageSize) && parsedPageSize > 0 ? parsedPageSize : 20;
      const result = await alertService.listNotifications({ status, page, pageSize });
      return res.json(result);
    } catch (err) {
      console.error('[API] Erro no GET /api/market-notifications:', err.message);
      return res.status(500).json({ error: 'Erro interno ao listar notificacoes.' });
    }
  });

  app.patch('/api/market-notifications/:id/read', async (req, res) => {
    try {
      const notification = await alertService.markNotificationAsRead(req.params.id);

      if (!notification) {
        return res.status(404).json({ error: 'Notificacao nao encontrada.' });
      }

      const unreadCount = await alertService.getUnreadCount();
      return res.json({
        data: {
          id: notification.id,
          read: notification.read,
          readAt: notification.readAt,
        },
        meta: { unreadCount },
      });
    } catch (err) {
      console.error('[API] Erro no PATCH /api/market-notifications/:id/read:', err.message);
      return res.status(400).json({ error: 'Erro ao marcar notificacao como lida.' });
    }
  });

  app.patch('/api/market-notifications/read-all', async (_req, res) => {
    try {
      const { unreadCount } = await alertService.markAllNotificationsAsRead();
      return res.json({ ok: true, meta: { unreadCount } });
    } catch (err) {
      console.error('[API] Erro no PATCH /api/market-notifications/read-all:', err.message);
      return res.status(500).json({ error: 'Erro ao marcar notificacoes como lidas.' });
    }
  });

  app.delete('/api/market-notifications/:id', async (req, res) => {
    try {
      const removed = await alertService.deleteNotification(req.params.id);

      if (!removed) {
        return res.status(404).json({ error: 'Notificacao nao encontrada.' });
      }

      return res.json({ ok: true });
    } catch (err) {
      console.error('[API] Erro no DELETE /api/market-notifications/:id:', err.message);
      return res.status(500).json({ error: 'Erro ao remover notificacao.' });
    }
  });

  async function analyzeMarket(req, res) {
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

      const [trends, trend12hMap] = await Promise.all([
        marketAnalyzer.analyzeTrends(itemIds, days),
        marketAnalyzer.analyzeShortTermTrend(itemIds, 12),
      ]);

      const recommendations = marketAnalyzer.generateRecommendations(normalized, trends).map(
        (recommendation) => ({
          ...recommendation,
          trend12h: trend12hMap.get(recommendation.itemId) || {
            direction: 'sideways',
            netChangePct: 0,
            confidence: 0,
          },
        })
      );

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
  }

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
