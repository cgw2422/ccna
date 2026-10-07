import { withUser } from "@/lib/api";
import { getSessionState } from "@/lib/study/session";

type Ctx = { params: Promise<{ sessionId: string }> };

export const GET = withUser<Ctx>(async (_req, user, { params }) => getSessionState(user.id, (await params).sessionId));
