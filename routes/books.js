import express from "express";
import authMiddleware from "../middleware/auth.js";
import Book from "../models/Book.js";
import multer from "multer";
import csvParser from "csv-parser";
import fs from "fs";
import XLSX from "xlsx";

const router = express.Router();
const upload = multer({ dest: "uploads/" });

/**
 * FIELD MAPPING for file import
 */
const FIELD_MAP = {
  title: ["title", "Title"],
  author: ["author", "Author"],
  genre: ["genre", "Genre"],
  publishedCount: ["publishedcount", "published_count", "Publication_Count", "publishedCount"],
  status: ["status", "Status"],
  height: ["height", "Height"],
  publisher: ["publisher", "Publisher"],
  location: ["location", "Location", "Library_Location"],
};

function normalizeRow(row) {
  const mapped = {};
  for (const [key, variants] of Object.entries(FIELD_MAP)) {
    let found;
    for (const v of variants) {
      for (const k of Object.keys(row)) {
        if (
          k.replace(/[^a-z0-9]/gi, "").toLowerCase() ===
          v.replace(/[^a-z0-9]/gi, "").toLowerCase()
        ) {
          found = k;
        }
      }
    }
    if (found !== undefined) mapped[key] = row[found];
  }
  return mapped;
}

/**
 * Validation + duplicate prevention + bulk insert
 */
async function validateAndInsertBooks(books, res) {
  const allowedStatuses = ["Available", "Borrowed"];
  const validBooks = [];
  const invalidBooks = [];

  books.forEach((book, index) => {
    const b = {
      title: book.title?.toString().trim() ?? "",
      author: book.author?.toString().trim() ?? "",
      genre: book.genre?.toString().trim() ?? "",
      publishedCount: Number(book.publishedCount ?? 0),
      status: (book.status || "Available").toString().trim(),
      height: book.height ? `${book.height}` : "",
      publisher: book.publisher?.toString().trim() ?? "",
      location: book.location?.toString().trim() ?? "",
    };

    if (
      !b.title ||
      !b.author ||
      isNaN(b.publishedCount) ||
      b.publishedCount < 0 ||
      (b.status && !allowedStatuses.includes(b.status))
    ) {
      invalidBooks.push({ row: index + 2, ...b });
    } else {
      validBooks.push(b);
    }
  });

  console.log(`Parsed ${books.length} rows: ${validBooks.length} valid, ${invalidBooks.length} invalid`);

  if (validBooks.length === 0) {
    return res.status(400).json({
      message: "No valid book entries to insert.",
      invalidCount: invalidBooks.length,
      invalidBooks,
    });
  }

  // Check existing
  const existingBooks = await Book.find({
    $or: validBooks.map((b) => ({ title: b.title, author: b.author })),
  }).select("title author");

  const existingSet = new Set(
    existingBooks.map((b) => `${b.title.toLowerCase()}-${b.author.toLowerCase()}`)
  );

  const newBooks = validBooks.filter(
    (b) => !existingSet.has(`${b.title.toLowerCase()}-${b.author.toLowerCase()}`)
  );

  if (newBooks.length === 0) {
    return res.status(400).json({
      message: "All submitted books already exist.",
      duplicateCount: validBooks.length,
      invalidBooks,
    });
  }

  const inserted = await Book.insertMany(newBooks, { ordered: false });

  console.log(`Inserted ${inserted.length} new books`);

  // Return only selected fields + _id
  const formattedInserted = inserted.map((doc) => ({
    _id: doc._id,
    title: doc.title,
    author: doc.author,
    genre: doc.genre,
    status: doc.status,
    location: doc.location,
    publisher: doc.publisher,
    height: doc.height,
    publishedCount: doc.publishedCount
  }));

  return res.status(201).json({
    message: "Bulk insert completed",
    totalSubmitted: books.length,
    insertedCount: inserted.length,
    duplicateCount: validBooks.length - newBooks.length,
    invalidCount: invalidBooks.length,
    invalidBooks,
    insertedBooks: formattedInserted
  });
}

/**
 * BULK FILE UPLOAD (CSV/XLSX) - POST /upload
 */
router.post("/upload", authMiddleware, upload.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: "No file uploaded" });

    const ext = req.file.originalname.split(".").pop().toLowerCase();
    const filePath = req.file.path;
    let books = [];

    if (ext === "csv") {
      const rows = await new Promise((resolve, reject) => {
        const arr = [];
        fs.createReadStream(filePath)
          .pipe(csvParser())
          .on("data", (row) => {
            console.log("DEBUG Row:", row);
            arr.push(normalizeRow(row));
          })
          .on("end", () => resolve(arr))
          .on("error", reject);
      });
      books = rows;
    } else if (ext === "xlsx" || ext === "xlsm") {
      const workbook = XLSX.readFile(filePath, { cellDates: true });
      const sheetName = workbook.SheetNames[0];
      const sheetData = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: "" });
      console.log("DEBUG Raw Sheet Data:", sheetData);
      books = sheetData.map(normalizeRow);
    } else {
      fs.unlinkSync(filePath);
      return res.status(400).json({ message: "Unsupported file type" });
    }

    fs.unlinkSync(filePath);

    if (!books.length) {
      return res.status(400).json({ message: "No data found in file" });
    }

    await validateAndInsertBooks(books, res);
  } catch (error) {
    console.error("POST /books/upload error:", error);
    res.status(500).json({ message: "Failed to upload books", error: error.message });
  }
});

/**
 * OTHER ROUTES (CRUD + BULK OPS)
 */

// GET /bulk - Retrieve all books
router.get("/bulk", authMiddleware, async (req, res) => {
  try {
    const items = await Book.find({}).select("_id title author genre status location publisher height publishedCount");
    res.json(items);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST / - Create a new book
router.post("/", authMiddleware, async (req, res) => {
  try {
    const newBook = new Book(req.body);
    await newBook.save();
    res.status(201).json({
      _id: newBook._id,
      title: newBook.title,
      author: newBook.author,
      genre: newBook.genre,
      status: newBook.status,
      location: newBook.location,
      publisher: newBook.publisher,
      height: newBook.height,
      publishedCount: newBook.publishedCount
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// PUT /:id - Update a book by ID
router.put("/:id", authMiddleware, async (req, res) => {
  try {
    const updatedBook = await Book.findByIdAndUpdate(req.params.id, req.body, { new: true, select: "_id title author genre status location publisher height publishedCount" });
    if (!updatedBook) return res.status(404).json({ error: "Book not found" });
    res.json(updatedBook);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// DELETE /:id - Delete a book by ID
router.delete("/:id", authMiddleware, async (req, res) => {
  try {
    const deletedBook = await Book.findByIdAndDelete(req.params.id).select("_id title author");
    if (!deletedBook) return res.status(404).json({ error: "Book not found" });
    res.json({ message: "Book deleted successfully", deletedBook });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /bulk - Create multiple books (with validation & duplicate prevention)
router.post("/bulk", authMiddleware, async (req, res) => {
  try {
    if (!Array.isArray(req.body) || req.body.length === 0) {
      return res.status(400).json({ message: "Request body must be a non-empty array of books" });
    }
    await validateAndInsertBooks(req.body, res);
  } catch (error) {
    res.status(500).json({ message: "Failed to bulk insert books", error: error.message });
  }
});

// POST /bulk-delete - Delete multiple books by IDs
router.post("/bulk-delete", authMiddleware, async (req, res) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ message: "Please provide an array of book IDs to delete" });
    }
    await Book.deleteMany({ _id: { $in: ids } });
    res.json({ message: "Books deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
