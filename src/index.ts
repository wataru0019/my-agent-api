import { Hono } from "hono";
import { stream } from "hono/streaming";
import { validateSignature } from "@line/bot-sdk";
import { invokeAI, invokeAIwithTools, invokeAIStream } from "./ai";
import { generateText, tool, stepCountIs } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { z } from "zod";

type Bindings = {
  LINE_CHANNEL_SECRET?: string;
  LINE_CHANNEL_ACCESS_TOKEN?: string;
  OPENAI_API_KEY?: string;
};

const app = new Hono<{ Bindings: Bindings }>();

function getEnvValue(c: { env: Bindings }, key: keyof Bindings) {
  return c.env[key] ?? process.env[key];
}

app.get("/", (c) => {
  return c.text("Hello Hono!");
});

app.get("/ai", async (c) => {
  const apiKey = getEnvValue(c, "OPENAI_API_KEY");
  if (!apiKey) {
    return c.json({ message: "OPENAI_API_KEY is not set" }, 500);
  }

  const response = await invokeAI(
    "AIに目的を与えて完遂させるにはどうしたらいいか",
    apiKey,
  );
  console.log(response);
  return c.json({ response });
});

app.get("/stream", async (c) => {
  const apiKey = getEnvValue(c, "OPENAI_API_KEY");
  if (!apiKey) {
    return c.json({ message: "OPENAI_API_KEY is not set" }, 500);
  }

  c.header("Content-Type", "text/event-stream; charset=utf-8");
  c.header("Cache-Control", "no-cache");
  c.header("Connection", "keep-alive");

  return stream(c, async (stream) => {
    const response = await invokeAIStream(
      "カレーライスの作り方を教えて",
      apiKey,
    );
    // OpenAI SDKはAsyncIterableなのでfor awaitで回せる
    for await (const chunk of response) {
      if (chunk.type === "response.output_text.delta") {
        const text = chunk.delta;
        console.log("delta:", chunk.delta);

        // SSEフォーマットで書き出す
        await stream.write(text);
      }
    }

    await stream.write("data: [DONE]\n\n");
  });
});

app.get("/ai-tools", async (c) => {
  const apiKey = getEnvValue(c, "OPENAI_API_KEY");
  if (!apiKey) {
    return c.json({ message: "OPENAI_API_KEY is not set" }, 500);
  }

  const response = await invokeAIwithTools(
    "4898 + 32908 = ? Toolを使って計算して",
    apiKey,
  );
  return c.json({ response });
});

app.post("/webhook", async (c) => {
  const channelSecret = getEnvValue(c, "LINE_CHANNEL_SECRET");
  const channelAccessToken = getEnvValue(c, "LINE_CHANNEL_ACCESS_TOKEN");
  const apiKey = getEnvValue(c, "OPENAI_API_KEY");
  if (!channelSecret || !channelAccessToken || !apiKey) {
    return c.json({ message: "LINE credentials are not set" }, 500);
  }

  const body = await c.req.text();
  const signature = c.req.header("x-line-signature") ?? "";

  // 署名検証（必須）
  if (!validateSignature(body, channelSecret, signature)) {
    return c.json({ message: "Unauthorized" }, 401);
  }

  const events = JSON.parse(body).events;

  // 非同期で処理（LINEは1秒以内のレスポンスを期待）
  c.executionCtx.waitUntil(handleEvents(events, channelAccessToken, apiKey));

  return c.json({ status: "ok" });
});

type LineWebhookEvent = {
  type: string;
  replyToken?: string;
  source?: {
    userId?: string;
  };
  message?: {
    type?: string;
    text?: string;
  };
};

async function handleEvents(
  events: LineWebhookEvent[],
  channelAccessToken: string,
  apiKey: string,
) {
  for (const event of events) {
    try {
      if (
        event.type === "message" &&
        event.message?.type === "text" &&
        event.replyToken &&
        event.message.text
      ) {
        await replyMessage(
          event.replyToken,
          "メッセージを受け付けました。返信を生成しています。",
          channelAccessToken,
        );

        if (!event.source?.userId) {
          console.error("LINE push skipped: userId is missing");
          continue;
        }

        const openai = createOpenAI({
          apiKey: apiKey,
        });

        const { text } = await generateText({
          model: openai("gpt-5.4-nano"),
          system:
            "ユーザーからの要望に適切な回答をしなさい。ユーザーからURLの提示があった場合はToolを使用し、URL先のページ要約を回答しなさい。",
          prompt: event.message.text,
          tools: {
            webFetch: tool({
              description:
                "ユーザーから提供のあったURLのページを参照し、参照先ページの要約をする",
              inputSchema: z.object({
                url: z.string().url(),
              }),
              execute: async ({ url }) => {
                const response = await fetch(url);
                const text = await response.text();
                return text;
              },
            }),
          },
        });
        await pushMessage(event.source.userId, text, channelAccessToken);
      }
    } catch (error) {
      console.error("Webhook event handling failed", error);
    }
  }
}

async function replyMessage(
  replyToken: string,
  text: string,
  channelAccessToken: string,
) {
  const safeText = text.slice(0, 5000);
  const response = await fetch("https://api.line.me/v2/bot/message/reply", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${channelAccessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      replyToken,
      messages: [{ type: "text", text: safeText }],
    }),
  });

  const responseBody = await response.text();
  if (!response.ok) {
    console.error("LINE reply failed", response.status, responseBody);
    throw new Error(`LINE reply failed: ${response.status} ${responseBody}`);
  }
}

async function pushMessage(
  userId: string,
  text: string,
  channelAccessToken: string,
) {
  const safeText = text.slice(0, 5000);
  const response = await fetch("https://api.line.me/v2/bot/message/push", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${channelAccessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      to: userId,
      messages: [{ type: "text", text: safeText }],
    }),
  });

  const responseBody = await response.text();
  if (!response.ok) {
    console.error("LINE push failed", response.status, responseBody);
    throw new Error(`LINE push failed: ${response.status} ${responseBody}`);
  }
}

export default app;
