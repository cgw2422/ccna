import { prisma } from "./db";
import { safeTimeZone } from "./time";

export async function getSettings(userId: string) {
  const s = await prisma.userSettings.upsert({ where: { userId }, update: {}, create: { userId } });
  return { ...s, timezone: safeTimeZone(s.timezone) };
}

export type Settings = Awaited<ReturnType<typeof getSettings>>;
