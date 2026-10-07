// Idempotent seed: CCNA domains + (optionally) a first user with demo study days.
//   SEED_USER_EMAIL / SEED_USER_PASSWORD — create this account if missing.
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { createUserWithDefaults, ensureDeck, ensureDomains, seedDemoData } from "../src/lib/userSetup";

const db = new PrismaClient();

async function main() {
  await ensureDomains(db);
  console.log("✓ CCNA domains");

  const email = process.env.SEED_USER_EMAIL?.trim().toLowerCase();
  const password = process.env.SEED_USER_PASSWORD;
  if (!email || !password) {
    console.log("SEED_USER_EMAIL/SEED_USER_PASSWORD not set — skipping demo user (register in the app instead).");
    return;
  }
  const existing = await db.user.findUnique({ where: { email } });
  if (existing) {
    const deck = await ensureDeck(db, existing.id);
    const cardCount = await db.card.count({ where: { deckId: deck.id } });
    if (cardCount === 0 && process.env.SEED_DEMO_IF_EMPTY !== "false") {
      await seedDemoData(db, deck.id);
      console.log(`✓ Demo data added for ${email}`);
    } else console.log(`✓ User ${email} exists — leaving data untouched`);
    return;
  }
  await createUserWithDefaults(db, { email, passwordHash: await bcrypt.hash(password, 12), withDemo: true });
  console.log(`✓ Created ${email} with demo study days`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
