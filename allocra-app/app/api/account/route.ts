import { handle } from "@/lib/api";

// Permanently deletes every fund, document and analysis for the signed-in user's firm.
export const DELETE = handle(async (s) => {
  if (s.role !== "owner") throw new Error("Only your firm's owner can delete all data.");
  await s.deleteAllData();
  await s.log("data.delete_all", s.orgName);
});
