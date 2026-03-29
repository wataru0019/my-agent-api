export type Tool = {
  toolDefine: {
    type: "function";
    name: string;
    description: string;
    parameters: {
      type: "object";
      properties: Record<string, { type: string; description?: string }>;
      required: string[];
      additionalProperties?: boolean;
    };
    strict?: boolean;
  };
  exec: (args: any) => Promise<any>;
};
