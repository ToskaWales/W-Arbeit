// Nutzung: npm run code:create -- "Lisa M." 500      (Budget in Euro-Cent)
// Bis zur Admin-Seite (M2) ist das der Weg, einen Code anzulegen.
import { createAccessCode } from "../src/lib/access";
import { generateCode } from "../src/lib/codes";
import { MICRO_PER_CENT } from "../src/lib/cost";
import { getStore } from "../src/lib/store";

async function main() {
  const [name, cents] = process.argv.slice(2);
  const code = generateCode();
  await createAccessCode(getStore(), code, name, Number(cents) * MICRO_PER_CENT);
  console.log(`Code für ${name}: ${code}\nBudget: ${cents} Cent. Der Code wird nur jetzt einmal angezeigt.`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
