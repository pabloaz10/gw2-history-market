const InventoryItem = require('../entities/InventoryItem');

class InventoryAggregator {
  /**
   * @param {import('../../infrastructure/api/GW2APIClient')} gw2ApiClient
   */
  constructor(gw2ApiClient) {
    this.gw2ApiClient = gw2ApiClient;
  }

  /**
   * Busca e agrega todos os itens do inventário do jogador (banco, materiais e personagens).
   * @param {string} apiKey - Chave de API pessoal do jogador
   * @returns {Promise<InventoryItem[]>}
   */
  async getUserInventory(apiKey) {
    const [bank, materials, characters] = await Promise.all([
      this.gw2ApiClient.fetchBank(apiKey),
      this.gw2ApiClient.fetchMaterials(apiKey),
      this.gw2ApiClient.fetchCharacters(apiKey),
    ]);

    return this._mergeInventories(bank, materials, characters);
  }

  /**
   * Une todas as listas de itens somando quantidades duplicadas.
   * @param {InventoryItem[]} bank
   * @param {InventoryItem[]} materials
   * @param {InventoryItem[]} characters - itens de todos os personagens já achatados
   * @returns {InventoryItem[]}
   */
  _mergeInventories(bank, materials, characters) {
    const combined = [...bank, ...materials, ...characters].filter(Boolean);
    const totals = new Map();

    for (const item of combined) {
      const current = totals.get(item.itemId) || 0;
      totals.set(item.itemId, current + item.quantity);
    }

    return Array.from(totals.entries()).map(
      ([itemId, quantity]) => new InventoryItem(itemId, quantity)
    );
  }
}

module.exports = InventoryAggregator;
