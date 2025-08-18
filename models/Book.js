import mongoose from 'mongoose';

const { Schema, model } = mongoose;

const bookSchema = new Schema({
  title: { type: String, required: true },
  author: String,
  publishedCount: { type: Number, default: 0 },
  isbn: String,
  location: String,
  category: String,
  status: { type: String, enum: ['Available', 'Borrowed'], default: 'Available' },
  borrower: { type: String, default: '' },
  dueDate: Date,
  type: { type: String, enum: ['eBook', 'Audiobook'], default: 'eBook' },
}, { timestamps: true });

export default model('Book', bookSchema);
