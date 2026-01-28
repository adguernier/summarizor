# CuraBot - AI-Powered Article Summarizer for Discord

A Discord bot that automatically summarizes IT articles and blog posts using OpenAI's GPT models. Built with TypeScript, Express, and Discord Interactions.

## Features

- 🤖 AI-powered article summarization using OpenAI GPT-3.5-turbo
- 🏷️ Automatic tag generation based on article content
- 📖 Extracts and summarizes web articles using Cheerio
- 💡 Generates "Why it's interesting" explanations
- 🔄 Regenerate summaries with one click
- ✏️ Edit summaries through interactive modals
- 🎨 Rich embeds with formatted output

## Prerequisites

- **Node.js** >= 18
- **npm**
- **Discord Application** with bot token
- **OpenAI API Key**
- **ngrok** or similar service for local development
- **Docker** and **Docker Compose** for local Redis server
- Optional: **Upstash Redis** account for production Redis

## Setup

### 1. Clone and Install Dependencies

```bash
npm install
```

### Run a Local Redis Server (for development)
Using Docker Compose, you can quickly spin up a local Redis server:

```bash
docker-compose up -d
```

### 2. Create a Discord Application

1. Go to the [Discord Developer Portal](https://discord.com/developers/applications)
2. Click "New Application" and give it a name
3. Go to the "Bot" section and click "Add Bot"
4. Under the bot's token section, click "Reset Token" and copy it (this is your `DISCORD_TOKEN`)
5. Go to "OAuth2" > "General"
   - Copy your **Application ID** (this is your `APP_ID`)
   - Copy your **Public Key** (this is your `PUBLIC_KEY`)
6. Go to "OAuth2" > "URL Generator"
   - Select scopes: `bot` and `applications.commands`
   - Select bot permissions: `Send Messages`, `Use Slash Commands`, `Embed Links`
   - Copy the generated URL and invite the bot to your test server

### 3. Configure Environment Variables

1. Copy `.env.example` to `.env`:

   ```bash
   cp .env.example .env
   ```

2. Edit `.env` and fill in your values:

   ```env
   # Discord Configuration
   APP_ID=your_application_id
   DISCORD_TOKEN=your_bot_token
   PUBLIC_KEY=your_public_key
   GUILD_ID=your_test_server_id  # Optional: for faster command registration during development

   # OpenAI Configuration
   OPENAI_API_KEY=your_openai_api_key

   # Redis Configuration (optional, for production)
   UPSTASH_REDIS_REST_URL=your_upstash_redis_rest_url
   UPSTASH_REDIS_REST_TOKEN=your_upstash_redis_rest_token
   ```

   **Where to find these values:**

   - `APP_ID`: Discord Developer Portal > Your App > General Information > Application ID
   - `DISCORD_TOKEN`: Discord Developer Portal > Your App > Bot > Token
   - `PUBLIC_KEY`: Discord Developer Portal > Your App > General Information > Public Key
   - `GUILD_ID`: Right-click your Discord server > Copy Server ID (requires Developer Mode)
   - `OPENAI_API_KEY`: [OpenAI API Keys](https://platform.openai.com/api-keys)
   - `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`: From your Upstash Redis database dashboard (if using Upstash)

### 4. Set Up ngrok (for local development)

Discord requires a public HTTPS endpoint for interactions. Use ngrok to expose your local server:

```bash
# Install ngrok
npm install -g ngrok
# or download from https://ngrok.com/download

# Authenticate (one-time setup)
ngrok config add-authtoken YOUR_NGROK_TOKEN

# Start ngrok tunnel
ngrok http 3000
```

Copy the HTTPS URL (e.g., `https://abc123.ngrok-free.app`)

### 5. Configure Discord Interactions Endpoint

1. Go to your Discord Application in the Developer Portal
2. Navigate to "General Information"
3. Set **Interactions Endpoint URL** to: `https://your-ngrok-url.ngrok-free.app/interactions`
4. Discord will verify the endpoint (make sure your bot is running!)

## Development

### Start the Development Server

```bash
npm run dev
```

The server will start on `http://localhost:3000`

Then run ngrok as described above to expose it publicly.

### Register Commands with Discord

After making changes to commands, register them with Discord:

```bash
npm run register
```

**Note:** If you set `GUILD_ID`, commands will be registered to that specific server (instant). Without it, commands are registered globally (takes up to 1 hour to propagate).

## Usage

Once the bot is running and invited to your server:

Use the slash command `/summarize` in any channel:

```
/summarize url:https://marmelab.com/blog/2025/12/08/supabase-edge-function-transaction-rls.html
```

The bot will:

1. Fetch the article content
2. Generate automatic tags
3. Create a summary
4. Explain why it's interesting
5. Display everything in a formatted embed with interactive buttons

## Troubleshooting

### Commands not showing in Discord

1. Make sure you ran `npm run register`
2. If using `GUILD_ID`, commands appear instantly in that server only
3. Global commands take up to 1 hour to appear
4. Try kicking and re-inviting the bot

### "Invalid Signature" error

- Check that `PUBLIC_KEY` in `.env` matches your Discord application
- Ensure the interaction endpoint URL is correct
- Verify ngrok is running and URL hasn't changed

### Bot not responding

1. Check that `npm run dev` is running
2. Verify ngrok tunnel is active
3. Check server logs for errors
4. Ensure `OPENAI_API_KEY` is valid## API Costs

### OpenAI Usage

The bot makes 3 OpenAI API calls per summarization:

1. Tag generation (~50 tokens)
2. Summary generation (~300 tokens)
3. Interest explanation (~200 tokens)

**Estimated cost per summary:** ~$0.001 - $0.002 (using GPT-3.5-turbo)

## License

MIT
