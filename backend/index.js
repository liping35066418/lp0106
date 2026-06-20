const express = require('express');
const cors = require('cors');
const { generateMockOrders, aggregateStats } = require('./data');

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

app.get('/api/stats', (req, res) => {
  const { period = 'day', date = new Date().toISOString(), now } = req.query;
  const filteredOrders = filterByPeriod(orders, period, date, now);
  const stats = aggregateStats(filteredOrders);
  res.json({
    period,
    date,
    now,
    orderCount: stats.orderCount,
    totalRevenue: stats.totalRevenue,
    avgOrderValue: stats.avgOrderValue,
    totalItems: stats.totalItems,
    categorySales: stats.categorySales
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
  const { period = 'day', date = new Date().toISOString(), top = 10, now } = req.query;
  const filteredOrders = filterByPeriod(orders, period, date, now);
  const stats = aggregateStats(filteredOrders);
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
