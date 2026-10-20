// The shop's starting packs. They're copied into the database the first time
// the server runs; after that, prices, offers, stock and descriptions are
// changed in the admin panel (Shop & prices), and this file isn't used.
// Each pack needs a matching photo in PACK_IMG in ../index.html.
const PRODUCTS = {
  p1: { kg: 1, price: 179, stock: 40,
    description: 'A small bag to try Gobaris — enough for a few pots, a window box, or your first round of seedlings.' },
  p5: { kg: 5, price: 649, stock: 18,
    description: 'Perfect for balconies, kitchen gardens, and potted plants. Mix into topsoil or use as a monthly feed — a little goes a long way.' },
  p10: { kg: 10, price: 1199, stock: 12,
    description: 'For terrace gardens, lawns and bigger kitchen gardens — one bag covers a full season of feeding.' },
  p50: { kg: 50, price: 4999, stock: 3,
    description: "Built for real fields and full-scale farming. Cured slow, the old way, from Braj's own gobar — chemical-free nutrition at scale." },
};

module.exports = { PRODUCTS };
