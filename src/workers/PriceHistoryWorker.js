const cron = require('node-cron');
const { defaultFetchIntervalMinutes } = require('../config/api');

class PriceHistoryWorker {
  /**
   * @param {import('./infrastructure/api/GW2APIClient')}                          apiClient
   * @param {import('./infrastructure/database/repositories/PostgresPriceRepository')} repository
   * @param {number[]} targetItemIds - IDs dos itens que serão monitorados
   */
  constructor(apiClient, repository, targetItemIds) {
    this.apiClient = apiClient;
    this.repository = repository;
    this.targetItemIds = targetItemIds;
    this._task = null;
  }

  /**
   * Inicia a coleta periódica de preços.
   * @param {number} intervalMinutes
   */
  startPeriodicFetch(intervalMinutes = defaultFetchIntervalMinutes) {
    const cronExpression = `*/${intervalMinutes} * * * *`;

    console.log(
      `[Worker] Iniciando coleta de preços para ${this.targetItemIds.length} item(s) a cada ${intervalMinutes} minuto(s).`
    );

    // Executa imediatamente na primeira vez
    this._fetchAndSavePrices();

    this._task = cron.schedule(cronExpression, () => {
      this._fetchAndSavePrices();
    });
  }

  /**
   * Para o agendamento.
   */
  stop() {
    if (this._task) {
      this._task.stop();
      console.log('[Worker] Coleta de preços encerrada.');
    }
  }

  /**
   * Busca os preços atuais na API e os persiste no banco.
   * @private
   */
  async _fetchAndSavePrices() {
    const startedAt = new Date().toISOString();
    console.log(`[Worker] Iniciando coleta em ${startedAt}...`);

    try {
      const prices = await this.apiClient.fetchPrices(this.targetItemIds);
      await this.repository.savePrices(prices);
      console.log(`[Worker] ${prices.length} registro(s) salvos com sucesso.`);
    } catch (err) {
      console.error(`[Worker] Erro durante coleta: ${err.message}`);
    }
  }
}

module.exports = PriceHistoryWorker;
