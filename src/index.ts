import "dotenv/config";
import express, { Request, Response } from "express";
import {
  InteractionType,
  InteractionResponseType,
  verifyKeyMiddleware,
} from "discord-interactions";
import { handleSummarizeCommand } from "./commands/summarize";
import { retrieveData } from "./utils/urlStore";
import { discordRequest } from "./utils/discord";
import axios from "axios";

const app = express();
const PORT = process.env.PORT || 3000;

// ========== Interaction Handlers ==========

// Handle PING interactions
function handlePing(res: Response) {
  console.log(`[INTERACTION] PING received, responding with PONG`);
  return res.send({ type: InteractionResponseType.PONG });
}

// Handle regenerate button click
async function handleRegenerateButton(
  customId: string,
  application_id: string,
  token: string,
  res: Response
) {
  const urlId = customId.replace("regenerate_", "");
  const data = retrieveData(urlId);

  if (!data) {
    return res.send({
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: {
        content: "❌ Data not found. The bot may have restarted.",
        flags: 64,
      },
    });
  }

  // Defer the update
  res.send({
    type: InteractionResponseType.DEFERRED_UPDATE_MESSAGE,
  });

  // Regenerate summary
  (async () => {
    try {
      console.log(`🔄 Regenerating summary for: ${data.url}`);
      const response = await handleSummarizeCommand(data.url);
      await updateMessage(application_id, token, response);
      console.log(`✅ Summary regenerated successfully`);
    } catch (error) {
      console.error("❌ Error regenerating:", error);
    }
  })();
}

// Handle edit button click
function handleEditButton(customId: string, res: Response) {
  const urlId = customId.replace("edit_", "");
  const data = retrieveData(urlId);

  if (!data) {
    return res.send({
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: {
        content: "❌ Data not found. The bot may have restarted.",
        flags: 64,
      },
    });
  }

  // Show a modal to edit the summary
  return res.send({
    type: InteractionResponseType.MODAL,
    data: {
      custom_id: `edit_modal_${urlId}`,
      title: "Edit Summary",
      components: [
        {
          type: 1, // Action Row
          components: [
            {
              type: 4, // Text Input
              custom_id: "tag_text",
              label: "Tag",
              style: 1, // Short
              placeholder: "e.g., AI / React / TypeScript",
              required: true,
              max_length: 100,
            },
          ],
        },
        {
          type: 1, // Action Row
          components: [
            {
              type: 4, // Text Input
              custom_id: "summary_text",
              label: "Summary",
              style: 2, // Paragraph
              placeholder: "Enter your edited summary...",
              required: true,
              max_length: 2000,
            },
          ],
        },
        {
          type: 1, // Action Row
          components: [
            {
              type: 4, // Text Input
              custom_id: "conclusion_text",
              label: "Why it's interesting",
              style: 2, // Paragraph
              placeholder: "Enter your edited conclusion...",
              required: true,
              max_length: 500,
            },
          ],
        },
      ],
    },
  });
}

// Handle message component interactions (buttons)
async function handleMessageComponent(
  customId: string,
  application_id: string,
  token: string,
  res: Response
) {
  if (customId.startsWith("regenerate_")) {
    return handleRegenerateButton(customId, application_id, token, res);
  }

  if (customId.startsWith("edit_")) {
    return handleEditButton(customId, res);
  }

  console.error(`Unknown component custom_id: ${customId}`);
  return res.status(400).json({ error: "unknown component" });
}

