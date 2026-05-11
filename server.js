require('dotenv').config();
const express   = require('express');
const path      = require('path');
const connectDB = require('./db');
const dssRoutes = require('./routes/dssRoutes');

const app  = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

connectDB();

app.use('/api', dssRoutes);

// SPA fallback — всі не-API маршрути повертають index.html
app.get(/^(?!\/api).*/, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`DSS Server running on http://localhost:${PORT}`);
});
