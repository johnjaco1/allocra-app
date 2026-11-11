import { handle } from "@/lib/api";

export const GET = handle(async (s) => ({ members: await s.listMembers(), me: s.user.email, org: s.orgName, role: s.role }));

export const POST = handle(async (s, req) => {
  const { email } = await req.json();
  const e = String(email || "").trim().toLowerCase();
  if (s.role !== "owner") throw new Error("Only your firm's owner can add teammates.");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) throw new Error("Enter a valid email.");
  await s.invite(e);
  await s.log("team.invite", e);
  return { members: await s.listMembers() };
});
