import express from "express";
import {
  getStudents,
  addStudent,
  updateStudent,
  deleteStudent,
} from "../controllers/students.js";
import authMiddleware from "../middleware/auth.js"; // if you want auth

const router = express.Router();

router.get("/", authMiddleware, getStudents);
router.post("/", authMiddleware, addStudent);
router.put("/:rollNo", authMiddleware, updateStudent);
router.delete("/:rollNo", authMiddleware, deleteStudent);

export default router;
