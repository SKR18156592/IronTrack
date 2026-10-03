// ==========================================
// EXAMPLE MEAL PLANS (Rest vs Workout Days)
// ==========================================
// Each meal lists [food id, amount] pairs from src/data/foods.js. The portions are an example for about
// 2,300 kcal (rest) and 2,500 kcal (workout); the Nutrition tab scales them to the user's targets.
export const NUTRITION_PLANS = {
  rest: {
    meals: [
      {
        title: 'Breakfast',
        items: [
          ['chicken_breast', 100],
          ['olive_oil', 3],
          ['banana', 2],
          ['egg', 3]
        ]
      },
      {
        title: 'Shake / Supplements',
        items: [
          ['coffee', 10],
          ['flax', 5],
          ['pumpkin_seeds', 5],
          ['almonds', 10],
          ['walnuts', 10],
          ['oats', 50],
          ['whey', 30]
        ]
      },
      {
        title: 'Lunch',
        items: [
          ['ghee', 3],
          ['chicken_breast', 200],
          ['dal', 75],
          ['curd', 150],
          ['chia', 10],
          ['rice', 200]
        ]
      },
      {
        title: 'Dinner',
        items: [
          ['ghee', 3],
          ['dal', 75],
          ['rice', 200],
          ['egg', 3]
        ]
      }
    ]
  },
  workout: {
    meals: [
      {
        title: 'Breakfast',
        items: [
          ['potato', 100],
          ['chicken_breast', 100],
          ['olive_oil', 3],
          ['banana', 2],
          ['egg', 3]
        ]
      },
      {
        title: 'Pre-Workout Meal',
        items: [
          ['dates', 20],
          ['beetroot', 100],
          ['oats', 50],
          ['milk', 100],
          ['coffee', 10]
        ]
      },
      {
        title: 'Post-Workout Meal',
        items: [
          ['ghee', 3],
          ['chicken_breast', 200],
          ['whey', 30],
          ['dal', 75],
          ['curd', 150],
          ['chia', 10],
          ['rice', 200]
        ]
      },
      {
        title: 'Dinner',
        items: [
          ['pumpkin_seeds', 5],
          ['almonds', 10],
          ['flax', 5],
          ['walnuts', 10],
          ['ghee', 3],
          ['dal', 75],
          ['egg', 3],
          ['rice', 200]
        ]
      }
    ]
  }
};
