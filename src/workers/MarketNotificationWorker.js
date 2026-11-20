const cron = require('node-cron');
const { defaultNotificationCheckMinutes } = require('../config/api');

class MarketNotificationWorker {
  constructor(alertService) {
    this.alertService = alertService;
    this._task = null;
  }

  startPeriodicEvaluation(intervalMinutes = defaultNotificationCheckMinutes) {
    const cronExpression = `*/${intervalMinutes} * * * *`;

    console.log(
      `[Worker] Iniciando avaliacao de notificacoes a cada ${intervalMinutes} minuto(s).`
    );

    this.evaluateNow();

    this._task = cron.schedule(cronExpression, () => {
      this.evaluateNow();
    });
  }

  stop() {
    if (this._task) {
      this._task.stop();
      console.log('[Worker] Avaliacao de notificacoes encerrada.');
    }
  }

  async evaluateNow() {
    try {
      const createdNotifications = await this.alertService.evaluateActiveSubscriptions();

      if (createdNotifications.length) {
        console.log(
          `[Worker] ${createdNotifications.length} notificacao(oes) criada(s) com sucesso.`
        );
      }
    } catch (err) {
      console.error(`[Worker] Erro durante avaliacao de notificacoes: ${err.message}`);
    }
  }
}

module.exports = MarketNotificationWorker;