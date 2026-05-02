# Documentação da API

Esta documentação descreve os endpoints HTTP expostos pela aplicação, o formato esperado de entrada e o que cada rota responde.

## Convenções gerais

- A API responde em JSON.
- Em caso de erro, o formato padrão é `{ "error": "mensagem" }`.
- Alguns endpoints retornam `{ "data": ... }`, outros retornam `{ "ok": true }` ou metadados adicionais.

## Resumo dos endpoints

| Método | Rota                                     | Descrição                                           |
| ------ | ---------------------------------------- | --------------------------------------------------- |
| GET    | `/health`                                | Verifica se o serviço está no ar                    |
| POST   | `/fetch-now`                             | Executa a coleta manual de preços                   |
| POST   | `/analyze`                               | Analisa o inventário informado e gera recomendações |
| POST   | `/api/market/analyze`                    | Alias de `/analyze`                                 |
| GET    | `/api/market-alerts`                     | Lista assinaturas de alerta ativas                  |
| POST   | `/api/market-alerts`                     | Cria ou reativa uma assinatura de alerta            |
| DELETE | `/api/market-alerts/:itemId`             | Desativa uma assinatura de alerta                   |
| GET    | `/api/market-notifications/unread-count` | Retorna a quantidade de notificações não lidas      |
| GET    | `/api/market-notifications`              | Lista notificações com paginação                    |
| PATCH  | `/api/market-notifications/:id/read`     | Marca uma notificação como lida                     |
| PATCH  | `/api/market-notifications/read-all`     | Marca todas as notificações como lidas              |
| DELETE | `/api/market-notifications/:id`          | Remove uma notificação                              |

## GET /health

Verifica se a API está ativa.

### Resposta de sucesso - GET /health

```json
{
	"status": "ok",
	"service": "gw2-history-market-api"
}
```

## POST /fetch-now

Executa a rotina de coleta de preços imediatamente.

### Request - POST /fetch-now

Sem corpo obrigatório.

### Resposta de sucesso - POST /fetch-now

```json
{
	"status": "ok",
	"message": "Coleta executada com sucesso."
}
```

### Erros possíveis - POST /fetch-now

- `500` com `{ "error": "Erro ao executar coleta manual." }`

## POST /analyze e POST /api/market/analyze

Analisa o inventário informado e retorna recomendações de mercado com base no histórico dos itens.

### Exemplo de request - POST /analyze

```json
{
	"days": 7,
	"inventory": [
		{ "itemId": 19721, "quantity": 5 },
		{ "itemId": 24295, "quantity": 10 }
	]
}
```

### Regras do payload - POST /analyze

- `inventory` é obrigatório e deve ser um array com pelo menos um item.
- Cada item precisa ter `itemId` inteiro positivo e `quantity` inteiro positivo.
- Itens inválidos ou repetidos são normalizados internamente; quantidades do mesmo `itemId` são somadas.
- `days` é opcional. Se não for enviado, o valor padrão é `7`.

### Resposta de sucesso - POST /analyze

```json
{
	"meta": {
		"days": 7,
		"requestedItems": 2,
		"analyzedItems": 2,
		"recommendationCount": 2
	},
	"data": [
		{
			"itemId": 19721,
			"quantityOwned": 5,
			"trendData": {
				"itemId": 19721,
				"currentPrice": 12345,
				"currentPriceAt": "2026-05-02T10:00:00.000Z",
				"oldPrice": 10000,
				"oldPriceAt": "2026-04-25T10:00:00.000Z",
				"growthPercentage": 23.45,
				"highestPriceInPeriod": 13000,
				"highestPriceAt": "2026-05-01T10:00:00.000Z",
				"lowestPriceInPeriod": 9800,
				"lowestPriceAt": "2026-04-26T10:00:00.000Z"
			},
			"potentialProfit": 3275,
			"trend12h": {
				"direction": "up",
				"netChangePct": 2.4,
				"confidence": 64
			}
		}
	]
}
```

### Campos da resposta - POST /analyze

