import type { PlanProblem } from "./types";
export function planProblemText(problem: PlanProblem): string {
  if (!problem.expires_at) return problem.message;
  const expiry = new Date(problem.expires_at).toLocaleString();
  if (problem.resume_at) return `Your Day Pass expires at ${expiry}. This break would resume writing at ${new Date(problem.resume_at).toLocaleString()}, after your access ends. Choose a shorter break or upgrade to Pro.`;
  if (problem.finish_at) return `Your Day Pass expires at ${expiry}. This session would finish at ${new Date(problem.finish_at).toLocaleString()}, after your access ends. Reduce writing time or breaks, or upgrade to Pro.`;
  return problem.message;
}
