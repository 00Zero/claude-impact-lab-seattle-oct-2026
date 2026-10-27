export type Unit = "lb" | "oz" | "kg" | "g" | "each" | "gal" | "fl_oz" | "l" | "ml";

export interface LineItem {
  id: string; name: string; searchQuery: string; packSize: number; unit: Unit;
  qtyPerOrder: number; pricePaid?: number; shippingPaid?: number; // pricePaid = USD per ONE pack
}
export interface Offer {
  itemId: string; store: string; title: string; url: string; price: number; packSize: number; unit: Unit;
  shipping: number | null; confidence: "high" | "medium" | "low"; checkedAt: string;
}
export interface RankedOffer extends Offer { unitCost: number; baseUnit: "lb" | "fl_oz" | "each"; }
export interface ItemResult {
  item: LineItem; best: RankedOffer | null; offers: RankedOffer[];
  currentUnitCost: number | null; savingsPerOrder: number | null;
}
export interface AnalysisResult {
  items: ItemResult[]; totalSavingsPerOrder: number; totalSavingsPerMonth: number; totalSavingsPerYear: number;
  ordersPerMonth: number; suggestions: string[]; generatedAt: string; notice?: string;
}
export type ProgressEvent =
  | { type: "progress"; message: string }
  | { type: "result"; data: AnalysisResult }
  | { type: "error"; message: string };
