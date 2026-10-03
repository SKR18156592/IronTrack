// ==========================================
// NUTRITION DIET DATA (Rest vs Workout Days)
// ==========================================
export const NUTRITION_PLANS = {
  rest: {
    cals: 2283,
    prot: 164.5,
    carbs: 237.8,
    fat: 72.9,
    meals: [
      {
        title: '🌅 Breakfast',
        summary: '511 kcal • 41.9g Protein',
        items: [
          { name: 'Chicken Breast Meat (100g)', cals: 110, p: 23.1, c: 0, f: 1.2 },
          { name: 'Extra Virgin Olive Oil (3g)', cals: 27, p: 0, c: 0, f: 3 },
          { name: 'Bananas (2 small)', cals: 180, p: 2.2, c: 46.1, f: 0.7 },
          { name: 'Egg Whole (3 medium)', cals: 194, p: 16.6, c: 1.0, f: 13.1 }
        ]
      },
      {
        title: '🥤 Shake / Supplements',
        summary: '523 kcal • 34.7g Protein',
        items: [
          { name: 'Coffee Instant Powder (10g)', cals: 24, p: 1.2, c: 4.1, f: 0.1 },
          { name: 'Flax Seeds (5g)', cals: 27, p: 0.9, c: 1.4, f: 2.1 },
          { name: 'Pumpkin Seeds (5g)', cals: 27, p: 1.2, c: 0.9, f: 2.3 },
          { name: 'Almonds (10g)', cals: 58, p: 2.1, c: 2.0, f: 5.1 },
          { name: 'Walnuts (10g)', cals: 65, p: 1.5, c: 1.4, f: 6.5 },
          { name: 'Quaker Rolled Oats (50g)', cals: 204, p: 5.9, c: 34.3, f: 4.8 },
          { name: 'NAKPRO Whey Gold (30g)', cals: 118, p: 21.8, c: 3.8, f: 1.7 }
        ]
      },
      {
        title: '🍽️ Lunch',
        summary: '708 kcal • 62.2g Protein',
        items: [
          { name: 'Ghee (3g)', cals: 25, p: 0, c: 0, f: 2.9 },
          { name: 'Chicken Breast Meat (200g)', cals: 220, p: 46.2, c: 0, f: 2.5 },
          { name: 'Homemade Dal Yellow (75g)', cals: 62, p: 4.3, c: 8.6, f: 1.2 },
          { name: 'Amul Curd (150g)', cals: 92, p: 5.3, c: 6.0, f: 4.7 },
          { name: 'Chia Seeds (10g)', cals: 49, p: 1.7, c: 4.2, f: 3.1 },
          { name: 'White Rice Cooked (200g)', cals: 260, p: 4.8, c: 57.2, f: 0.4 }
        ]
      },
      {
        title: '🌙 Dinner',
        summary: '541 kcal • 25.7g Protein',
        items: [
          { name: 'Ghee (3g)', cals: 25, p: 0, c: 0, f: 2.9 },
          { name: 'Homemade Dal Yellow (75g)', cals: 62, p: 4.3, c: 8.6, f: 1.2 },
          { name: 'White Rice Cooked (200g)', cals: 260, p: 4.8, c: 57.2, f: 0.4 },
          { name: 'Egg Whole (3 medium)', cals: 194, p: 16.6, c: 1.0, f: 13.1 }
        ]
      }
    ]
  },
  workout: {
    cals: 2537,
    prot: 171.7,
    carbs: 286.9,
    fat: 77.4,
    meals: [
      {
        title: '🌅 Breakfast',
        summary: '614 kcal • 43.7g Protein',
        items: [
          { name: 'Boiled Potato (100g)', cals: 103, p: 1.8, c: 19.5, f: 2.2 },
          { name: 'Chicken Breast Meat (100g)', cals: 110, p: 23.1, c: 0, f: 1.2 },
          { name: 'Extra Virgin Olive Oil (3g)', cals: 27, p: 0, c: 0, f: 3 },
          { name: 'Banana (2 small)', cals: 180, p: 2.2, c: 46.1, f: 0.7 },
          { name: 'Egg Whole (3 medium)', cals: 194, p: 16.6, c: 1.0, f: 13.1 }
        ]
      },
      {
        title: '⚡ Pre-Workout Meal',
        summary: '379 kcal • 12.6g Protein',
        items: [
          { name: 'Lion Dates (20g)', cals: 56, p: 0.5, c: 15.0, f: 0.1 },
          { name: 'Beetroot (100g)', cals: 43, p: 1.6, c: 9.6, f: 0.2 },
          { name: 'Quaker Rolled Oats (50g)', cals: 204, p: 5.9, c: 34.3, f: 4.8 },
          { name: 'Milk (100ml)', cals: 52, p: 3.4, c: 4.9, f: 2.1 },
          { name: 'Coffee Instant Powder (10g)', cals: 24, p: 1.2, c: 4.1, f: 0.1 }
        ]
      },
      {
        title: '💪 Post-Workout Meal',
        summary: '826 kcal • 83.9g Protein',
        items: [
          { name: 'Ghee (3g)', cals: 25, p: 0, c: 0, f: 2.9 },
          { name: 'Chicken Breast Meat (200g)', cals: 220, p: 46.2, c: 0, f: 2.5 },
          { name: 'NAKPRO Whey Gold (30g)', cals: 118, p: 21.8, c: 3.8, f: 1.7 },
          { name: 'Homemade Dal Yellow (75g)', cals: 62, p: 4.3, c: 8.6, f: 1.2 },
          { name: 'Amul Curd (150g)', cals: 92, p: 5.3, c: 6.0, f: 4.7 },
          { name: 'Chia Seeds (10g)', cals: 49, p: 1.6, c: 4.4, f: 3.1 },
          { name: 'White Rice Cooked (200g)', cals: 260, p: 4.8, c: 57.2, f: 0.4 }
        ]
      },
      {
        title: '🌙 Dinner',
        summary: '718 kcal • 31.5g Protein',
        items: [
          { name: 'Pumpkin Seeds (5g)', cals: 27, p: 1.2, c: 0.9, f: 2.3 },
          { name: 'Almonds (10g)', cals: 58, p: 2.1, c: 2.0, f: 5.1 },
          { name: 'Flax Seeds (5g) & Walnuts (10g)', cals: 92, p: 2.4, c: 2.8, f: 8.6 },
          { name: 'Ghee (3g)', cals: 25, p: 0, c: 0, f: 2.9 },
          { name: 'Homemade Dal Yellow (75g)', cals: 62, p: 4.3, c: 8.6, f: 1.2 },
          { name: 'Egg Whole (3 medium)', cals: 194, p: 16.6, c: 1.0, f: 13.1 },
          { name: 'White Rice Cooked (200g)', cals: 260, p: 4.8, c: 57.2, f: 0.4 }
        ]
      }
    ]
  }
};
