import { handle } from "@/lib/api";

export const GET = handle(async (s) => ({ events: await s.listAudit(200) }));
