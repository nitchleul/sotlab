// Wait for DOM to fully load
document.addEventListener("DOMContentLoaded", function() {
  console.log("DOM fully loaded - SOT MindGuard AI Starting...");
  
  // Particles.js
  if (typeof particlesJS !== 'undefined') {
    particlesJS('particles-js', {
      particles: {
        number: { value: 80, density: { enable: true, value_area: 800 } },
        color: { value: '#a855f7' },
        shape: { type: 'circle' },
        opacity: { value: 0.5, random: false },
        size: { value: 3, random: true },
        line_linked: { enable: true, distance: 150, color: '#a855f7', opacity: 0.4, width: 1 },
        move: { enable: true, speed: 2, direction: 'none', random: false, straight: false, out_mode: 'out' }
      },
      interactivity: {
        detect_on: 'canvas',
        events: { onhover: { enable: true, mode: 'repulse' }, onclick: { enable: true, mode: 'push' } }
      },
      retina_detect: true
    });
  }

  // ========== STUDY TIMER ==========
  let timer = null;
  let seconds = 1500;
  let totalSeconds = 1500;

  function updateDisplay() {
    const timeElement = document.getElementById("time");
    if (timeElement) {
      const min = Math.floor(seconds / 60);
      const sec = seconds % 60;
      timeElement.innerText = `${min}:${sec < 10 ? "0" : ""}${sec}`;
    }
  }

  function updateProgress() {
    const progress = document.getElementById("progressBar");
    if (progress) {
      const percent = ((totalSeconds - seconds) / totalSeconds) * 100;
      progress.style.width = percent + "%";
    }
  }

  function setCustomTime() {
    const input = document.getElementById("minutesInput");
    if (input) {
      const minutes = parseInt(input.value);
      if (minutes && minutes > 0) {
        seconds = minutes * 60;
        totalSeconds = seconds;
        updateDisplay();
        updateProgress();
      }
    }
  }

  function startTimer() {
    if (timer !== null) return;
    timer = setInterval(() => {
      if (seconds > 0) {
        seconds--;
        updateDisplay();
        updateProgress();
      } else {
        clearInterval(timer);
        timer = null;
        alert("🎉 Session Complete!");
      }
    }, 1000);
  }

  function pauseTimer() {
    clearInterval(timer);
    timer = null;
  }

  function resetTimer() {
    clearInterval(timer);
    timer = null;
    const input = document.getElementById("minutesInput");
    const minutes = input ? parseInt(input.value) : 25;
    seconds = minutes * 60;
    totalSeconds = seconds;
    updateDisplay();
    updateProgress();
  }

  function loadStreak() {
    const el = document.getElementById("streak");
    if (el) {
      const streak = localStorage.getItem("streak") || 0;
      el.innerText = streak;
    }
  }

  function updateStreak() {
    let streak = parseInt(localStorage.getItem("streak") || 0);
    let lastDate = localStorage.getItem("lastDate");
    const today = new Date().toDateString();
    if (lastDate === today) {
      alert("You already studied today ✅");
      return;
    }
    streak = streak + 1;
    localStorage.setItem("streak", streak);
    localStorage.setItem("lastDate", today);
    document.getElementById("streak").innerText = streak;
    alert(`🎉 Amazing! ${streak} day streak! Keep learning!`);
  }

  updateDisplay();
  updateProgress();
  loadStreak();

  // Timer buttons
  const setTimeBtn = document.getElementById("setTimeBtn");
  if (setTimeBtn) setTimeBtn.onclick = setCustomTime;
  const startTimerBtn = document.getElementById("startTimerBtn");
  if (startTimerBtn) startTimerBtn.onclick = startTimer;
  const pauseTimerBtn = document.getElementById("pauseTimerBtn");
  if (pauseTimerBtn) pauseTimerBtn.onclick = pauseTimer;
  const resetTimerBtn = document.getElementById("resetTimerBtn");
  if (resetTimerBtn) resetTimerBtn.onclick = resetTimer;
  const streakBtn = document.getElementById("streakBtn");
  if (streakBtn) streakBtn.onclick = updateStreak;

  // ========== CHAT FUNCTION ==========
  async function sendMessage() {
    console.log("=== sendMessage called ===");
    
    const sendButton = document.getElementById("sendButton");
    const input = document.getElementById("userInput");
    const fileInput = document.getElementById("pdfFile");
    const chat = document.getElementById("chatBox");

    const message = input ? input.value.trim() : "";
    console.log("Message:", message || "(empty)");
    console.log("File:", fileInput && fileInput.files.length > 0 ? fileInput.files[0].name : "No file");

    if (message === "" && (!fileInput || fileInput.files.length === 0)) {
      console.log("No message and no file - returning");
      alert("Please type a message or upload a PDF file.");
      return;
    }

    if (sendButton) sendButton.disabled = true;

    // Add user message to chat
    const userMsg = document.createElement("div");
    userMsg.className = "message user";
    if (message) {
      userMsg.innerText = message;
    } else if (fileInput && fileInput.files.length > 0) {
      userMsg.innerText = "📄 Uploaded: " + fileInput.files[0].name;
    }
    chat.appendChild(userMsg);
    console.log("User message added to chat");

    // Add thinking indicator
    const thinking = document.createElement("div");
    thinking.className = "message bot";
    thinking.innerText = "MindGuard AI is thinking";
    chat.appendChild(thinking);
    chat.scrollTop = chat.scrollHeight;
    console.log("Thinking indicator added");

    // Typing animation
    let dots = 0;
    const typingAnimation = setInterval(() => {
      dots = (dots + 1) % 4;
      thinking.innerText = "MindGuard AI is thinking" + ".".repeat(dots);
    }, 500);

    const formData = new FormData();
    formData.append("message", message);
    if (fileInput && fileInput.files.length > 0) {
      formData.append("pdf", fileInput.files[0]);
    }

    try {
      console.log("Sending POST request to /api...");
      const res = await fetch("/api", {
        method: "POST",
        body: formData
      });
      
      console.log("Response status:", res.status);
      const data = await res.json();
      console.log("Response data:", data);

      clearInterval(typingAnimation);
      thinking.remove();
      console.log("Thinking indicator removed");

      const bot = document.createElement("div");
      bot.className = "message bot";
      bot.innerText = data.message || "I'm here to help!";
      chat.appendChild(bot);
      chat.scrollTop = chat.scrollHeight;
      console.log("Bot response added");

    } catch (err) {
      console.error("Error in fetch:", err);
      clearInterval(typingAnimation);
      thinking.innerText = "⚠️ Server error. Make sure backend is running on port 3002";
      setTimeout(() => {
        if (thinking && thinking.parentNode) thinking.remove();
      }, 3000);
    }

    if (sendButton) sendButton.disabled = false;
    if (input) input.value = "";
    if (fileInput) fileInput.value = "";
    chat.scrollTop = chat.scrollHeight;
  }

  // Attach send button event
  const sendButton = document.getElementById("sendButton");
  if (sendButton) {
    sendButton.onclick = sendMessage;
    console.log("Send button attached");
  } else {
    console.error("Send button not found!");
  }

  // Enter key handler
  const userInput = document.getElementById("userInput");
  if (userInput) {
    userInput.addEventListener("keypress", function(e) {
      if (e.key === "Enter") {
        e.preventDefault();
        console.log("Enter pressed");
        sendMessage();
      }
    });
  }

  console.log("All ready! Send button should work now.");
});