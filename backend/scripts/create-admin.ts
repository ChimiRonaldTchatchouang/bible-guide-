/**
 * Crée (ou promeut) un compte administrateur.
 *   npm run admin:create -- --email moi@exemple.com --password "motdepasse" [--name "Nom"]
 */
import { parseArgs } from 'node:util';
import { eq } from 'drizzle-orm';
import { db, pool } from '../src/db/client.js';
import { users } from '../src/db/schema.js';
import { hashPassword } from '../src/lib/auth.js';

const { values } = parseArgs({
  options: { email: { type: 'string' }, password: { type: 'string' }, name: { type: 'string' } },
});

async function main() {
  if (!values.email) throw new Error('--email est requis');
  const email = values.email.trim().toLowerCase();
  const [existing] = await db.select().from(users).where(eq(users.email, email));
  if (existing) {
    await db.update(users).set({ role: 'admin' }).where(eq(users.id, existing.id));
    console.log(`✔ ${email} est maintenant administrateur`);
    return;
  }
  if (!values.password || values.password.length < 8) throw new Error('--password (8 caractères minimum) est requis pour un nouveau compte');
  await db.insert(users).values({
    email,
    passwordHash: await hashPassword(values.password),
    displayName: values.name ?? 'Administrateur',
    role: 'admin',
  });
  console.log(`✔ Compte administrateur créé : ${email}`);
}

main()
  .catch((err) => {
    console.error('✖', err.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
