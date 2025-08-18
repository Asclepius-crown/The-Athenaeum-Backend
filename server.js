//server.js
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import mongoose from 'mongoose';

import config from './config.js';
import authRoutes from './routes/auth.js';
import booksRoutes from './routes/books.js';
import borrowedRoutes from './routes/borrowed.js';
// import overdueRoutes from './routes/overdue.js';
import googleBooksRoutes from './routes/googleBooks.js'; // Import Google Books route

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

mongoose.connect(config.MONGO_URI)
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.error('MongoDB connection error:', err));

app.use('/api/auth', authRoutes);
app.use('/api/books', booksRoutes);
app.use('/api/borrowed', borrowedRoutes);
app.use('/api/google-books', googleBooksRoutes); 

app.get('/', (_req, res) => res.send('Athenaeum backend API running'));

const PORT = config.PORT || 5000;
app.listen(PORT, () => console.log(`Server listening on port ${PORT}`));
