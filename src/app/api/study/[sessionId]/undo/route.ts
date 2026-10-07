import { withUser } from "@/lib/api";
import { undoLastAnswer } from "@/lib/study/session";

type Ctx = { params: Promise<{ sessionId: string }> };

export const POST = withUser<Ctx>(async (_req, user, { params }) => undoLastAnswer(user.id, (await params).sessionId));
