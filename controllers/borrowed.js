import express from 'express';
import BorrowedBook from '../models/BorrowedBook.js';
import authMiddleware from '../middleware/auth.js';

const router = express.Router();

// Get all borrowed records
router.get('/', authMiddleware, async (req, res) => {
  try {
    const records = await BorrowedBook.find({});
    res.json(records);
  } catch {
    res.status(500).json({ message: 'Server error fetching borrowed records' });
  }
});

// Add borrowed record
router.post('/', authMiddleware, async (req, res) => {
  try {
    const record = new BorrowedBook(req.body);
    await record.save();
    res.status(201).json(record);
  } catch {
    res.status(400).json({ message: 'Invalid record data' });
  }
});

// Update borrowed record
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const record = await BorrowedBook.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!record) return res.status(404).json({ message: 'Record not found' });
    res.json(record);
  } catch {
    res.status(400).json({ message: 'Invalid update data' });
  }
});

// Delete borrowed record
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const deleted = await BorrowedBook.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ message: 'Record not found' });
    res.json({ message: 'Record deleted successfully' });
  } catch {
    res.status(400).json({ message: 'Invalid request' });
  }
});

export default router;
