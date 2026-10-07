import { z } from "zod";
import { withUser } from "@/lib/api";
import { prisma } from "@/lib/db";
import { HttpError } from "@/lib/study/session";
import { importChunk } from "@/lib/import/commit";
import { IMPORT_FIELDS } from "@/lib/import/types";

type Ctx = { params: Promise<{ id: string }> };

const body = z.object({
  startIndex: z.number().int().min(0),
  rows: z.array(z.partialRecord(z.enum(IMPORT_FIELDS), z.string().max(200_000))).max(1000),
});

export const POST = withUser<Ctx>(async (req, user, { params }) => {
  const { id } = await params;
  const batch = await prisma.importBatch.findFirst({ where: { id, userId: user.id } });
  if (!batch) throw new HttpError(404, "Import not found");
  if (batch.status === "COMPLETED") throw new HttpError(409, "Import already finished");
  const input = body.parse(await req.json());
  return importChunk(batch, input.rows, input.startIndex);
});
