// Whole foods without a barcode. Typical values per 100 g, rounded from the
// USDA FoodData Central reference entries. Good enough for daily tracking.

const g = (id, name, servingG, servingLabel, kcal, protein, carbs, fat, fibre = null) => ({
  id: `gen:${id}`,
  source: 'generic',
  name,
  brand: 'Typical values',
  servingG,
  servingLabel,
  per100: { kcal, protein, carbs, fat, sugars: null, fibre, salt: null },
});

export const GENERIC = [
  g('chicken-breast', 'Chicken breast, grilled', 150, '1 fillet', 165, 31, 0, 3.6, 0),
  g('rice-basmati', 'Basmati rice, cooked', 200, '1 bowl', 130, 2.7, 28, 0.3, 0.4),
  g('rice-brown', 'Brown rice, cooked', 200, '1 bowl', 123, 2.7, 25.6, 1, 1.6),
  g('pasta', 'Pasta, cooked', 200, '1 bowl', 158, 5.8, 30.9, 0.9, 1.8),
  g('egg', 'Egg, whole', 50, '1 large egg', 143, 12.6, 0.7, 9.5, 0),
  g('oats', 'Rolled oats', 40, '1 portion', 379, 13.2, 67.7, 6.5, 10.1),
  g('banana', 'Banana', 118, '1 medium', 89, 1.1, 22.8, 0.3, 2.6),
  g('apple', 'Apple', 180, '1 medium', 52, 0.3, 13.8, 0.2, 2.4),
  g('greek-yoghurt', 'Greek yoghurt, 0% fat', 170, '1 pot', 59, 10.3, 3.6, 0.4, 0),
  g('skyr', 'Skyr, natural', 150, '1 pot', 63, 11, 4, 0.2, 0),
  g('milk-whole', 'Whole milk', 250, '1 glass', 61, 3.2, 4.8, 3.3, 0),
  g('milk-semi', 'Semi-skimmed milk', 250, '1 glass', 47, 3.5, 4.8, 1.7, 0),
  g('salmon', 'Salmon fillet, baked', 150, '1 fillet', 206, 22, 0, 12.4, 0),
  g('tuna', 'Tuna in water, drained', 100, '1 small tin', 116, 25.5, 0, 0.8, 0),
  g('beef-mince', 'Beef mince 5% fat, cooked', 125, '1 portion', 175, 26, 0, 7.5, 0),
  g('tofu', 'Tofu, firm', 150, '½ block', 144, 15.8, 2.8, 8.7, 2.3),
  g('lentils', 'Lentils, boiled', 200, '1 bowl', 116, 9, 20, 0.4, 7.9),
  g('chickpeas', 'Chickpeas, boiled', 150, '1 portion', 164, 8.9, 27.4, 2.6, 7.6),
  g('potato', 'Potatoes, boiled', 200, '1 portion', 87, 1.9, 20.1, 0.1, 1.8),
  g('sweet-potato', 'Sweet potato, baked', 150, '1 medium', 90, 2, 20.7, 0.2, 3.3),
  g('broccoli', 'Broccoli, steamed', 100, '1 portion', 35, 2.4, 7.2, 0.4, 3.3),
  g('avocado', 'Avocado', 75, '½ avocado', 160, 2, 8.5, 14.7, 6.7),
  g('bread-wholemeal', 'Wholemeal bread', 36, '1 slice', 247, 13, 41, 3.4, 7),
  g('peanut-butter', 'Peanut butter', 16, '1 tablespoon', 588, 25, 20, 50, 6),
  g('olive-oil', 'Olive oil', 10, '1 tablespoon', 884, 0, 0, 100, 0),
  g('almonds', 'Almonds', 30, '1 handful', 579, 21.2, 21.6, 49.9, 12.5),
  g('cheddar', 'Cheddar cheese', 30, '1 slice', 403, 24.9, 1.3, 33.1, 0),
  g('cottage-cheese', 'Cottage cheese', 150, '½ tub', 98, 11.1, 3.4, 4.3, 0),
  g('whey', 'Whey protein powder', 30, '1 scoop', 400, 78, 8, 6, 0),
];

export function searchGeneric(q) {
  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  return GENERIC.filter((f) => words.every((w) => f.name.toLowerCase().includes(w)));
}

export function genericById(id) {
  return GENERIC.find((f) => f.id === id) || null;
}
