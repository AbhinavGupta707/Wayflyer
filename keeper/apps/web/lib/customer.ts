// Current "shop as" customer — shared across the landing switcher and the orders
// page. Persisted so the choice survives navigation between scenes.

import { create } from "zustand";
import { persist } from "zustand/middleware";

interface CustomerState {
  customerId: string | null;
  setCustomer: (id: string) => void;
}

export const useCustomer = create<CustomerState>()(
  persist(
    (set) => ({
      customerId: null,
      setCustomer: (id) => set({ customerId: id }),
    }),
    { name: "keeper-customer" },
  ),
);
