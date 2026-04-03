import { generateText } from "ai";
import { createOpenAI } from "@ai-sdk/openai";

type StepFunc<T> = (value: T) => T;

class WorkFlow {
  private steps: Map<string, StepFunc<T>> = new Map();
  private edges: Map<string, string> = new Map();
  private initialValue: T;
  private initialStep!: string;

  addStep(name: string, func: StepFunc<T>) {
    this.steps.set(name, func);
  }

  addEdge(from: string, to: string) {
    this.edges.set(from, to);
  }

  setInitialValue(value: T) {
    this.initialValue = value;
  }

  setInitialStep(step: string) {
    this.initialStep = step;
  }

  async run(): T {
    let currentStep = this.initialStep;
    let value = this.initialValue;

    while (currentStep) {
      const step = this.steps.get(currentStep);
      if (!step) throw new Error(`Step ${currentStep} not found`);

      const result = await step(value);
      value = result;
      currentStep = this.edges.get(currentStep) ?? "";
    }

    return value;
  }
}

const webFetchWf = new WorkFlow();

async function step1(value: string) {
  const response = await fetch(value);
  const text = await response.text();
  return text;
}

async function step2(value: string) {
  const openai = createOpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });
  const { text } = await generateText({
    model: openai("gpt-5.4-nano"),
    system: "ユーザーから与えられたテキストを要約しなさい。",
    prompt: value,
  });
  return text;
}

webFetchWf.setInitialValue("https://note.com/zephel01/n/n2c82c2281a37");
webFetchWf.setInitialStep("step01");

webFetchWf.addStep("step01", step1);
webFetchWf.addStep("step02", step2);

webFetchWf.addEdge("step01", "step02");

const result = await webFetchWf.run();
console.log(result);
