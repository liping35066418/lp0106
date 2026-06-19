const express = require('express');
const path = require('path');

const app = express();
const PORT = 3871;

app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`生鲜经营看板服务运行中: http://localhost:${PORT}`);
});
