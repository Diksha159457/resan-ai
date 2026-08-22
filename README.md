# Resan AI

Resan AI is a full-stack mentor chatbot designed to sustain human creativity instead of replacing it. It guides students and professionals through one micro-step at a time across creative, technical, academic, and practical fields.

## Run Locally

```bash
npm start
```

Open `http://localhost:3000`.

## Optional OpenAI Mode

Set `OPENAI_API_KEY` to connect the backend to OpenAI's Responses API. Without a key, the app runs in local mentor mode with a simple built-in guidance engine.

```bash
OPENAI_API_KEY=your_key_here npm start
```

You can also set `OPENAI_MODEL` and `PORT`.

## Deploy

This project includes `render.yaml`, `Dockerfile`, and `/health` for deployment. See `DEPLOYMENT.md`.

## Mentor Behavior

- Starts by asking what the user is making, who it is for, and how they feel.
- Keeps replies short and focused on one micro-step.
- Asks before telling.
- Offers ideas as sparks, not finished work.
- Improves existing work through feedback instead of replacement.
- Uses emergency mode only when the user explicitly signals urgency.
