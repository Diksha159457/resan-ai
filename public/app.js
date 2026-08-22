const messagesElement = document.querySelector("#messages");
const form = document.querySelector("#chatForm");
const input = document.querySelector("#messageInput");
const domain = document.querySelector("#domain");
const audience = document.querySelector("#audience");
const connectionMode = document.querySelector("#connectionMode");
const feelingChips = [...document.querySelectorAll(".chip")];

const messages = [
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
    audience: audience.value.trim(),
    feeling: getFeeling()
  };
}

function renderMessages() {
  messagesElement.innerHTML = "";
  for (const message of messages) {
    const bubble = document.createElement("article");
    bubble.className = `message ${message.role}`;
    bubble.textContent = message.content;
    messagesElement.append(bubble);
  }
  messagesElement.scrollTop = messagesElement.scrollHeight;
}

function setLoading(isLoading) {
  form.querySelector("button").disabled = isLoading;
  input.disabled = isLoading;
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

    connectionMode.textContent = data.mode === "openai" ? "OpenAI mentor" : "Local mentor";
    messages.push({ role: "assistant", content: data.reply });
  } catch (error) {
    messages.push({
      role: "assistant",
      content: "I lost the thread for a moment. Try again with one sentence about what you want to make."
    });
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
