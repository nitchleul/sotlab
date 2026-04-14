import express from "express";
import fetch from "node-fetch";
import multer from "multer";
import { createRequire } from "module";
import path from "path";
import { fileURLToPath } from "url";
import { initializeApp } from "firebase/app";
import { getFirestore, collection, addDoc, query, where, getDocs, updateDoc, doc } from "firebase/firestore";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const require = createRequire(import.meta.url);
const pdfParse = require("pdf-parse");

// Firebase Configuration
const firebaseConfig = {
  apiKey: "AIzaSyA5x26TUHDZKmX_3LKLJqnoqEEsSsIGEco",
  authDomain: "sot-lab.firebaseapp.com",
  projectId: "sot-lab",
  storageBucket: "sot-lab.firebasestorage.app",
  messagingSenderId: "545120157104",
  appId: "1:545120157104:web:e349f7d989610a5b196a75"
};

// Initialize Firebase
const firebaseApp = initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp);

const app = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(__dirname));

const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }
});

let chatHistory = [];

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

// API endpoint to save study session
app.post("/api/save-study", async (req, res) => {
  try {
    const { userId, minutes, date, streak } = req.body;
    
    const studyData = {
      userId: userId || "default-user",
      minutes: minutes,
      date: date,
      streak: streak,
      timestamp: new Date()
    };
    
    // Check if user already studied today
    const q = query(
      collection(db, "studySessions"),
      where("userId", "==", studyData.userId),
      where("date", "==", date)
    );
    
    const querySnapshot = await getDocs(q);
    
    if (querySnapshot.empty) {
      // Add new study session
      await addDoc(collection(db, "studySessions"), studyData);
      res.json({ success: true, message: "Study session saved!" });
    } else {
      // Update existing session
      const sessionDoc = querySnapshot.docs[0];
      await updateDoc(doc(db, "studySessions", sessionDoc.id), {
        minutes: minutes,
        timestamp: new Date()
      });
      res.json({ success: true, message: "Study session updated!" });
    }
    
  } catch (error) {
    console.error("Error saving study:", error);
    res.json({ success: false, error: error.message });
  }
});

// API endpoint to get study stats
app.get("/api/get-stats/:userId", async (req, res) => {
  try {
    const userId = req.params.userId || "default-user";
    
    // Get last 7 days of study data
    const last7Days = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      last7Days.push(date.toISOString().split('T')[0]);
    }
    
    const q = query(
      collection(db, "studySessions"),
      where("userId", "==", userId)
    );
    
    const querySnapshot = await getDocs(q);
    const studyData = {};
    let totalMinutes = 0;
    let currentStreak = 0;
    
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      studyData[data.date] = data.minutes;
      totalMinutes += data.minutes;
    });
    
    // Calculate current streak
    let today = new Date().toISOString().split('T')[0];
    let yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    let yesterdayStr = yesterday.toISOString().split('T')[0];
    
    if (studyData[today]) {
      currentStreak = 1;
      let checkDate = yesterdayStr;
      while (studyData[checkDate]) {
        currentStreak++;
        let prevDate = new Date(checkDate);
        prevDate.setDate(prevDate.getDate() - 1);
        checkDate = prevDate.toISOString().split('T')[0];
      }
    }
    
    // Prepare weekly data
    const weeklyData = last7Days.map(date => ({
      date: date,
      minutes: studyData[date] || 0
    }));
    
    res.json({
      success: true,
      totalMinutes: totalMinutes,
      currentStreak: currentStreak,
      weeklyData: weeklyData,
      totalHours: (totalMinutes / 60).toFixed(1)
    });
    
  } catch (error) {
    console.error("Error getting stats:", error);
    res.json({ success: false, error: error.message });
  }
});

// AI Chat endpoint
app.post("/api", upload.single("pdf"), async (req, res) => {
  const startTime = Date.now();
  
  try {
    const userMessage = req.body.message || "";
    
    let prompt = `You are SOT MindGuard AI, an intelligent study assistant.
You provide accurate, factual information and help students learn.
Be clear, concise, and educational.

`;

    if (chatHistory.length > 0) {
      const recentHistory = chatHistory.slice(-3).join("\n");
      prompt += `Previous conversation:\n${recentHistory}\n\n`;
    }
    
    if (req.file) {
      try {
        const pdfData = await pdfParse(req.file.buffer);
        const pdfText = pdfData.text.slice(0, 1000);
        prompt += `Document uploaded:\n${pdfText}\n\n`;
        
        if (!userMessage) {
          prompt += `Please analyze this document and provide a brief summary and key points.\n\n`;
        } else {
          prompt += `Based on this document, answer: ${userMessage}\n\n`;
        }
      } catch (pdfError) {
        prompt += `[PDF uploaded but text extraction had issues]\n\n`;
      }
    }
    
    if (userMessage && !req.file) {
      prompt += `Question: ${userMessage}\n\n`;
    } else if (!userMessage && !req.file) {
      return res.json({ message: "Please ask a question or upload a document to study." });
    }
    
    prompt += `Answer:`;
    
    const response = await fetch("http://localhost:11434/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "llama3.2:3b",
        prompt: prompt,
        stream: false,
        options: { 
          temperature: 0.3,
          num_predict: 500,
          top_k: 40,
          top_p: 0.9
        }
      })
    });
    
    const result = await response.json();
    let aiReply = result.response || "I'm here to help you learn!";
    aiReply = aiReply.trim();
    
    if (userMessage) {
      chatHistory.push("User: " + userMessage);
    }
    chatHistory.push("AI: " + aiReply.slice(0, 300));
    
    if (chatHistory.length > 6) {
      chatHistory = chatHistory.slice(-6);
    }
    
    const elapsed = Date.now() - startTime;
    console.log(`⚡ Response time: ${elapsed}ms`);
    
    res.json({ message: aiReply, time: elapsed });
    
  } catch (error) {
    console.error("Server error:", error);
    res.json({ 
      message: `⚠️ Error connecting to AI. Make sure Ollama is running.` 
    });
  }
});

const PORT = 3002;
app.listen(PORT, () => {
  console.log(`\n╔══════════════════════════════════════════════════════╗`);
  console.log(`║  🧠 SOT MindGuard AI - with Progress Tracker       ║`);
  console.log(`║  📍 http://localhost:${PORT}                        ║`);
  console.log(`║  📊 Study Progress saved to Firebase!              ║`);
  console.log(`║  🔥 Track your learning journey                    ║`);
  console.log(`╚══════════════════════════════════════════════════════╝\n`);
});