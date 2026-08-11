export interface CurrencyState {
  gold: number;
  silver: number;
  copper: number;
}

export interface ItemPrice {
  id: string;
  name: string;
  costGold: number;
  stock: number;
}

export class EconomyEngine {
  public static INITIAL_ITEMS: ItemPrice[] = [
    { id: "iron-key", name: "Iron Key Duplicate", costGold: 10, stock: 2 },
    { id: "torch-bundle", name: "Torch Bundle (6)", costGold: 2, stock: 10 },
    { id: "iron-rations", name: "Iron Rations (7 Days)", costGold: 5, stock: 8 },
    { id: "healing-potion", name: "Potion of Healing", costGold: 25, stock: 3 },
    { id: "shield-wood", name: "Wooden Shield", costGold: 15, stock: 4 },
  ];

  public static convertToGold(c: CurrencyState): number {
    return c.gold + c.silver / 10 + c.copper / 100;
  }

  public static canAfford(wallet: CurrencyState, costGold: number): boolean {
    return wallet.gold >= costGold;
  }

  public static deduct(wallet: CurrencyState, costGold: number): boolean {
    if (wallet.gold >= costGold) {
      wallet.gold -= costGold;
      return true;
    }
    return false;
  }

  public static add(wallet: CurrencyState, amountGold: number): void {
    wallet.gold += amountGold;
  }
}
