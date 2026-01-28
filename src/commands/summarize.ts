import axios from "axios";
import * as cheerio from "cheerio";
import OpenAI from "openai";
import { storeUrlAndTags } from "../utils/urlStore";

// Command definition for registration
export const SUMMARIZE_COMMAND = {
  name: "summarize",
  description: "Summarize an IT article or blog post from a URL using AI",
  type: 1,
  integration_types: [0, 1],
  contexts: [0, 1, 2],
  options: [
    {
      type: 3, // STRING type
      name: "url",
      description: "The URL of the article to summarize",
      required: true,
    },
    {
      type: 5, // BOOLEAN type
      name: "debug",
      description: "Debug mode - skip OpenAI calls and use mock data",
      required: false,
    },
  ],
};

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Fetch and extract article content
async function fetchArticleContent(
  url: string
): Promise<{ title: string; content: string }> {
  console.log(`[FETCH] Starting fetch for URL: ${url}`);

  try {
    console.log(`[FETCH] Making HTTP GET request...`);
    const response = await axios.get(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; DiscordBot/1.0)",
      },
      timeout: 10000,
      maxRedirects: 5,
      validateStatus: (status) => status < 500, // Accept all responses < 500
    });

    console.log(`[FETCH] HTTP request completed - Status: ${response.status}`);
    console.log(`[FETCH] Response size: ${response.data?.length || 0} bytes`);
    console.log(`[FETCH] Content-Type: ${response.headers["content-type"]}`);

    if (response.status >= 400) {
      throw new Error(`HTTP ${response.status}: Failed to fetch article`);
    }

    console.log(`[FETCH] Loading HTML with Cheerio...`);
    const $ = cheerio.load(response.data);

    // Remove script, style, and nav elements
    console.log(`[FETCH] Cleaning HTML content...`);
    $("script, style, nav, header, footer, aside").remove();

    // Try to find the article title
    console.log(`[FETCH] Extracting article title...`);
    let title =
      $("h1").first().text().trim() ||
      $("title").text().trim() ||
      $('meta[property="og:title"]').attr("content") ||
      "Article";
    console.log(`[FETCH] Title extracted: ${title.substring(0, 100)}`);

    // Try to find main content
    console.log(`[FETCH] Extracting article content...`);
    let content =
      $("article").text() ||
      $("main").text() ||
      $(".post-content").text() ||
      $(".entry-content").text() ||
      $("body").text();

    console.log(`[FETCH] Raw content length: ${content.length} characters`);

    // Clean up whitespace
    content = content.replace(/\s+/g, " ").trim();
    console.log(`[FETCH] Cleaned content length: ${content.length} characters`);

    // Limit content length
    if (content.length > 12000) {
      content = content.substring(0, 12000) + "...";
      console.log(`[FETCH] Content truncated to 12000 characters`);
    }

    console.log(`[FETCH] Content extraction completed successfully`);
    return { title, content };
  } catch (error) {
    console.error(`[FETCH] ERROR during article fetch:`, error);

    if (axios.isAxiosError(error)) {
      console.error(`[FETCH] Axios error details:`, {
        message: error.message,
        code: error.code,
        status: error.response?.status,
        statusText: error.response?.statusText,
        timeout: error.code === "ECONNABORTED",
        network: error.code === "ERR_NETWORK",
      });

      // Provide more specific error messages
      if (error.code === "ECONNABORTED") {
        throw new Error(`Timeout: Article took too long to load (>10s)`);
      } else if (error.code === "ERR_NETWORK" || error.code === "ENOTFOUND") {
        throw new Error(
          `Network error: Cannot reach the URL. Check if the URL is accessible.`
        );
      } else if (error.code === "ECONNREFUSED") {
        throw new Error(`Connection refused: The server is not responding.`);
      } else if (error.response?.status) {
        throw new Error(
          `HTTP ${error.response.status}: ${error.response.statusText}`
        );
      }
    }

    // Re-throw the original error if we can't provide more context
    throw error;
  }
}