// Handle edit modal submission
async function handleEditModalSubmit(
  customId: string,
  data: any,
  application_id: string,
  token: string,
  res: Response
) {
  const urlId = customId.replace("edit_modal_", "");
  const storedData = retrieveData(urlId);

  if (!storedData) {
    return res.send({
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: {
        content: "❌ Data not found. The bot may have restarted.",
        flags: 64,
      },
    });
  }

  // Get the edited text from the modal
  const components = data.components;
  const tagText = components[0].components[0].value;
  const summaryText = components[1].components[0].value;
  const conclusionText = components[2].components[0].value;

  // Defer the update
  res.send({
    type: InteractionResponseType.DEFERRED_UPDATE_MESSAGE,
  });

  // Update the message with edited content
  (async () => {
    try {
      console.log(`✏️ Updating summary with user edits for: ${storedData.url}`);

      const description =
        `🏷️ **Tag:** ${tagText}\n\n` +
        `🔗 **Link:** ${storedData.url}\n\n` +
        `📖 **Summary:**\n${summaryText}\n\n` +
        `💡 **Why it's interesting:**\n${conclusionText}`;
      const response = {
        embeds: [
          {
            title: "Edited Summary",
            color: 0x5865f2,
            description: description,
            timestamp: new Date().toISOString(),
            footer: {
              text: "CuraBot - Manually Edited",
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

      await updateMessage(application_id, token, response);
      console.log(`✅ Summary updated with user edits`);
    } catch (error) {
      console.error("❌ Error updating with edits:", error);
    }
  })();
}

// Handle modal submit interactions
async function handleModalSubmit(
  customId: string,
  data: any,
  application_id: string,
  token: string,
  res: Response
) {
  if (customId.startsWith("edit_modal_")) {
    return handleEditModalSubmit(customId, data, application_id, token, res);
  }

  console.error(`Unknown modal custom_id: ${customId}`);
  return res.status(400).json({ error: "unknown modal" });
}

// Handle summarize command in debug mode
async function handleSummarizeDebugMode(url: string, res: Response) {
  console.log(`[COMMAND] Debug mode - responding immediately without deferral`);
  try {
    const response = await handleSummarizeCommand(url, true);
    console.log(`[COMMAND] Debug response generated, sending directly`);
    return res.send({
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: response,
    });
  } catch (error) {
    console.error(`[COMMAND] Error in debug mode:`, error);
    return res.send({
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: {
        content: `❌ Debug mode error: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
        flags: 64,
      },
    });
  }
}

// Handle summarize command in normal mode
async function handleSummarizeNormalMode(
  url: string,
  application_id: string,
  token: string,
  res: Response
) {
  console.log(`[COMMAND] Sending deferred response...`);
  res.send({
    type: InteractionResponseType.DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE,
  });
  console.log(`[COMMAND] Deferred response sent, starting async processing`);

  // Process the command asynchronously and send follow-up
  (async () => {
    try {
      console.log(`📥 Processing article: ${url}`);

      const response = await handleSummarizeCommand(url, false);

      console.log(`✅ Summary generated, sending to Discord`);

      // Send the actual response as a follow-up
      await sendFollowUp(application_id, token, response);

      console.log(`✅ Response sent successfully`);
    } catch (error) {
      console.error("❌ Error processing command:", error);

      // Send error message as follow-up
      try {
        await sendFollowUp(application_id, token, {
          content: `❌ An error occurred while processing your request: ${
            error instanceof Error ? error.message : "Unknown error"
          }`,
          flags: 64,
        });
      } catch (followUpError) {
        console.error("❌ Failed to send error follow-up:", followUpError);
      }
    }
  })();
}

// Handle summarize command
async function handleSummarizeCommandInteraction(
  url: string | undefined,
  debug: boolean,
  application_id: string,
  token: string,
  res: Response
) {
  console.log(`[COMMAND] Received /summarize command`);
  console.log(`[COMMAND] URL parameter: ${url}`);
  console.log(`[COMMAND] Debug parameter: ${debug}`);

  if (!url) {
    console.error(`[COMMAND] URL parameter missing`);
    return res.send({
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: {
        content: "❌ URL is required",
        flags: 64, // EPHEMERAL
      },
    });
  }

  // In debug mode, we can respond immediately since there are no external calls
  if (debug) {
    return handleSummarizeDebugMode(url, res);
  }

  // Normal mode: Defer the response since AI processing might take time
  return handleSummarizeNormalMode(url, application_id, token, res);
}

// Handle application command interactions
async function handleApplicationCommand(
  name: string,
  options: any[] | undefined,
  application_id: string,
  token: string,
  res: Response
) {
  if (name === "summarize") {
    const url = options?.find((opt: any) => opt.name === "url")?.value;
    const debug =
      options?.find((opt: any) => opt.name === "debug")?.value || false;
    return handleSummarizeCommandInteraction(
      url,
      debug,
      application_id,
      token,
      res
    );
  }

  console.error(`Unknown command: ${name}`);
  return res.status(400).json({ error: "unknown command" });
}

// ========== Helper Functions ==========

// Helper function to send follow-up messages
async function sendFollowUp(
  applicationId: string,
  interactionToken: string,
  data: any
) {
  const endpoint = `webhooks/${applicationId}/${interactionToken}`;
  console.log(`[FOLLOW-UP] Sending follow-up to endpoint: ${endpoint}`);
  try {
    await discordRequest(endpoint, {
      method: "POST",
      body: data,
    });
    console.log(`[FOLLOW-UP] Follow-up sent successfully`);
  } catch (error) {
    if (axios.isAxiosError(error)) {
      console.error("[FOLLOW-UP] Discord API Error:", error.response?.data);
    }
    throw error;
  }
}

// Helper function to update the original message
async function updateMessage(
  applicationId: string,
  interactionToken: string,
  data: any
) {
  const endpoint = `webhooks/${applicationId}/${interactionToken}/messages/@original`;
  console.log(`[UPDATE] Updating original message via endpoint: ${endpoint}`);
  try {
    await discordRequest(endpoint, {
      method: "PATCH",
      body: data,
    });
    console.log(`[UPDATE] Message updated successfully`);
  } catch (error) {
    console.error(`[UPDATE] Error updating message:`, error);
    throw error;
  }
}

// Interactions endpoint
app.post(
  "/interactions",
  verifyKeyMiddleware(process.env.PUBLIC_KEY!),
  async (req: Request, res: Response) => {
    const { type, data, token, application_id } = req.body;
    console.log(
      `[INTERACTION] Received interaction data: ${JSON.stringify(
        req.body,
        null,
        2
      )}`
    );
    console.log(`[INTERACTION] Received interaction type: ${type}`);

    // Handle verification requests
    if (type === InteractionType.PING) {
      return handlePing(res);
    }

    // Handle button clicks
    if (type === InteractionType.MESSAGE_COMPONENT) {
      return handleMessageComponent(data.custom_id, application_id, token, res);
    }

    // Handle modal submissions
    if (type === InteractionType.MODAL_SUBMIT) {
      return handleModalSubmit(
        data.custom_id,
        data,
        application_id,
        token,
        res
      );
    }

    // Handle slash command requests
    if (type === InteractionType.APPLICATION_COMMAND) {
      return handleApplicationCommand(
        data.name,
        data.options,
        application_id,
        token,
        res
      );
    }

    console.error("Unknown interaction type:", type);
    return res.status(400).json({ error: "unknown interaction type" });
  }
);

// Health check endpoint
app.get("/", (req: Request, res: Response) => {
  res.send("CuraBot is running! 🤖");
});

app.listen(PORT, () => {
  console.log(`🚀 Server listening on port ${PORT}`);
  console.log(
    `📝 Set your Interactions Endpoint URL to: https://your-domain.com/interactions`
  );
});
