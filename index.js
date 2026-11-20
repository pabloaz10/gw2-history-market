require('dotenv').config();

const pool = require('./src/config/database');
const GW2APIClient = require('./src/infrastructure/api/GW2APIClient');
const PostgresPriceRepository = require('./src/infrastructure/database/repositories/PostgresPriceRepository');
const MarketAlertRepository = require('./src/infrastructure/database/repositories/MarketAlertRepository');
const PriceHistoryWorker = require('./src/workers/PriceHistoryWorker');
const MarketNotificationWorker = require('./src/workers/MarketNotificationWorker');
const MarketAnalyzer = require('./src/core/services/MarketAnalyzer');
const MarketAlertService = require('./src/core/services/MarketAlertService');
const createHttpServer = require('./src/api/httpServer');

// IDs dos itens a monitorar — adicione ou remova conforme necessário.
// Exemplo: 19721 = Glob of Ectoplasm, 24295 = Mithril Ore, 19976 = Iron Ore
const TARGET_ITEM_IDS = (process.env.TARGET_ITEM_IDS || '19721,24295,19976')
  .split(',')
  .map((id) => parseInt(id.trim()))
  .filter(Boolean);

async function main() {
  // Verifica conexão com o banco antes de iniciar
  try {
    await pool.query('SELECT 1');
    console.log('[App] Conexão com o banco de dados estabelecida.');
  } catch (err) {
    console.error('[App] Não foi possível conectar ao banco de dados:', err.message);
    process.exit(1);
  }

  const apiClient = new GW2APIClient();
  const repository = new PostgresPriceRepository();
  const alertRepository = new MarketAlertRepository();
  const marketAnalyzer = new MarketAnalyzer(repository);
  const alertService = new MarketAlertService(alertRepository, repository);
  const worker = new PriceHistoryWorker(apiClient, repository, TARGET_ITEM_IDS);
  const notificationWorker = new MarketNotificationWorker(alertService);
  const app = createHttpServer({ marketAnalyzer, worker, alertService });
  const apiPort = parseInt(process.env.API_PORT || '3000');

  const server = app.listen(apiPort, () => {
    console.log(`[API] Servidor HTTP escutando na porta ${apiPort}.`);
  });

  worker.startPeriodicFetch();
  notificationWorker.startPeriodicEvaluation();

  // Encerramento gracioso
  process.on('SIGTERM', () => {
    console.log('[App] Encerrando...');
    worker.stop();
    notificationWorker.stop();
    server.close();
    pool.end();
  });

  process.on('SIGINT', () => {
    console.log('[App] Encerrando...');
    worker.stop();
    notificationWorker.stop();
    server.close();
    pool.end();
  });
}

main();
