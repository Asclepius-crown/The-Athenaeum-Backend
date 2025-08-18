import express from 'express';
import Book from '../models/Book.js';
import authMiddleware from '../middleware/auth.js';

const router = express.Router();

// Get all books
router.get('/', authMiddleware, async (req, res) => {
  try {
    const books = await Book.find({});
    res.json(books);
  } catch {
    res.status(500).json({ message: 'Server error fetching books' });
  }
});

// Add a book
router.post('/', authMiddleware, async (req, res) => {
  try {
    const book = new Book(req.body);
    await book.save();
    res.status(201).json(book);
  } catch {
    res.status(400).json({ message: 'Invalid book data' });
  }
});

// Update a book
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const book = await Book.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!book) return res.status(404).json({ message: 'Book not found' });
    res.json(book);
  } catch {
    res.status(400).json({ message: 'Invalid update data' });
  }
});

// Delete a book
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const deleted = await Book.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ message: 'Book not found' });
    res.json({ message: 'Book deleted successfully' });
  } catch {
    res.status(400).json({ message: 'Invalid request' });
  }
});

export default router;
