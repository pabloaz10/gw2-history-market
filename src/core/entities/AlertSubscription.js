class AlertSubscription {
  constructor({
    id,
    itemId,
    itemName,
    itemIcon = null,
    conditionType,
    periodDays,
    active,
    createdAt,
    updatedAt,
  }) {
    this.id = id;
    this.itemId = itemId;
    this.itemName = itemName;
    this.itemIcon = itemIcon;
    this.conditionType = conditionType;
    this.periodDays = periodDays;
    this.active = active;
    this.createdAt = createdAt;
    this.updatedAt = updatedAt;
  }
}

module.exports = AlertSubscription;