// Generate tags using OpenAI
async function generateTags(content: string, title: string): Promise<string> {
  const response = await openai.chat.completions.create({
    model: "gpt-3.5-turbo",
    messages: [
      {
        role: "system",
        content:
          "You are a technical content classifier. Generate 1-3 relevant tags for technical articles. Format: 'Tag1 / Tag2' or just 'Tag1'. Keep tags concise and technical.",
      },
      {
        role: "user",
        content: `Based on this title and content, generate relevant technical tags:\n\nTitle: ${title}\n\nContent: ${content.substring(
          0,
          2000
        )}`,
      },
    ],
    max_tokens: 50,
    temperature: 0.5,
  });

  return response.choices[0].message.content?.trim() || "Technology";
}

// Generate summary using OpenAI
async function generateSummary(content: string, tags: string): Promise<string> {
  const response = await openai.chat.completions.create({
    model: "gpt-3.5-turbo",
    messages: [
      {
        role: "system",
        content:
          "You are a technical content summarizer for developers. Write direct, technical summaries without meta-commentary. Never start with phrases like 'The article discusses', 'This article', 'The author explains', etc. Start immediately with the technical content.",
      },
      {
        role: "user",
        content: `Write a concise 3-4 sentence summary focusing on the core technical concepts, implementations, or solutions. Start directly with the technical information:\n\n${content}`,
      },
    ],
    max_tokens: 300,
    temperature: 0.7,
  });

  return response.choices[0].message.content || "Unable to generate summary.";
}

// Generate "Why it's interesting" section using OpenAI
async function generateInterest(
  content: string,
  tags: string
): Promise<string> {
  const response = await openai.chat.completions.create({
    model: "gpt-3.5-turbo",
    messages: [
      {
        role: "system",
        content:
          "You are a technical content analyst for developers. Explain the practical value and relevance directly. Never start with 'This article', 'The content', 'It is interesting', etc. Be direct and specific about technical benefits, use cases, or learning opportunities.",
      },
      {
        role: "user",
        content: `Based on the tags "${tags}", explain in 2-3 sentences why this is technically valuable for developers. Focus on practical applications, skills gained, or problems solved:\n\n${content.substring(
          0,
          3000,
        )}`,
      },
    ],
    max_tokens: 200,
    temperature: 0.7,
  });

  return (
    response.choices[0].message.content ||
    "This article provides valuable insights."
  );
}

