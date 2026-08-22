# Deploy Resan AI

Resan AI is a single Node web service. The backend serves `/api/chat`, `/health`, and the frontend in `public/`.

## Required Environment Variables

- `OPENAI_API_KEY`: Your OpenAI API key for full AI responses.
- `OPENAI_MODEL`: Optional. Defaults to `gpt-4.1-mini`.
- `PORT`: Optional. Most hosts set this automatically.
- `HOST`: Use `0.0.0.0` in production.

## Render

1. Push this repository to GitHub.
2. Create a new Render Blueprint or Web Service.
3. Use the included `render.yaml`.
4. Add `OPENAI_API_KEY` in Render environment variables.
5. Deploy.

## Docker

```bash
docker build -t resan-ai .
docker run -p 3000:3000 -e OPENAI_API_KEY=your_key_here resan-ai
```

Open `http://localhost:3000`.

## Local Production Check

```bash
HOST=127.0.0.1 PORT=3000 npm start
```

Then test:

```bash
curl http://127.0.0.1:3000/health
```