- `meta.days`: janela usada na análise.
- `meta.requestedItems`: quantidade de itens enviados no inventário normalizado.
- `meta.analyzedItems`: quantidade de itens que tinham histórico suficiente para análise.
- `meta.recommendationCount`: quantidade de recomendações geradas.
- `data[]`: lista ordenada por maior lucro potencial.
- `trendData`: resume a tendência do item no período analisado.
- `trend12h.direction`: `up`, `down` ou `sideways`.

### Erros possíveis - POST /analyze

- `400` com `{ "error": "Payload invalido. Envie { \"inventory\": [{\"itemId\": 123, \"quantity\": 2}], \"days\": 7 }" }`
- `500` com `{ "error": "Erro interno ao processar analise." }`

## GET /api/market-alerts

Lista as assinaturas de alerta ativas.

### Resposta de sucesso - GET /api/market-alerts

```json
{
	"data": [
		{
			"id": "alt_123",
			"itemId": 19721,
			"itemName": "Glob of Ectoplasm",
			"itemIcon": "https://...",
			"conditionType": "period_high_reached",
			"periodDays": 7,
			"active": true,
			"createdAt": "2026-05-01T12:00:00.000Z",
			"updatedAt": "2026-05-02T12:00:00.000Z"
		}
	]
}
```

### Campos da assinatura - GET /api/market-alerts

- `id`: identificador da assinatura.
- `itemId`: ID do item monitorado.
- `itemName`: nome do item.
- `itemIcon`: ícone do item, quando disponível.
- `conditionType`: tipo da condição. Atualmente a aplicação trabalha com `period_high_reached`.
- `periodDays`: período analisado para o alerta.
- `active`: indica se a assinatura está ativa.
- `createdAt` e `updatedAt`: timestamps do registro.

### Erros possíveis - GET /api/market-alerts

- `500` com `{ "error": "Erro interno ao listar assinaturas." }`

## POST /api/market-alerts

Cria uma nova assinatura ou reativa uma assinatura existente para o mesmo item, condição e período.

### Exemplo de request - POST /api/market-alerts

```json
{
	"itemId": 19721,
	"itemName": "Glob of Ectoplasm",
	"itemIcon": "https://...",
	"conditionType": "period_high_reached",
	"periodDays": 7
}
```

### Regras do payload - POST /api/market-alerts

- `itemId` é obrigatório e deve ser inteiro positivo.
- `itemName` é obrigatório.
- `itemIcon` é opcional.
- `conditionType` deve ser `period_high_reached`.
- `periodDays` é opcional. Se não for informado, o padrão é `7`.

### Resposta de sucesso - POST /api/market-alerts

Quando cria um registro novo, a rota responde com `201`.
Quando apenas reativa/atualiza uma assinatura existente, responde com `200`.

```json
{
	"data": {
		"id": "alt_123",
		"itemId": 19721,
		"itemName": "Glob of Ectoplasm",
		"itemIcon": "https://...",
		"conditionType": "period_high_reached",
		"periodDays": 7,
		"active": true,
		"createdAt": "2026-05-01T12:00:00.000Z",
		"updatedAt": "2026-05-02T12:00:00.000Z"
	}
}
```

### Erros possíveis - POST /api/market-alerts

- `400` com `{ "error": "itemId invalido." }`
- `400` com `{ "error": "itemName obrigatorio." }`
- `400` com `{ "error": "conditionType invalido." }`
- `400` com `{ "error": "Erro ao salvar assinatura." }`

## DELETE /api/market-alerts/:itemId

Desativa a assinatura ativa para o item informado.

### Parâmetros de rota e query - DELETE /api/market-alerts/:itemId

- `itemId`: ID do item.
- `conditionType` na query é opcional. Padrão: `period_high_reached`.
- `periodDays` na query é opcional. Padrão: `7`.

Exemplo:

```text
DELETE /api/market-alerts/19721?conditionType=period_high_reached&periodDays=7
```

### Resposta de sucesso - DELETE /api/market-alerts/:itemId

```json
{
	"ok": true
}
```

