export interface AnalyzeInventoryItemInput {
	itemId: number;
	quantity: number;
}

export interface AnalyzeRequest {
	inventory: AnalyzeInventoryItemInput[];
	days?: number;
}

export interface TrendData {
	itemId: number;
	currentPrice: number;
	currentPriceAt: string;
	oldPrice: number;
	oldPriceAt: string;
	growthPercentage: number;
	highestPriceInPeriod: number;
	highestPriceAt: string;
	lowestPriceInPeriod: number;
	lowestPriceAt: string;
}

export interface RecommendationData {
	itemId: number;
	quantityOwned: number;
	trendData: TrendData;
	potentialProfit: number;
}

export interface AnalyzeMeta {
	days: number;
	requestedItems: number;
	analyzedItems: number;
	recommendationCount: number;
}

export interface AnalyzeSuccessResponse {
	meta: AnalyzeMeta;
	data: RecommendationData[];
}

export interface AnalyzeErrorResponse {
	error: string;
}

export type AnalyzeResponse = AnalyzeSuccessResponse | AnalyzeErrorResponse;

export const analyzeRequestExample: AnalyzeRequest = {
	days: 7,
	inventory: [
		{ itemId: 19721, quantity: 5 },
		{ itemId: 24295, quantity: 10 },
	],
};
