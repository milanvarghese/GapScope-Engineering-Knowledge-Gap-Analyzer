export type ExtractedRepo = {
  fullName: string;
  owner: string;
  pushedAt: Date;
  tools: Set<string>;
};
