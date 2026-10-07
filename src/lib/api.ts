import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { getApiUser, type CurrentUser } from "./auth";
import { HttpError } from "./study/session";

/** Wrap a route handler: require auth, convert errors to JSON responses. */
export function withUser<C>(handler: (req: Request, user: CurrentUser, ctx: C) => Promise<Response | unknown>) {
  return async (req: Request, ctx: C) => {
    const user = await getApiUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    try {
      const out = await handler(req, user, ctx);
      return out instanceof Response ? out : NextResponse.json(out);
    } catch (e) {
      if (e instanceof HttpError) return NextResponse.json({ error: e.message }, { status: e.status });
      if (e instanceof ZodError) return NextResponse.json({ error: e.issues[0]?.message ?? "Invalid input" }, { status: 400 });
      console.error(e);
      return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
    }
  };
}
