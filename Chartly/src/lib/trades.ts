// Values are stored in public.organizations.trade, so don't rename existing
// ones. "other" is paired with a free-text trade_other.
export const TRADES = [
  { value: "hvac", label: "HVAC" },
  { value: "plumbing", label: "Plumbing" },
  { value: "electrical", label: "Electrical" },
  { value: "appliance_repair", label: "Appliance repair" },
  { value: "garage_door", label: "Garage doors" },
  { value: "roofing", label: "Roofing" },
  { value: "pest_control", label: "Pest control" },
  { value: "pool_spa", label: "Pool and spa" },
  { value: "security_systems", label: "Security systems" },
  { value: "fire_protection", label: "Fire alarms and protection" },
  { value: "telecom", label: "Telephone and network equipment" },
  { value: "automotive", label: "Automotive repair" },
  { value: "truck_fleet", label: "Truck and fleet repair" },
  { value: "machinery", label: "Machinery and equipment repair" },
  { value: "handyman", label: "Handyman and general repair" },
  { value: "other", label: "Other" },
] as const;

export type Trade = (typeof TRADES)[number]["value"];

export const TRADE_OTHER_MAX_LENGTH = 60;

export function tradeLabel(trade: string, tradeOther: string | null) {
  if (trade === "other") {
    return tradeOther ?? "Other";
  }
  return TRADES.find((t) => t.value === trade)?.label ?? trade;
}
