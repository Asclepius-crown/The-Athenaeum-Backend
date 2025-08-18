import express from 'express';
import BorrowedBook from '../models/BorrowedBook.js';
import authMiddleware from '../middleware/auth.js';
import nodemailer from 'nodemailer';
import cron from 'node-cron';

const router = express.Router();

const statusClasses = ["Overdue", "Returned", "Not Returned"];

// Helper: Mark overdue
function applyOverdueStatus(record) {
  const today = new Date();
  if (record.returnStatus !== 'Returned' && new Date(record.dueDate) < today) {
    record.returnStatus = 'Overdue';
  }
  return record;
}

// Email transporter (configure for your email)
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.NOTIFY_EMAIL, // your email
    pass: process.env.NOTIFY_PASS   // your password or app password
  }
});

// Simulated SMS sender (replace with Twilio in real)
async function sendSMS(to, message) {
  console.log(`📩 [SMS to ${to}] ${message}`);
}

// CRON – Every day at 9AM, update overdue & send notifications
cron.schedule('0 9 * * *', async () => {
  console.log("🔄 Checking overdue books...");
  const records = await BorrowedBook.find({});
  for (let rec of records) {
    const today = new Date();
    if (rec.returnStatus !== 'Returned' && new Date(rec.dueDate) < today) {
      rec.returnStatus = 'Overdue';
      await rec.save();

      // Email notification
      if (rec.studentEmail) {
        await transporter.sendMail({
          from: process.env.NOTIFY_EMAIL,
          to: rec.studentEmail,
          subject: "Overdue Book Reminder",
          text: `Dear ${rec.studentName},\nYour borrowed book "${rec.bookTitle}" is overdue. Please return it immediately.`
        });
      }

      // SMS notification
      if (rec.studentPhone) {
        await sendSMS(rec.studentPhone, `Reminder: "${rec.bookTitle}" is overdue. Please return it.`);
      }
    }
  }
  console.log("✅ Overdue check complete.");
});

// GET with pagination, filtering, search, sorting
router.get('/', authMiddleware, async (req, res, next) => {
  try {
    const { page = 1, limit = 10, status, search, sort } = req.query;
    const query = {};

    if (status) query.returnStatus = status;
    if (search) {
      query.$or = [
        { studentName: { $regex: search, $options: 'i' } },
        { studentId: { $regex: search, $options: 'i' } },
        { bookTitle: { $regex: search, $options: 'i' } }
      ];
    }

    const sortObj = {};
    if (sort) {
      const [field, order] = sort.split(':');
      sortObj[field] = order === 'desc' ? -1 : 1;
    } else {
      sortObj.dueDate = 1;
    }

    const total = await BorrowedBook.countDocuments(query);
    let records = await BorrowedBook.find(query)
      .sort(sortObj)
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .lean();

    records = records.map(applyOverdueStatus);

    res.json({ total, page: Number(page), limit: Number(limit), records });
  } catch (err) {
    next(err);
  }
});

router.post('/', authMiddleware, async (req, res, next) => {
  try {
    const record = new BorrowedBook(req.body);
    await record.save();
    res.status(201).json(record);
  } catch (err) {
    next(err);
  }
});

router.put('/:id', authMiddleware, async (req, res, next) => {
  try {
    const record = await BorrowedBook.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!record) return res.status(404).json({ message: 'Record not found' });
    res.json(record);
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', authMiddleware, async (req, res, next) => {
  try {
    const deleted = await BorrowedBook.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ message: 'Record not found' });
    res.json({ message: 'Record deleted successfully' });
  } catch (err) {
    next(err);
  }
});

router.post('/bulk-delete', authMiddleware, async (req, res, next) => {
  try {
    const { ids } = req.body;
    await BorrowedBook.deleteMany({ _id: { $in: ids } });
    res.json({ message: 'Records deleted' });
  } catch (err) {
    next(err);
  }
});

export default router;
