import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const response = await openai.responses.create({
  model: "gpt-5.4-nano",
  stream: true,
  input: [
    {
      role: "user",
      content: "AIに目的を与えて完遂させるにはどうしたらいいか",
    },
  ],
});

for await (const chunk of response) {
  if (chunk.type === "response.output_text.delta") {
    const text = chunk.delta;
    console.log(text);
  } else if (chunk.type === "response.completed") {
    console.log("completed");
  }
}
