const { randomUUID } = require('crypto');

class MarketAlertService {
  constructor(alertRepository, priceRepository) {
    this.alertRepository = alertRepository;
    this.priceRepository = priceRepository;
  }

  async listSubscriptions() {
    return this.alertRepository.listActiveSubscriptions();
  }

  async upsertSubscription(input) {
    const itemId = Number(input?.itemId);
    const itemName = String(input?.itemName || '').trim();
    const itemIcon = input?.itemIcon ? String(input.itemIcon).trim() : null;
    const conditionType = String(input?.conditionType || 'period_high_reached').trim();
    const periodDays = Number.isInteger(input?.periodDays) && input.periodDays > 0 ? input.periodDays : 7;

    if (!Number.isInteger(itemId) || itemId <= 0) {
      throw new Error('itemId invalido.');
    }

    if (!itemName) {
      throw new Error('itemName obrigatorio.');
    }

    if (conditionType !== 'period_high_reached') {
      throw new Error('conditionType invalido.');
    }

    const { subscription, created } = await this.alertRepository.upsertSubscription({
      id: `alt_${randomUUID()}`,
      itemId,
      itemName,
      itemIcon,
      conditionType,
      periodDays,
    });

    return { subscription, created };
  }

  async deactivateSubscription(itemId, conditionType = 'period_high_reached', periodDays = 7) {
    const numericItemId = Number(itemId);

    if (!Number.isInteger(numericItemId) || numericItemId <= 0) {
      throw new Error('itemId invalido.');
    }

    return this.alertRepository.deactivateSubscription(numericItemId, conditionType, periodDays);
  }

  async getUnreadCount() {
    return this.alertRepository.getUnreadCount();
  }

  async listNotifications(params = {}) {
    return this.alertRepository.listNotifications(params);
  }

  async markNotificationAsRead(notificationId) {
    return this.alertRepository.markNotificationAsRead(notificationId);
  }

  async markAllNotificationsAsRead() {
    const unreadCount = await this.alertRepository.markAllNotificationsAsRead();
    return { unreadCount };
  }

  async deleteNotification(notificationId) {
    return this.alertRepository.deleteNotification(notificationId);
  }

  async evaluateActiveSubscriptions({ cooldownHours = 12 } = {}) {
    const subscriptions = await this.listSubscriptions();
    const createdNotifications = [];

    for (const subscription of subscriptions) {
      const since = new Date();
      since.setDate(since.getDate() - subscription.periodDays);

      const history = await this.priceRepository.getPriceHistory(subscription.itemId, since);
      if (!history.length) continue;

      history.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
      const currentRecord = history[history.length - 1];
      const highestPriceInPeriod = Math.max(...history.map((record) => record.sellPrice));

      if (currentRecord.sellPrice < highestPriceInPeriod) continue;

      const cooldownSince = new Date();
      cooldownSince.setHours(cooldownSince.getHours() - cooldownHours);

      const existing = await this.alertRepository.findNotificationInCooldown(
        subscription.itemId,
        subscription.conditionType,
        subscription.periodDays,
        cooldownSince
      );

      if (existing) continue;

      const notification = await this.alertRepository.createNotification({
        id: `ntf_${randomUUID()}`,
        itemId: subscription.itemId,
        itemName: subscription.itemName,
        itemIcon: subscription.itemIcon,
        conditionType: subscription.conditionType,
        periodDays: subscription.periodDays,
        triggeredPrice: currentRecord.sellPrice,
        triggeredAt: currentRecord.timestamp || new Date(),
      });

      createdNotifications.push(notification);
    }

    return createdNotifications;
  }
}

module.exports = MarketAlertService;