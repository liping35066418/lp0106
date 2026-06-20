const express = require('express');
const cors = require('cors');
const { generateMockOrders, aggregateStats, CATEGORIES } = require('./data');

const app = express();
const PORT = 8876;

app.use(cors());
app.use(express.json());

const orders = generateMockOrders();

function filterByPeriod(orders, period, targetDate, nowIso) {
  const target = new Date(targetDate);
  const year = target.getFullYear();
  const month = target.getMonth();
  const date = target.getDate();
  const day = target.getDay();

  const now = nowIso ? new Date(nowIso) : null;

  let periodFiltered;
  if (period === 'day') {
    periodFiltered = orders.filter(o => {
      const d = new Date(o.orderTime);
      return d.getFullYear() === year
        && d.getMonth() === month
        && d.getDate() === date;
    });
  } else {
    const mondayDate = date - (day === 0 ? 6 : day - 1);
    const monday = new Date(year, month, mondayDate, 0, 0, 0);
    const sunday = new Date(year, month, mondayDate + 6, 23, 59, 59);
    periodFiltered = orders.filter(o => {
      const d = new Date(o.orderTime);
      return d >= monday && d <= sunday;
    });
  }

  if (now && !isNaN(now.getTime())) {
    periodFiltered = periodFiltered.filter(o => new Date(o.orderTime) <= now);
  }

  return periodFiltered;
}

function filterOrdersByDetail(orders, category, product) {
  if (!category && !product) return orders;
  return orders.filter(o => {
    return o.items.some(it => {
      if (category && product) {
        return it.category === category && it.name === product;
      } else if (category) {
        return it.category === category;
      } else if (product) {
        return it.name === product;
      }
      return false;
    });
  });
}

function aggregateStatsFiltered(orders, category) {
  if (!category) return aggregateStats(orders);

  let orderCount = 0;
  let totalRevenue = 0;
  let totalItems = 0;
  const productSales = {};
  const categorySales = {};

  CATEGORIES.forEach(cat => { categorySales[cat] = { quantity: 0, revenue: 0 }; });

  orders.forEach(order => {
    let hasCategoryItem = false;
    let catRevenue = 0;
    let catItems = 0;

    order.items.forEach(item => {
      if (categorySales[item.category]) {
        categorySales[item.category].quantity += item.quantity;
        categorySales[item.category].revenue += item.subtotal;
      }

      if (item.category === category) {
        hasCategoryItem = true;
        catItems += item.quantity;
        catRevenue += item.subtotal;

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
      }
    });

    if (hasCategoryItem) {
      orderCount++;
      totalRevenue += catRevenue;
      totalItems += catItems;
    }
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

function getPreviousPeriodParams(period, nowIso) {
  const now = new Date(nowIso);
  if (period === 'day') {
    const prev = new Date(now);
    prev.setDate(prev.getDate() - 1);
    const prevNow = new Date(prev.getFullYear(), prev.getMonth(), prev.getDate(), now.getHours(), now.getMinutes(), now.getSeconds());
    return { date: prev.toISOString(), now: prevNow.toISOString() };
  } else {
    const prev = new Date(now);
    prev.setDate(prev.getDate() - 7);
    const prevNow = new Date(prev.getFullYear(), prev.getMonth(), prev.getDate(), now.getHours(), now.getMinutes(), now.getSeconds());
    return { date: prev.toISOString(), now: prevNow.toISOString() };
  }
}

app.get('/api/stats', (req, res) => {
  const { period = 'day', date = new Date().toISOString(), now, category } = req.query;
  const cat = category || null;
  const filteredOrders = filterByPeriod(orders, period, date, now);
  const stats = aggregateStatsFiltered(filteredOrders, cat);

  let comparison = null;
  if (now) {
    const prevParams = getPreviousPeriodParams(period, now);
    const prevOrders = filterByPeriod(orders, period, prevParams.date, prevParams.now);
    const prevStats = aggregateStatsFiltered(prevOrders, cat);
    comparison = {
      orderCount: prevStats.orderCount,
      totalRevenue: prevStats.totalRevenue,
      avgOrderValue: prevStats.avgOrderValue,
      totalItems: prevStats.totalItems
    };
  }

  res.json({
    period,
    date,
    now,
    category: cat,
    orderCount: stats.orderCount,
    totalRevenue: stats.totalRevenue,
    avgOrderValue: stats.avgOrderValue,
    totalItems: stats.totalItems,
    categorySales: stats.categorySales,
    comparison
  });
});

app.get('/api/products', (req, res) => {
  const { period = 'day', date = new Date().toISOString(), now } = req.query;
  const filteredOrders = filterByPeriod(orders, period, date, now);
  const stats = aggregateStats(filteredOrders);
  const productList = Object.entries(stats.productSales).map(([name, data]) => ({
    name,
    category: data.category,
    quantity: data.quantity,
    revenue: data.revenue,
    unitPrice: data.unitPrice
  }));
  productList.sort((a, b) => b.quantity - a.quantity);
  res.json({
    period,
    date,
    now,
    products: productList
  });
});

app.get('/api/ranking', (req, res) => {
  const { period = 'day', date = new Date().toISOString(), top = 10, now, category } = req.query;
  const cat = category || null;
  const filteredOrders = filterByPeriod(orders, period, date, now);
  const stats = aggregateStatsFiltered(filteredOrders, cat);
  const ranking = Object.entries(stats.productSales)
    .map(([name, data]) => ({
      rank: 0,
      name,
      category: data.category,
      quantity: data.quantity,
      revenue: data.revenue
    }))
    .sort((a, b) => b.quantity - a.quantity)
    .slice(0, parseInt(top))
    .map((item, idx) => ({ ...item, rank: idx + 1 }));
  res.json({
    period,
    date,
    now,
    category: cat,
    top: parseInt(top),
    ranking
  });
});

app.get('/api/orders', (req, res) => {
  const { period = 'day', date = new Date().toISOString(), now, category, product } = req.query;
  let filteredOrders = filterByPeriod(orders, period, date, now);
  filteredOrders = filterOrdersByDetail(filteredOrders, category, product);
  filteredOrders.sort((a, b) => new Date(b.orderTime) - new Date(a.orderTime));
  res.json({
    period,
    date,
    now,
    category,
    product,
    total: filteredOrders.length,
    orders: filteredOrders
  });
});

app.listen(PORT, () => {
  console.log(`生鲜订单数据聚合服务运行中: http://localhost:${PORT}`);
  console.log(`统计接口: http://localhost:${PORT}/api/stats?period=day`);
  console.log(`热销榜单: http://localhost:${PORT}/api/ranking?period=day`);
});
