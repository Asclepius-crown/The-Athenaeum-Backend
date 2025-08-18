import mongoose from 'mongoose';

const { Schema, model } = mongoose;

const borrowedBookSchema = new Schema({
  studentName: { type: String, required: true },
  studentId: { type: String, required: true },
  bookTitle: { type: String, required: true },
  borrowDate: { type: Date, required: true },
  dueDate: { type: Date, required: true },
  returnStatus: { type: String, enum: ['Returned', 'Not Returned', 'Overdue'], default: 'Not Returned' },
}, { timestamps: true });

export default model('BorrowedBook', borrowedBookSchema);
