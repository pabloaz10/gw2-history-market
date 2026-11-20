class MarketNotification {
  constructor({
    id,
    itemId,
    itemName,
    itemIcon = null,
    conditionType,
    periodDays,
    triggeredPrice,
    triggeredAt,
    read,
    readAt = null,
  }) {
    this.id = id;
    this.itemId = itemId;
    this.itemName = itemName;
    this.itemIcon = itemIcon;
    this.conditionType = conditionType;
    this.periodDays = periodDays;
    this.triggeredPrice = triggeredPrice;
    this.triggeredAt = triggeredAt;
    this.read = read;
    this.readAt = readAt;
  }
}

module.exports = MarketNotification;