### Erros possíveis - DELETE /api/market-alerts/:itemId

- `404` com `{ "error": "Assinatura nao encontrada." }`
- `400` com `{ "error": "itemId invalido." }`
- `400` com `{ "error": "Erro ao desativar assinatura." }`

## GET /api/market-notifications/unread-count

Retorna a quantidade de notificações não lidas.

### Resposta de sucesso - GET /api/market-notifications/unread-count

```json
{
	"unreadCount": 3,
	"serverTime": "2026-05-02T12:00:00.000Z"
}
```

### Erros possíveis - GET /api/market-notifications/unread-count

- `500` com `{ "error": "Erro interno ao contar notificacoes." }`

## GET /api/market-notifications

Lista notificações com filtros de status e paginação.

### Query params - GET /api/market-notifications

- `status`: `all`, `read` ou `unread`. Padrão: `all`.
- `page`: número da página. Padrão: `1`.
- `pageSize`: itens por página. Padrão: `20`.

Exemplo:

```text
GET /api/market-notifications?status=unread&page=1&pageSize=20
```

### Resposta de sucesso - GET /api/market-notifications

```json
{
	"data": [
		{
			"id": "ntf_123",
			"itemId": 19721,
			"itemName": "Glob of Ectoplasm",
			"itemIcon": "https://...",
			"conditionType": "period_high_reached",
			"periodDays": 7,
			"triggeredPrice": 13000,
			"triggeredAt": "2026-05-02T11:50:00.000Z",
			"read": false,
			"readAt": null
		}
	],
	"meta": {
		"page": 1,
		"pageSize": 20,
		"total": 1,
		"unreadCount": 3
	}
}
```

### Campos da notificação - GET /api/market-notifications

- `id`: identificador da notificação.
- `itemId`: ID do item.
- `itemName`: nome do item.
- `itemIcon`: ícone do item, quando disponível.
- `conditionType`: tipo da condição que disparou a notificação.
- `periodDays`: período usado na verificação.
- `triggeredPrice`: preço que disparou o alerta.
- `triggeredAt`: data/hora do disparo.
- `read`: indica se a notificação já foi lida.
- `readAt`: data/hora em que foi marcada como lida.

### Erros possíveis - GET /api/market-notifications

- `500` com `{ "error": "Erro interno ao listar notificacoes." }`

## PATCH /api/market-notifications/:id/read

Marca uma notificação como lida.

### Resposta de sucesso - PATCH /api/market-notifications/:id/read

```json
{
	"data": {
		"id": "ntf_123",
		"read": true,
		"readAt": "2026-05-02T12:10:00.000Z"
	},
	"meta": {
		"unreadCount": 2
	}
}
```

### Erros possíveis - PATCH /api/market-notifications/:id/read

- `404` com `{ "error": "Notificacao nao encontrada." }`
- `400` com `{ "error": "Erro ao marcar notificacao como lida." }`

## PATCH /api/market-notifications/read-all

Marca todas as notificações como lidas.

### Resposta de sucesso - PATCH /api/market-notifications/read-all

```json
{
	"ok": true,
	"meta": {
		"unreadCount": 0
	}
}
```

### Erros possíveis - PATCH /api/market-notifications/read-all

- `500` com `{ "error": "Erro ao marcar notificacoes como lidas." }`

## DELETE /api/market-notifications/:id

Remove uma notificação pelo identificador.

### Resposta de sucesso - DELETE /api/market-notifications/:id

```json
{
	"ok": true
}
```

### Erros possíveis - DELETE /api/market-notifications/:id

- `404` com `{ "error": "Notificacao nao encontrada." }`
- `500` com `{ "error": "Erro ao remover notificacao." }`

## Observações finais

- O endpoint `/analyze` e o endpoint `/api/market/analyze` executam a mesma lógica e retornam o mesmo formato.
- A rota de notificações limita internamente `pageSize` a no máximo `50`.
- Os nomes dos campos seguem o contrato atual do código-fonte; se alguma entidade mudar, esta documentação deve ser atualizada junto.
