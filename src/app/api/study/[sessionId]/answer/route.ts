import { z } from "zod";
import { withUser } from "@/lib/api";
import { answerCard } from "@/lib/study/session";

type Ctx = { params: Promise<{ sessionId: string }> };

const body = z.object({
  cardId: z.string().min(1),
  rating: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]),
  durationMs: z.number().nonnegative().optional(),
});

export const POST = withUser<Ctx>(async (req, user, { params }) => {
  const { sessionId } = await params;
  const input = body.parse(await req.json());
  return answerCard({ userId: user.id, sessionId, ...input });
});
