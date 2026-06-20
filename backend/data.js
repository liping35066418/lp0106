const CATEGORIES = ['蔬菜', '水果', '肉禽蛋', '水产', '粮油', '乳品'];

const PRODUCT_CATALOG = [
  { name: '西红柿', category: '蔬菜', price: 4.5 },
  { name: '黄瓜', category: '蔬菜', price: 3.2 },
  { name: '土豆', category: '蔬菜', price: 2.8 },
  { name: '青菜', category: '蔬菜', price: 5.0 },
  { name: '茄子', category: '蔬菜', price: 4.0 },
  { name: '胡萝卜', category: '蔬菜', price: 3.5 },
  { name: '大白菜', category: '蔬菜', price: 2.5 },
  { name: '菠菜', category: '蔬菜', price: 6.0 },

  { name: '苹果', category: '水果', price: 8.5 },
  { name: '香蕉', category: '水果', price: 5.5 },
  { name: '橙子', category: '水果', price: 7.0 },
  { name: '西瓜', category: '水果', price: 3.0 },
  { name: '葡萄', category: '水果', price: 12.0 },
  { name: '草莓', category: '水果', price: 18.0 },
  { name: '桃子', category: '水果', price: 9.5 },

  { name: '猪肉', category: '肉禽蛋', price: 28.0 },
  { name: '牛肉', category: '肉禽蛋', price: 58.0 },
  { name: '鸡肉', category: '肉禽蛋', price: 18.0 },
  { name: '鸡蛋', category: '肉禽蛋', price: 6.8 },
  { name: '鸭肉', category: '肉禽蛋', price: 22.0 },
  { name: '羊肉', category: '肉禽蛋', price: 65.0 },

  { name: '草鱼', category: '水产', price: 15.0 },
  { name: '鲫鱼', category: '水产', price: 18.0 },
  { name: '虾', category: '水产', price: 45.0 },
  { name: '带鱼', category: '水产', price: 35.0 },
  { name: '鲈鱼', category: '水产', price: 38.0 },

  { name: '大米', category: '粮油', price: 3.2 },
  { name: '面粉', category: '粮油', price: 2.8 },
  { name: '花生油', category: '粮油', price: 15.0 },
  { name: '大豆油', category: '粮油', price: 10.0 },
  { name: '小米', category: '粮油', price: 6.5 },

  { name: '牛奶', category: '乳品', price: 3.5 },
  { name: '酸奶', category: '乳品', price: 4.0 },
  { name: '纯牛奶', category: '乳品', price: 5.5 },
  { name: '奶酪', category: '乳品', price: 12.0 }
];

function createSeededRandom(seed) {
  let s = seed >>> 0;
  return function() {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function seedFromString(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function randomInt(rng, min, max) {
  return Math.floor(rng() * (max - min + 1)) + min;
}

function pickRandom(rng, arr) {
  return arr[Math.floor(rng() * arr.length)];
}

function generateOrder(rng, orderId, date) {
  const itemCount = randomInt(rng, 1, 8);
  const items = [];
  const usedProducts = new Set();
  let totalAmount = 0;

  for (let i = 0; i < itemCount; i++) {
    let product;
    do {
      product = pickRandom(rng, PRODUCT_CATALOG);
    } while (usedProducts.has(product.name));
    usedProducts.add(product.name);

    const quantity = randomInt(rng, 1, 5) + (rng() > 0.7 ? randomInt(rng, 1, 3) : 0);
    const subtotal = product.price * quantity;
    totalAmount += subtotal;

    items.push({
      name: product.name,
      category: product.category,
      unitPrice: product.price,
      quantity,
      subtotal: Math.round(subtotal * 100) / 100
    });
  }

  const hour = randomInt(rng, 7, 20);
  const minute = randomInt(rng, 0, 59);
  const orderTime = new Date(date);
  orderTime.setHours(hour, minute, 0, 0);

  return {
    orderId,
    orderTime: orderTime.toISOString(),
    items,
    totalAmount: Math.round(totalAmount * 100) / 100
  };
}

function generateMockOrders() {
  const orders = [];
  const today = new Date();
  const baseY = today.getFullYear();
  const baseM = today.getMonth();
  const baseD = today.getDate();
  let orderId = 1;

  for (let dayOffset = 0; dayOffset < 30; dayOffset++) {
    const date = new Date(baseY, baseM, baseD - dayOffset);
    const daySeed = seedFromString(`${baseY}-${baseM}-${baseD - dayOffset}`);
    const dayRng = createSeededRandom(daySeed);
    const orderCount = randomInt(dayRng, 35, 70);
    for (let i = 0; i < orderCount; i++) {
      const orderSeed = seedFromString(`order-${baseY}-${baseM}-${baseD - dayOffset}-${i}`);
      const orderRng = createSeededRandom(orderSeed);
      orders.push(generateOrder(orderRng, `ORD${String(orderId).padStart(6, '0')}`, date));
      orderId++;
    }
  }
  return orders;
}

function aggregateStats(orders) {
  const orderCount = orders.length;
  let totalRevenue = 0;
  let totalItems = 0;

  const productSales = {};
  const categorySales = {};

  CATEGORIES.forEach(cat => {
    categorySales[cat] = { quantity: 0, revenue: 0 };
  });

  orders.forEach(order => {
    totalRevenue += order.totalAmount;
    order.items.forEach(item => {
      totalItems += item.quantity;

      if (!productSales[item.name]) {
        productSales[item.name] = {
          category: item.category,
          quantity: 0,
          revenue: 0,
          unitPrice: item.unitPrice
        };
      }
      productSales[item.name].quantity += item.quantity;
      productSales[item.name].revenue += item.subtotal;

      if (categorySales[item.category]) {
        categorySales[item.category].quantity += item.quantity;
        categorySales[item.category].revenue += item.subtotal;
      }
    });
  });

  for (const name in productSales) {
    productSales[name].revenue = Math.round(productSales[name].revenue * 100) / 100;
  }
  for (const cat in categorySales) {
    categorySales[cat].revenue = Math.round(categorySales[cat].revenue * 100) / 100;
  }

  totalRevenue = Math.round(totalRevenue * 100) / 100;
  const avgOrderValue = orderCount > 0 ? Math.round((totalRevenue / orderCount) * 100) / 100 : 0;

  return {
    orderCount,
    totalRevenue,
    avgOrderValue,
    totalItems,
    productSales,
    categorySales
  };
}

module.exports = {
  generateMockOrders,
  aggregateStats,
  CATEGORIES,
  PRODUCT_CATALOG
};
