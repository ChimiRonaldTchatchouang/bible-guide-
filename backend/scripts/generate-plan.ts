/**
 * Répartit les groupes publiés sur les jours d'un plan.
 *   npm run plan:generate -- --plan annuel --strategy rotate   (by_theme | rotate | canonical)
 */
import { parseArgs } from 'node:util';
import { pool } from '../src/db/client.js';
import { generatePlan, getPlanBySlug, type PlanStrategy } from '../src/services/plans.js';

const { values } = parseArgs({
  options: { plan: { type: 'string', default: 'annuel' }, strategy: { type: 'string', default: 'by_theme' } },
});

async function main() {
  const plan = await getPlanBySlug(values.plan!);
  if (!plan) throw new Error(`Plan introuvable : ${values.plan}`);
  const result = await generatePlan(plan.id, values.strategy as PlanStrategy);
  console.log(`✔ ${result.groups} groupes répartis sur ${result.filledDays}/${result.totalDays} jours (${result.strategy})`);
  if (result.warning) console.log(`  ⚠ ${result.warning}`);
}

main()
  .catch((err) => {
    console.error('✖', err.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
