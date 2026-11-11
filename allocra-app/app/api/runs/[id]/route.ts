import { handle } from "@/lib/api";

export const DELETE = handle<{ id: string }>(async (s, _req, { id }) => { await s.deleteRun(id); });
