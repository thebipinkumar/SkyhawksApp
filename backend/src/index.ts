import express from 'express';
import cors from 'cors';
import { initDb } from './db/database.js';
import authRoutes      from './routes/auth.js';
import userRoutes      from './routes/users.js';
import matchRoutes     from './routes/matches.js';
import selectionRoutes from './routes/selections.js';
import budgetRoutes    from './routes/budget.js';
import profileRoutes   from './routes/profile.js';
import publicRoutes    from './routes/public.js';
import settingsRoutes  from './routes/settings.js';

const app  = express();
const PORT = process.env.PORT || 3001;

const allowedOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map(s => s.trim())
  : ['http://localhost:5173'];

app.use(cors({ origin: allowedOrigins, credentials: true }));
app.use(express.json());

app.use('/api/auth',       authRoutes);
app.use('/api/users',      userRoutes);
app.use('/api/matches',    matchRoutes);
app.use('/api/selections', selectionRoutes);
app.use('/api/budget',     budgetRoutes);
app.use('/api/profile',    profileRoutes);
app.use('/api/public',     publicRoutes);
app.use('/api/settings',   settingsRoutes);

app.get('/api/health', (_, res) => res.json({ status: 'ok', app: 'Skyhawks Cricket Club API' }));

initDb()
  .then(() => {
    app.listen(PORT, () => console.log(`Skyhawks API → http://localhost:${PORT}`));
  })
  .catch(err => {
    console.error('Failed to initialize database:', err);
    process.exit(1);
  });
