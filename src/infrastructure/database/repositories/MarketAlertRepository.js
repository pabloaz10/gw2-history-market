const { randomUUID } = require('crypto');
const pool = require('../../../config/database');
const AlertSubscription = require('../../../core/entities/AlertSubscription');
const MarketNotification = require('../../../core/entities/MarketNotification');

function mapSubscriptionRow(row) {
  return new AlertSubscription({
    id: row.id,
    itemId: row.item_id,
    itemName: row.item_name,
    itemIcon: row.item_icon,
    conditionType: row.condition_type,
    periodDays: row.period_days,
    active: row.active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
}

function mapNotificationRow(row) {
  return new MarketNotification({
    id: row.id,
    itemId: row.item_id,
    itemName: row.item_name,
    itemIcon: row.item_icon,
    conditionType: row.condition_type,
    periodDays: row.period_days,
    triggeredPrice: row.triggered_price,
    triggeredAt: row.triggered_at,
    read: row.read,
    readAt: row.read_at,
  });
}

class MarketAlertRepository {
  async listActiveSubscriptions() {
    const result = await pool.query(
      `SELECT id, item_id, item_name, item_icon, condition_type, period_days, active, created_at, updated_at
       FROM alert_subscriptions
       WHERE active = TRUE
       ORDER BY updated_at DESC, created_at DESC`
    );

    return result.rows.map(mapSubscriptionRow);
  }

  async findSubscriptionByKey(itemId, conditionType, periodDays) {
    const result = await pool.query(
      `SELECT id, item_id, item_name, item_icon, condition_type, period_days, active, created_at, updated_at
       FROM alert_subscriptions
       WHERE item_id = $1 AND condition_type = $2 AND period_days = $3
       LIMIT 1`,
      [itemId, conditionType, periodDays]
    );

    return result.rows[0] ? mapSubscriptionRow(result.rows[0]) : null;
  }

  async upsertSubscription({ itemId, itemName, itemIcon = null, conditionType, periodDays }) {
    const existing = await this.findSubscriptionByKey(itemId, conditionType, periodDays);

    if (existing) {
      const result = await pool.query(
        `UPDATE alert_subscriptions
         SET item_name = $1,
             item_icon = $2,
             active = TRUE,
             updated_at = NOW()
         WHERE item_id = $3 AND condition_type = $4 AND period_days = $5
         RETURNING id, item_id, item_name, item_icon, condition_type, period_days, active, created_at, updated_at`,
        [itemName, itemIcon, itemId, conditionType, periodDays]
      );

      return { subscription: mapSubscriptionRow(result.rows[0]), created: false };
    }

    const result = await pool.query(
      `INSERT INTO alert_subscriptions (
         id, item_id, item_name, item_icon, condition_type, period_days, active
       ) VALUES ($1, $2, $3, $4, $5, $6, TRUE)
       RETURNING id, item_id, item_name, item_icon, condition_type, period_days, active, created_at, updated_at`,
      [`alt_${randomUUID()}`, itemId, itemName, itemIcon, conditionType, periodDays]
    );

    return { subscription: mapSubscriptionRow(result.rows[0]), created: true };
  }

  async deactivateSubscription(itemId, conditionType, periodDays) {
    const result = await pool.query(
      `UPDATE alert_subscriptions
       SET active = FALSE,
           updated_at = NOW()
       WHERE item_id = $1 AND condition_type = $2 AND period_days = $3
       RETURNING id`,
      [itemId, conditionType, periodDays]
    );

    return result.rowCount > 0;
  }

  async listNotifications({ status = 'all', page = 1, pageSize = 20 }) {
    const safePage = Math.max(1, page);
    const safePageSize = Math.min(50, Math.max(1, pageSize));
    const offset = (safePage - 1) * safePageSize;
    const whereClauses = [];

    if (status === 'read') {
      whereClauses.push('read = TRUE');
    } else if (status === 'unread') {
      whereClauses.push('read = FALSE');
    }

    const whereSql = whereClauses.length ? `WHERE ${whereClauses.join(' AND ')}` : '';

    const countResult = await pool.query(
      `SELECT COUNT(*)::int AS total
       FROM market_notifications
       ${whereSql}`
    );

    const unreadResult = await pool.query(
      `SELECT COUNT(*)::int AS unread_count
       FROM market_notifications
       WHERE read = FALSE`
    );

    const listResult = await pool.query(
      `SELECT id, item_id, item_name, item_icon, condition_type, period_days, triggered_price, triggered_at, read, read_at
       FROM market_notifications
       ${whereSql}
       ORDER BY triggered_at DESC
       LIMIT $1 OFFSET $2`,
      [safePageSize, offset]
    );

    return {
      data: listResult.rows.map(mapNotificationRow),
      meta: {
        page: safePage,
        pageSize: safePageSize,
        total: countResult.rows[0]?.total || 0,
        unreadCount: unreadResult.rows[0]?.unread_count || 0,
      },
    };
  }

  async getUnreadCount() {
    const result = await pool.query(
      `SELECT COUNT(*)::int AS unread_count
       FROM market_notifications
       WHERE read = FALSE`
    );

    return result.rows[0]?.unread_count || 0;
  }

  async createNotification({
    id,
    itemId,
    itemName,
    itemIcon = null,
    conditionType,
    periodDays,
    triggeredPrice,
    triggeredAt = new Date(),
  }) {
    const result = await pool.query(
      `INSERT INTO market_notifications (
         id, item_id, item_name, item_icon, condition_type, period_days, triggered_price, triggered_at, read, read_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, FALSE, NULL)
       RETURNING id, item_id, item_name, item_icon, condition_type, period_days, triggered_price, triggered_at, read, read_at`,
      [id || `ntf_${randomUUID()}`, itemId, itemName, itemIcon, conditionType, periodDays, triggeredPrice, triggeredAt]
    );

    return mapNotificationRow(result.rows[0]);
  }

  async findNotificationInCooldown(itemId, conditionType, periodDays, since) {
    const result = await pool.query(
      `SELECT id, item_id, item_name, item_icon, condition_type, period_days, triggered_price, triggered_at, read, read_at
       FROM market_notifications
       WHERE item_id = $1
         AND condition_type = $2
         AND period_days = $3
         AND triggered_at >= $4
       ORDER BY triggered_at DESC
       LIMIT 1`,
      [itemId, conditionType, periodDays, since]
    );

    return result.rows[0] ? mapNotificationRow(result.rows[0]) : null;
  }

  async markNotificationAsRead(notificationId) {
    const result = await pool.query(
      `UPDATE market_notifications
       SET read = TRUE,
           read_at = COALESCE(read_at, NOW())
       WHERE id = $1
       RETURNING id, item_id, item_name, item_icon, condition_type, period_days, triggered_price, triggered_at, read, read_at`,
      [notificationId]
    );

    return result.rows[0] ? mapNotificationRow(result.rows[0]) : null;
  }

  async markAllNotificationsAsRead() {
    await pool.query(
      `UPDATE market_notifications
       SET read = TRUE,
           read_at = COALESCE(read_at, NOW())
       WHERE read = FALSE`
    );

    return this.getUnreadCount();
  }

  async deleteNotification(notificationId) {
    const result = await pool.query(
      `DELETE FROM market_notifications
       WHERE id = $1`,
      [notificationId]
    );

    return result.rowCount > 0;
  }
}

module.exports = MarketAlertRepository;