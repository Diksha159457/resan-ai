import http from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";

const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || "127.0.0.1";
const PUBLIC_DIR = join(process.cwd(), "public");
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-5.1";
const MAX_BODY_SIZE = 1_000_000;
const HISTORY_LIMIT = 16;

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml"
};

const resanSystemPrompt = `You are Resan AI, a creative mentor. Resan comes from the Swedish word for "the journey." Your purpose is to sustain and enhance human creativity without replacing the human's thinking.

Default behavior:
- Ask what the user is making, who it is for, and how they feel.
- Guide one micro-step at a time.
- Ask before telling.
- Help users learn through effort, reflection, and iteration.
- Give ideas as sparks, not finished work.
- Improve existing work by reacting like an editor or coach.
- Never provide full final answers, essays, codebases, scripts, or polished creative work unless the user explicitly says this is an emergency or asks to "just give me the answer."
- Keep replies under 150 words unless emergency mode is active.
- Ask only one question or give one micro-nudge per turn.

Emergency protocol:
If the user clearly states an urgent time crunch such as "emergency," "due in 10 minutes," or "just give me the answer," provide the complete result directly and end with: "Emergency mode active. Let me know when you're ready to switch back to Resan Guide mode."

Domains include creative arts, writing, film, music, cooking, science, coding, finance, project planning, communication, and practical life projects. Adapt your coaching to the user's domain.`;

function jsonResponse(request, response, status, payload) {
  response.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  response.end(request.method === "HEAD" ? undefined : JSON.stringify(payload));
}

async function readBody(request) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > MAX_BODY_SIZE) {
      throw new Error("Request body is too large.");
    }
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString("utf8");
}

function fallbackMentorReply({ message, profile }) {
  const trimmedMessage = message.trim();
  const feeling = profile?.feeling || "Curious";
  const domain = profile?.domain || "your project";
  const lowerMessage = trimmedMessage.toLowerCase();

  if (/\b(emergency|due in|no time|just give me the answer)\b/i.test(message)) {
    return "Emergency mode is available, but I need the exact task or prompt first so I can produce the finished result. Emergency mode active. Let me know when you're ready to switch back to Resan Guide mode.";
  }

  if (!trimmedMessage) {
    return "What are you making today, who is it for, and how are you feeling about it right now?";
  }

  if (lowerMessage.startsWith("what is ") || lowerMessage.startsWith("explain ")) {
    const topic = trimmedMessage.replace(/^(what is|explain)\s+/i, "").replace(/[?.!]+$/, "");
    return `${topic} is worth learning through use, not just definition. In your own words first: where have you seen ${topic}, or what do you think it helps people do?`;
  }

  if (/\b(stuck|confused|don't know|dont know|help)\b/i.test(trimmedMessage)) {
    return `Since you're feeling ${feeling.toLowerCase()}, choose one tiny next step for ${domain}: describe the goal, name the audience, or show me your rough attempt. Which one can you do now?`;
  }

  if (trimmedMessage.length > 180) {
    return "There is something real here. Pick one part you care about most, and I will help you refine that piece without taking over the whole work.";
  }

  return `Good starting point for ${domain}. Now make it yours: write one rough sentence about what you want this to become and who should feel helped by it.`;
}

async function askOpenAI({ messages, profile }) {
  const input = [
    { role: "developer", content: resanSystemPrompt },
    {
      role: "user",
      content: `Current user profile: ${JSON.stringify(profile || {})}`
    },
    ...messages.slice(-HISTORY_LIMIT).map((message) => ({
      role: message.role === "assistant" ? "assistant" : "user",
      content: String(message.content || "")
    }))
  ];

  const apiResponse = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${OPENAI_API_KEY}`
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      input,
      max_output_tokens: 220,
      reasoning: { effort: "minimal" },
      store: false
    })
  });

  if (!apiResponse.ok) {
    const details = await apiResponse.text();
    throw new Error(`OpenAI request failed: ${apiResponse.status} ${details}`);
  }

  const data = await apiResponse.json();
  return extractOpenAIText(data) || fallbackMentorReply({
    message: messages.at(-1)?.content || "",
    profile
  });
}

function extractOpenAIText(data) {
  if (typeof data.output_text === "string") {
    return data.output_text.trim();
  }

  return data.output
    ?.flatMap((item) => item.content || [])
    ?.map((content) => content.text || "")
    ?.join("")
    ?.trim();
}

async function handleChat(request, response) {
  try {
    if (!request.headers["content-type"]?.includes("application/json")) {
      jsonResponse(request, response, 415, { error: "Expected application/json." });
      return;
    }

    const body = JSON.parse(await readBody(request) || "{}");
    const messages = Array.isArray(body.messages)
      ? body.messages
          .filter((message) => message && typeof message.content === "string")
          .map((message) => ({
            role: message.role === "assistant" ? "assistant" : "user",
            content: message.content.slice(0, 4000)
          }))
      : [];
    const profile = body.profile && typeof body.profile === "object" ? body.profile : {};
    const lastMessage = messages.at(-1)?.content || "";

    if (!messages.length || typeof lastMessage !== "string") {
      jsonResponse(request, response, 400, { error: "A chat message is required." });
      return;
    }

    let reply;
    let mode = "local";

    if (OPENAI_API_KEY) {
      try {
        reply = await askOpenAI({ messages, profile });
        mode = "openai";
      } catch (error) {
        console.error(error.message);
        reply = fallbackMentorReply({ message: lastMessage, profile });
        mode = "fallback";
      }
    } else {
      reply = fallbackMentorReply({ message: lastMessage, profile });
    }

    jsonResponse(request, response, 200, {
      reply,
      mode
    });
  } catch (error) {
    const isBadRequest = error instanceof SyntaxError || error.message === "Request body is too large.";
    jsonResponse(request, response, isBadRequest ? 400 : 500, {
      error: isBadRequest ? error.message : "Resan could not respond right now."
    });
  }
}

async function serveStatic(request, response) {
  const url = new URL(request.url, `http://${request.headers.host}`);
  const requestedPath = url.pathname === "/" ? "/index.html" : decodeURIComponent(url.pathname);
  const filePath = normalize(join(PUBLIC_DIR, requestedPath));

  if (!filePath.startsWith(PUBLIC_DIR)) {
    response.writeHead(403);
    response.end("Forbidden");
    return;
  }

  try {
    const file = await readFile(filePath);
    response.writeHead(200, {
      "content-type": MIME_TYPES[extname(filePath)] || "application/octet-stream"
    });
    response.end(request.method === "HEAD" ? undefined : file);
  } catch {
    response.writeHead(404);
    response.end("Not found");
  }
}

const server = http.createServer(async (request, response) => {
  if ((request.method === "GET" || request.method === "HEAD") && request.url === "/health") {
    jsonResponse(request, response, 200, {
      status: "ok",
      mode: OPENAI_API_KEY ? "openai" : "local"
    });
    return;
  }

  if (request.method === "POST" && request.url === "/api/chat") {
    await handleChat(request, response);
    return;
  }

  if (request.method === "GET" || request.method === "HEAD") {
    await serveStatic(request, response);
    return;
  }

  response.writeHead(405);
  response.end("Method not allowed");
});

server.listen(PORT, HOST, () => {
  console.log(`Resan AI is running at http://${HOST}:${PORT}`);
});
