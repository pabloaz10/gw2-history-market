/**
 * Migration 001 - Cria as tabelas iniciais do banco de dados.
 * Execute com: node src/infrastructure/database/migrations/001_create_tables.js
 */
require('dotenv').config();
const pool = require('../../../config/database');

const SQL = `
  CREATE TABLE IF NOT EXISTS items (
    item_id   INTEGER PRIMARY KEY,
    name      TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS alert_subscriptions (
    id             TEXT PRIMARY KEY,
    item_id        INTEGER NOT NULL,
    item_name      TEXT NOT NULL,
    item_icon      TEXT,
    condition_type TEXT NOT NULL,
    period_days    INTEGER NOT NULL DEFAULT 7,
    active         BOOLEAN NOT NULL DEFAULT TRUE,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (item_id, condition_type, period_days)
  );

  CREATE INDEX IF NOT EXISTS idx_alert_subscriptions_active
    ON alert_subscriptions (active, condition_type, period_days);

  CREATE TABLE IF NOT EXISTS market_notifications (
    id              TEXT PRIMARY KEY,
    item_id         INTEGER NOT NULL,
    item_name       TEXT NOT NULL,
    item_icon       TEXT,
    condition_type  TEXT NOT NULL,
    period_days     INTEGER NOT NULL DEFAULT 7,
    triggered_price INTEGER NOT NULL,
    triggered_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    read            BOOLEAN NOT NULL DEFAULT FALSE,
    read_at         TIMESTAMPTZ
  );

  CREATE INDEX IF NOT EXISTS idx_market_notifications_item_condition
    ON market_notifications (item_id, condition_type, period_days, triggered_at DESC);

  CREATE INDEX IF NOT EXISTS idx_market_notifications_read
    ON market_notifications (read, triggered_at DESC);

  CREATE TABLE IF NOT EXISTS price_history (
    id          BIGSERIAL PRIMARY KEY,
    item_id     INTEGER     NOT NULL REFERENCES items(item_id) ON DELETE CASCADE,
    buy_price   INTEGER     NOT NULL,
    sell_price  INTEGER     NOT NULL,
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  CREATE INDEX IF NOT EXISTS idx_price_history_item_recorded
    ON price_history (item_id, recorded_at DESC);
`;

async function migrate() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(SQL);
    await client.query('COMMIT');
    console.log('[Migration] Tabelas criadas/verificadas com sucesso.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[Migration] Erro:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();
