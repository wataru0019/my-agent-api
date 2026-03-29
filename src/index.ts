import { Hono } from "hono";
import { stream } from "hono/streaming";
import { invokeAI, invokeAIwithTools, invokeAIStream } from "./ai";

const app = new Hono();

app.get("/", (c) => {
  return c.text("Hello Hono!");
});

app.get("/ai", async (c) => {
  const response = await invokeAI(
    "AIに目的を与えて完遂させるにはどうしたらいいか",
  );
  console.log(response);
  return c.json({ response });
});

app.get("/stream", async (c) => {
  c.header("Content-Type", "text/event-stream; charset=utf-8");
  c.header("Cache-Control", "no-cache");
  c.header("Connection", "keep-alive");

  return stream(c, async (stream) => {
    const response = await invokeAIStream("カレーライスの作り方を教えて");
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
  const response = await invokeAIwithTools(
    "4898 + 32908 = ? Toolを使って計算して",
  );
  return c.json({ response });
});

export default app;
