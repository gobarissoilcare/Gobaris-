// Server-side source of truth for pricing and stock, so a tampered client
// request can never change what a customer is actually charged.
// Keep this in sync with the PRODUCTS array in ../index.html.
const PRODUCTS = {
  p5: { kg: 5, price: 649, stock: 18 },
  p50: { kg: 50, price: 4999, stock: 3 },
};

module.exports = { PRODUCTS };
