import OpenAI from "openai";
import type { Tool } from "../types";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function invokeAI(prompt: string) {
  const response = await openai.responses.create({
    model: "gpt-5.4-nano",
    reasoning: { effort: "low" },
    input: [
      {
        role: "user",
        content: prompt,
      },
    ],
  });

  return response.output_text;
}

export async function invokeAIStream(prompt: string) {
  const stream = await openai.responses.create({
    model: "gpt-5.4-nano",
    input: [
      {
        role: "user",
        content: prompt,
      },
    ],
    stream: true,
  });
  return stream;
}

const tool: Tool = {
  toolDefine: {
    type: "function",
    name: "add_calc",
    description: "Add two numbers together",
    parameters: {
      type: "object",
      properties: {
        num1: {
          type: "number",
          description: "The first number",
        },
        num2: {
          type: "number",
          description: "The second number",
        },
      },
      required: ["num1", "num2"],
      additionalProperties: false,
    },
    strict: true,
  },
  exec: async (args: { num1: number; num2: number }) => {
    return args.num1 + args.num2;
  },
};

const tools = [tool.toolDefine];

export async function invokeAIwithTools(prompt: string) {
  const response = await openai.responses.create({
    model: "gpt-5-nano",
    input: [
      {
        role: "user",
        content: prompt,
      },
    ],
    tools: tools,
  });
  // console.log(response);
  if (response.output[response.output.length - 1].type === "function_call") {
    const toolBlock = response.output[response.output.length - 1] as toolBlock;
    console.log(toolBlock);
    const result = await runTool(toolBlock);

    const responseWithToolResult = await openai.responses.create({
      model: "gpt-5-nano",
      previous_response_id: response.id,
      input: [
        {
          type: "function_call_output",
          call_id: toolBlock.call_id,
          output: String(result),
        },
      ],
    });
    console.log(responseWithToolResult.output_text);
    return responseWithToolResult.output_text;
  }
  return response.output_text;
}

type toolBlock = {
  id: string;
  type: "function_call";
  status: "completed";
  arguments: string;
  call_id: string;
  name: string;
};

function runTool(toolBlock: toolBlock) {
  const { name, arguments: args } = toolBlock;
  const parsedArgs = JSON.parse(args);
  return tool.exec(parsedArgs);
}
