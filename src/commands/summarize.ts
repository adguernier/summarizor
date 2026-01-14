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
  const response = await axios.get(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; DiscordBot/1.0)",
    },
    timeout: 10000,
  });

  const $ = cheerio.load(response.data);

  // Remove script, style, and nav elements
  $("script, style, nav, header, footer, aside").remove();

  // Try to find the article title
  let title =
    $("h1").first().text().trim() ||
    $("title").text().trim() ||
    $('meta[property="og:title"]').attr("content") ||
    "Article";

  // Try to find main content
  let content =
    $("article").text() ||
    $("main").text() ||
    $(".post-content").text() ||
    $(".entry-content").text() ||
    $("body").text();

  // Clean up whitespace
  content = content.replace(/\s+/g, " ").trim();

  // Limit content length
  if (content.length > 12000) {
    content = content.substring(0, 12000) + "...";
  }

  return { title, content };
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
          "You are a technical content summarizer. Create concise, informative summaries of technical articles.",
      },
      {
        role: "user",
        content: `Summarize this article in 3-4 sentences focusing on key technical points:\n\n${content}`,
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
          "You are a technical content analyst. Explain why articles are interesting and relevant.",
      },
      {
        role: "user",
        content: `Based on this article content and the tags "${tags}", explain in 2-3 sentences why this is interesting and relevant:\n\n${content.substring(
          0,
          3000
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
export async function handleSummarizeCommand(url: string) {
  console.log(`[SUMMARIZE] Starting summarization for URL: ${url}`);

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

  // Check if OpenAI API key is configured
  if (!process.env.OPENAI_API_KEY) {
    console.error(`[SUMMARIZE] OpenAI API key not configured`);
    return {
      content:
        "❌ OpenAI API key not configured. Please set OPENAI_API_KEY in your environment variables.",
      flags: 64,
    };
  }
  console.log(`[SUMMARIZE] OpenAI API key is configured`);

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

    // Generate tags, summary and interest explanation in parallel
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
