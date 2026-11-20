module.exports = {
  baseUrl: 'https://api.guildwars2.com/v2',
  // Limite máximo de IDs por requisição aceito pela API do GW2
  chunkSize: 200,
  // Timeout em ms para requisições HTTP
  requestTimeoutMs: 10000,
  // Intervalo padrão de coleta em minutos
  defaultFetchIntervalMinutes: parseInt(process.env.FETCH_INTERVAL_MINUTES) || 5,
  // Intervalo padrão de avaliação das notificações em minutos
  defaultNotificationCheckMinutes: parseInt(process.env.NOTIFICATION_CHECK_INTERVAL_MINUTES) || 5,
};
