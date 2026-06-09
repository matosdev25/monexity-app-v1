export type Plan = {
  id: string;
  name: string;
  tagline: string;
  priceMonthly: string;
  priceAnnual: string;
  /** Equivalente mensual al pagar anual — se muestra como precio principal en modo anual */
  priceAnnualMonthlyEquiv: string;
  savingsLabel: string;
  features: string[];
  /** Features que NO incluye el plan — se muestran como limitación (efecto decoy) */
  notIncluded: string[];
  highlight: boolean;
  hasInventory: boolean;
  multiUser: boolean;
};

export const PLANS: Plan[] = [
  {
    id: "emprende",
    name: "Emprende",
    tagline: "Para servicios y negocios sin inventario",
    priceMonthly: "$ 3.99",
    priceAnnual: "$ 39.99",
    priceAnnualMonthlyEquiv: "$ 3.33",
    savingsLabel: "Ahorra $ 7.89",
    features: [
      "Ventas y gastos ilimitados",
      "Cierre del período",
      "Descarga y comparte facturas en PDF.",
      "1 usuario",
    ],
    notIncluded: ["Inventario de productos"],
    highlight: false,
    hasInventory: false,
    multiUser: false,
  },
  {
    id: "control",
    name: "Control",
    tagline: "Para negocios con productos e inventario",
    priceMonthly: "$ 8.99",
    priceAnnual: "$ 89.99",
    priceAnnualMonthlyEquiv: "$ 7.49",
    savingsLabel: "Ahorra $ 17.89",
    features: [
      "Ventas, gastos e inventario",
      "Control completo de stock",
      "Descarga y comparte facturas en PDF.",
      "Cierre del período",
    ],
    notIncluded: [],
    highlight: true,
    hasInventory: true,
    multiUser: false,
  },
  {
    id: "equipo",
    name: "Equipo",
    tagline: "Para negocios con múltiples vendedores",
    priceMonthly: "$ 14.99",
    priceAnnual: "$ 149.99",
    priceAnnualMonthlyEquiv: "$ 12.49",
    savingsLabel: "Ahorra $ 29.89",
    features: [
      "Todo lo incluido en Control",
      "Usuarios ilimitados",
      "Roles: dueño, administrador, vendedor",
      "Acceso simultáneo del equipo",
    ],
    notIncluded: [],
    highlight: false,
    hasInventory: true,
    multiUser: true,
  },
];

export const PLAN_MAP: Record<string, Plan> = Object.fromEntries(
  PLANS.map((p) => [p.id, p])
);