// Command handler
export async function handleSummarizeCommand(
  url: string,
  debug: boolean = false
) {
  console.log(`[SUMMARIZE] Starting summarization for URL: ${url}`);
  console.log(`[SUMMARIZE] Debug mode: ${debug}`);

  // Validate URL format
  try {
    new URL(url);
    console.log(`[SUMMARIZE] URL validation passed`);
  } catch (error) {
    console.error(`[SUMMARIZE] URL validation failed:`, error);
    return {
      content: "❌ Invalid URL format. Please provide a valid URL.",
      flags: 64, // EPHEMERAL flag
    };
  }

  // Check if OpenAI API key is configured (skip in debug mode)
  if (!debug && !process.env.OPENAI_API_KEY) {
    console.error(`[SUMMARIZE] OpenAI API key not configured`);
    return {
      content:
        "❌ OpenAI API key not configured. Please set OPENAI_API_KEY in your environment variables.",
      flags: 64,
    };
  }
  if (!debug) {
    console.log(`[SUMMARIZE] OpenAI API key is configured`);
  }

  // In debug mode, skip everything and return mock response immediately
  if (debug) {
    console.log(
      `[SUMMARIZE] DEBUG MODE - Skipping article fetch and OpenAI calls`
    );
    console.log(
      `[SUMMARIZE] Creating mock response for Discord communication test`
    );

    const tags = "Debug / Mock Data";
    const summary =
      "This is a DEBUG summary. Neither article fetching nor OpenAI was called. This response confirms that Discord communication (receiving commands and sending responses) is working correctly.";
    const interest =
      "This DEBUG mode helps identify if the issue is with external dependencies (article fetching/OpenAI) or Discord communication. If you see this message, your bot's Discord integration is working perfectly!";
    const title = "Debug Mode - Mock Article";

    const description =
      `🏷️ **Tag:** ${tags}\n\n` +
      `🔗 **Link:** ${url}\n\n` +
      `📖 **Summary:**\n${summary}\n\n` +
      `💡 **Why it's interesting:**\n${interest}`;

    const urlId = storeUrlAndTags(url, tags);
    console.log(`[SUMMARIZE] URL stored with ID: ${urlId}`);
    console.log(`[SUMMARIZE] Returning mock response - no external calls made`);

    return {
      embeds: [
        {
          title: title,
          color: 0xff9900, // Orange color for debug mode
          description: description,
          timestamp: new Date().toISOString(),
          footer: {
            text: "CuraBot - DEBUG MODE (No External Calls)",
          },
        },
      ],
      components: [
        {
          type: 1,
          components: [
            {
              type: 2,
              style: 1,
              label: "🔄 Regenerate",
              custom_id: `regenerate_${urlId}`,
            },
            {
              type: 2,
              style: 2,
              label: "✏️ Edit",
              custom_id: `edit_${urlId}`,
            },
          ],
        },
      ],
    };
  }

  try {
    // Fetch article content
    console.log(`[SUMMARIZE] Fetching article content...`);
    const { title, content } = await fetchArticleContent(url);
    console.log(
      `[SUMMARIZE] Article fetched - Title: ${title}, Content length: ${content.length}`
    );

    if (!content || content.length < 100) {
      console.warn(
        `[SUMMARIZE] Insufficient content extracted (length: ${content.length})`
      );
      return {
        content: "❌ Unable to extract sufficient content from this URL.",
        flags: 64,
      };
    }

    // Generate tags, summary and interest explanation in normal mode
    console.log(
      `[SUMMARIZE] Generating AI content (tags, summary, interest)...`
    );
    const [tags, summary, interest] = await Promise.all([
      generateTags(content, title),
      generateSummary(content, ""),
      generateInterest(content, ""),
    ]);
    console.log(`[SUMMARIZE] AI content generated successfully`);
    console.log(`[SUMMARIZE] - Tags: ${tags}`);
    console.log(`[SUMMARIZE] - Summary length: ${summary.length}`);
    console.log(`[SUMMARIZE] - Interest length: ${interest.length}`);

    // Build formatted description with emojis
    let description = "";
    description += `🏷️ **Tag:** ${tags}\n\n`;
    description += `🔗 **Link:** ${url}\n\n`;
    description += `📖 **Summary:**\n${summary}\n\n`;
    description += `💡 **Why it's interesting:**\n${interest}`;

    // Store URL and tags for button interactions (to avoid custom_id length limit)
    const urlId = storeUrlAndTags(url, tags);
    console.log(`[SUMMARIZE] URL stored with ID: ${urlId}`);
    console.log(`[SUMMARIZE] Building response object...`);

    const response = {
      embeds: [
        {
          title: title,
          color: 0x5865f2,
          description: description,
          timestamp: new Date().toISOString(),
          footer: {
            text: "CuraBot - AI-Powered Summarization",
          },
        },
      ],
      components: [
        {
          type: 1, // Action Row
          components: [
            {
              type: 2, // Button
              style: 1, // Primary (blue)
              label: "🔄 Regenerate",
              custom_id: `regenerate_${urlId}`,
            },
            {
              type: 2, // Button
              style: 2, // Secondary (gray)
              label: "✏️ Edit",
              custom_id: `edit_${urlId}`,
            },
          ],
        },
      ],
    };

    console.log(`[SUMMARIZE] Response object built successfully`);
    console.log(`[SUMMARIZE] Returning response with embed and components`);
    return response;
  } catch (error) {
    console.error("[SUMMARIZE] Error summarizing article:", error);
    if (axios.isAxiosError(error)) {
      console.error("[SUMMARIZE] Axios error details:", {
        message: error.message,
        code: error.code,
        response: error.response?.status,
        responseData: error.response?.data,
      });
    }
    return {
      content: `❌ Failed to summarize the article: ${
        error instanceof Error ? error.message : "Unknown error"
      }`,
      flags: 64, // EPHEMERAL flag
    };
  }
}
