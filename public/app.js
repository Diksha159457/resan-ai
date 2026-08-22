const messagesElement = document.querySelector("#messages");
const form = document.querySelector("#chatForm");
const input = document.querySelector("#messageInput");
const domain = document.querySelector("#domain");
const stage = document.querySelector("#stage");
const audience = document.querySelector("#audience");
const connectionMode = document.querySelector("#connectionMode");
const sessionMode = document.querySelector("#sessionMode");
const statusLine = document.querySelector("#statusLine");
const turnCount = document.querySelector("#turnCount");
const exportButton = document.querySelector("#exportButton");
const resetButton = document.querySelector("#resetButton");
const feelingChips = [...document.querySelectorAll(".chip")];
const starterButtons = [...document.querySelectorAll("[data-prompt]")];
const storageKey = "resan-ai-session";

let messages = loadMessages() || [
  {
    role: "assistant",
    content: "Welcome to Resan AI, the journey.\n\nWhat are you making today, who is it for, and how are you feeling about it right now?"
  }
];

function getFeeling() {
  return document.querySelector(".chip.selected")?.textContent || "Curious";
}

function getProfile() {
  return {
    domain: domain.value,
    stage: stage.value,
    audience: audience.value.trim(),
    feeling: getFeeling()
  };
}

function loadMessages() {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey) || "null");
    return Array.isArray(saved) ? saved : null;
  } catch {
    return null;
  }
}

function saveMessages() {
  localStorage.setItem(storageKey, JSON.stringify(messages.slice(-40)));
}

function renderMessages() {
  messagesElement.innerHTML = "";
  for (const message of messages) {
    const bubble = document.createElement("article");
    bubble.className = `message ${message.role}`;
    bubble.textContent = message.content;
    messagesElement.append(bubble);
  }

  turnCount.textContent = String(Math.max(0, messages.filter((message) => message.role === "assistant").length - 1));
  messagesElement.scrollTop = messagesElement.scrollHeight;
  saveMessages();
}

function setLoading(isLoading) {
  form.querySelector("button").disabled = isLoading;
  input.disabled = isLoading;
  statusLine.textContent = isLoading ? "Resan is shaping the next micro-step..." : "Ready for one thoughtful step.";
}

function setMode(mode) {
  const labels = {
    openai: "OpenAI mentor",
    fallback: "Fallback mentor",
    local: "Local mentor"
  };

  connectionMode.textContent = labels[mode] || "Local mentor";
  sessionMode.textContent = mode === "openai" ? "AI" : "Guide";
}

async function sendMessage(content) {
  messages.push({ role: "user", content });
  renderMessages();
  setLoading(true);

  try {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ messages, profile: getProfile() })
    });
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Request failed");
    }

    setMode(data.mode);
    messages.push({ role: "assistant", content: data.reply });
  } catch (error) {
    messages.push({
      role: "assistant",
      content: `Connection issue: ${error.message}. Try once more, or check that the deployed backend is running.`
    });
    statusLine.textContent = "Connection issue. The backend did not complete the request.";
  } finally {
    setLoading(false);
    input.focus();
    renderMessages();
  }
}

feelingChips.forEach((chip) => {
  chip.addEventListener("click", () => {
    feelingChips.forEach((item) => item.classList.remove("selected"));
    chip.classList.add("selected");
  });
});

starterButtons.forEach((button) => {
  button.addEventListener("click", () => {
    input.value = button.dataset.prompt;
    input.focus();
  });
});

exportButton.addEventListener("click", () => {
  const transcript = messages
    .map((message) => `${message.role.toUpperCase()}: ${message.content}`)
    .join("\n\n");
  const blob = new Blob([transcript], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "resan-session.txt";
  link.click();
  URL.revokeObjectURL(url);
});

resetButton.addEventListener("click", () => {
  localStorage.removeItem(storageKey);
  messages = [
    {
      role: "assistant",
      content: "Welcome back to Resan AI.\n\nWhat are you making now, who is it for, and how are you feeling about it?"
    }
  ];
  renderMessages();
  input.focus();
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const content = input.value.trim();
  if (!content) return;
  input.value = "";
  await sendMessage(content);
});

input.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    form.requestSubmit();
  }
});

renderMessages();
