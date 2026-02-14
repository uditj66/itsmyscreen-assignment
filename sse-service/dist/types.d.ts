import type { Response } from "express";
export type PollId = string;
export type ClientSet = Set<Response>;
export type NotifyBody = {
    question: string;
    options: unknown[];
    totalVotes: number;
};
//# sourceMappingURL=types.d.ts.map