const axios = require('axios');
const { baseUrl, chunkSize, requestTimeoutMs } = require('../../config/api');
const PriceRecord = require('../../core/entities/PriceRecord');
const InventoryItem = require('../../core/entities/InventoryItem');

class GW2APIClient {
  constructor() {
    this.client = axios.create({
      baseURL: baseUrl,
      timeout: requestTimeoutMs,
    });
  }

  /**
   * Busca os preços atuais de uma lista de itens.
   * A API do GW2 aceita no máximo 200 IDs por requisição, então fazemos chunks.
   * @param {number[]} itemIds
   * @returns {Promise<PriceRecord[]>}
   */
  async fetchPrices(itemIds) {
    const chunks = this._chunkArray(itemIds, chunkSize);
    const results = [];

    for (const chunk of chunks) {
      const ids = chunk.join(',');
      const response = await this.client.get(`/commerce/prices?ids=${ids}`);
      const timestamp = new Date();

      for (const entry of response.data) {
        results.push(
          new PriceRecord(entry.id, entry.buys.unit_price, entry.sells.unit_price, timestamp)
        );
      }
    }

    return results;
  }

  /**
   * Busca os itens do banco do jogador.
   * @param {string} apiKey
   * @returns {Promise<InventoryItem[]>}
   */
  async fetchBank(apiKey) {
    const response = await this.client.get('/account/bank', {
      headers: { Authorization: `Bearer ${apiKey}` },
    });

    return response.data
      .filter((slot) => slot !== null)
      .map((slot) => new InventoryItem(slot.id, slot.count));
  }

  /**
   * Busca os materiais do storage do jogador.
   * @param {string} apiKey
   * @returns {Promise<InventoryItem[]>}
   */
  async fetchMaterials(apiKey) {
    const response = await this.client.get('/account/materials', {
      headers: { Authorization: `Bearer ${apiKey}` },
    });

    return response.data
      .filter((m) => m.count > 0)
      .map((m) => new InventoryItem(m.id, m.count));
  }

  /**
   * Busca os itens de todos os personagens do jogador e retorna uma lista achatada.
   * @param {string} apiKey
   * @returns {Promise<InventoryItem[]>}
   */
  async fetchCharacters(apiKey) {
    const authHeader = { Authorization: `Bearer ${apiKey}` };

    const namesResponse = await this.client.get('/characters?ids=all', {
      headers: authHeader,
    });

    const items = [];

    for (const character of namesResponse.data) {
      if (!character.bags) continue;
      for (const bag of character.bags) {
        if (!bag || !bag.inventory) continue;
        for (const slot of bag.inventory) {
          if (slot) {
            items.push(new InventoryItem(slot.id, slot.count));
          }
        }
      }
    }

    return items;
  }

  /**
   * Divide um array em sub-arrays de tamanho `size`.
   * @param {any[]} array
   * @param {number} size
   * @returns {any[][]}
   */
  _chunkArray(array, size) {
    const chunks = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }
}

module.exports = GW2APIClient;
