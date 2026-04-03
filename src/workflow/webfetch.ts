import { generateText, tool, stepCountIs } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { z } from "zod";

const openai = createOpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const { text } = await generateText({
  model: openai("gpt-5.4-nano"),
  system:
    "ユーザーからの要望に適切な回答をしなさい。ユーザーからURLの提示があった場合はToolを使用し、URL先のページ要約を回答しなさい。",
  prompt: "http://example.com",
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
  stopWhen: stepCountIs(5),
});

console.log(text);
