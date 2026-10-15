/**
 * Contenu de départ : thèmes de vie + premiers groupes de passages publiés + plan annuel.
 * Ré-exécutable (mise à jour par slug). Nécessite l'import de la Bible (npm run bible:import).
 *
 *   npm run seed
 *
 * ⚠ Les histoires contextuelles et enseignements ci-dessous sont un premier jet à faire relire.
 */
import { and, eq } from 'drizzle-orm';
import { db, pool } from '../src/db/client.js';
import { runMigrations } from '../src/db/migrate.js';
import {
  groupParallels,
  groupThemes,
  passageGroups,
  readingPlans,
  sectionParallels,
  sections,
  themes,
} from '../src/db/schema.js';
import { formatReference, parseReference, parseReferences, pickRange } from '../src/lib/reference.js';
import { rangeExists } from '../src/services/passages.js';
import { generatePlan } from '../src/services/plans.js';

interface ThemeSeed {
  slug: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  parent?: string;
}

export const THEMES: ThemeSeed[] = [
  { slug: 'foi', name: 'Foi', description: 'Faire confiance à Dieu et à ses promesses, même quand rien ne les confirme encore.', icon: 'sparkles', color: '#3E5C9A' },
  { slug: 'pardon', name: 'Pardon', description: 'Recevoir le pardon de Dieu et pardonner à ceux qui nous ont blessés.', icon: 'heart', color: '#B5523B' },
  { slug: 'mariage', name: 'Mariage', description: 'Le couple et la famille selon le dessein de Dieu.', icon: 'rings', color: '#A8577E' },
  { slug: 'mystere-du-mariage', name: 'Le mystère du mariage', description: 'Deux deviennent une seule chair : le fondement biblique du mariage.', icon: 'infinity', color: '#A8577E', parent: 'mariage' },
  { slug: 'recherche-de-l-amour', name: "Recherche de l'amour", description: 'Trouver son compagnon ou sa compagne de vie avec sagesse et prière.', icon: 'search-heart', color: '#C27A93', parent: 'mariage' },
  { slug: 'entrepreneuriat', name: 'Entrepreneuriat et travail', description: 'Travailler, bâtir et prospérer sans oublier Dieu.', icon: 'briefcase', color: '#B8862F' },
  { slug: 'protection', name: 'Protection', description: 'Dieu garde ceux qui se réfugient en lui.', icon: 'shield', color: '#2F7A6B' },
  { slug: 'sagesse', name: 'Sagesse', description: 'Marcher avec discernement dans les décisions de chaque jour.', icon: 'lamp', color: '#6B5B95' },
];

interface GroupSeed {
  slug: string;
  title: string;
  reference: string;
  /** "section" : parallèles de la Segond 1910 ; sinon liste de références. */
  parallels: 'section' | string;
  themes: string[];
  contextStory: string;
  teaching: string;
}

export const GROUPS: GroupSeed[] = [
  {
    slug: 'creation-de-la-femme-et-mariage',
    title: 'Les deux deviendront une seule chair',
    reference: 'Ge 2:18-24',
    parallels: 'section',
    themes: ['mystere-du-mariage', 'mariage'],
    contextStory:
      "Dieu vient de placer l'homme dans le jardin d'Éden. Il constate qu'il n'est pas bon que l'homme soit seul. Adam donne un nom à tous les animaux, mais aucun ne lui correspond. Dieu le plonge alors dans un profond sommeil, forme la femme à partir d'une de ses côtes et la lui amène.",
    teaching:
      "Le mariage vient de Dieu, pas d'une coutume humaine. L'homme quitte son père et sa mère, s'attache à sa femme, et les deux ne font plus qu'un. Jésus (Mt 19) et Paul (Ép 5) s'appuient sur ce texte pour enseigner le mariage.",
  },
  {
    slug: 'rebecca-au-puits',
    title: 'Rebecca au puits : une épouse choisie dans la prière',
    reference: 'Ge 24:12-27',
    parallels: 'Pr 19:14; Pr 18:22; Ru 3:10-11',
    themes: ['recherche-de-l-amour'],
    contextStory:
      "Abraham, très âgé, ne veut pas que son fils Isaac épouse une Cananéenne. Il envoie son serviteur chercher une épouse dans sa famille, en Mésopotamie. Arrivé près d'un puits le soir, le serviteur prie : que la jeune fille qui lui offrira à boire, ainsi qu'à ses chameaux, soit celle que Dieu a choisie. Rebecca arrive avant même qu'il ait fini de prier.",
    teaching:
      "Chercher son compagnon de vie commence par la prière. Le signe demandé porte sur le caractère : Rebecca se montre généreuse et travailleuse en abreuvant dix chameaux. Dieu conduit ceux qui le consultent avant de choisir.",
  },
  {
    slug: 'la-femme-vertueuse',
    title: 'La femme vertueuse',
    reference: 'Pr 31:10-31',
    parallels: 'section',
    themes: ['mariage', 'entrepreneuriat'],
    contextStory:
      "Le livre des Proverbes se termine par ce portrait, présenté comme l'enseignement qu'un roi a reçu de sa mère. Chaque verset commence, en hébreu, par une lettre de l'alphabet dans l'ordre : c'est un poème à apprendre par cœur.",
    teaching:
      "Cette femme gère sa maison, achète un champ, plante une vigne, fabrique et vend des étoffes, et ouvre la main au pauvre. Le travail, la bonne gestion et la crainte de l'Éternel vont ensemble ; une telle épouse vaut plus que les perles.",
  },
  {
    slug: 'joseph-se-fait-connaitre',
    title: 'Joseph se fait connaître à ses frères',
    reference: 'Ge 45:1-15',
    parallels: 'section',
    themes: ['pardon'],
    contextStory:
      "Vendu comme esclave par ses frères jaloux, Joseph est devenu gouverneur de l'Égypte. Pendant la famine, ses frères viennent acheter du blé sans le reconnaître. Après les avoir mis à l'épreuve, Joseph ne peut plus se retenir : il fait sortir tout le monde et se fait connaître en pleurant.",
    teaching:
      "Joseph voit la main de Dieu derrière le mal qu'il a subi : Dieu l'a envoyé en avant pour sauver des vies. Ce regard lui permet de pardonner sans humilier ses frères et de restaurer la famille.",
  },
  {
    slug: 'joseph-confirme-son-pardon',
    title: 'Vous aviez prévu le mal, Dieu l’a changé en bien',
    reference: 'Ge 50:15-21',
    parallels: 'section',
    themes: ['pardon'],
    contextStory:
      "Jacob, leur père, vient de mourir. Les frères de Joseph ont peur : maintenant qu'il n'y a plus de père pour les protéger, Joseph va-t-il se venger ? Ils lui envoient un message pour demander pardon et viennent se prosterner devant lui.",
    teaching:
      "Un pardon sincère ne se reprend pas avec le temps. Joseph refuse de se mettre à la place de Dieu, affirme que Dieu a tourné le mal en bien, et promet de nourrir ses frères et leurs enfants.",
  },
  {
    slug: 'heureux-celui-dont-la-faute-est-pardonnee',
    title: 'Heureux celui dont la transgression est pardonnée',
    reference: 'Ps 32',
    parallels: 'section',
    themes: ['pardon'],
    contextStory:
      "Psaume de David, souvent rapproché de son péché avec Bath-Schéba (2 Samuel 11–12). Il raconte ce qu'il a vécu tant qu'il cachait sa faute, puis la délivrance qui a suivi sa confession.",
    teaching:
      "Cacher sa faute épuise le corps et l'âme. La reconnaître devant Dieu apporte le pardon et la paix. Paul cite ce psaume (Ro 4) pour montrer que le pardon est une grâce, pas une récompense.",
  },
  {
    slug: 'abram-crut-a-la-promesse',
    title: 'Abram crut à la promesse',
    reference: 'Ge 15:1-6',
    parallels: 'section',
    themes: ['foi'],
    contextStory:
      "Abram a quitté son pays à l'appel de Dieu, mais des années plus tard il n'a toujours pas d'enfant. Il s'en plaint à Dieu. Dieu le fait sortir, lui montre les étoiles et lui promet une descendance aussi nombreuse.",
    teaching:
      "Abram fait confiance à Dieu, et Dieu le considère comme juste à cause de cette confiance. La foi consiste à s'appuyer sur la promesse de Dieu avant de la voir réalisée. Paul en fait le modèle de toute foi (Ro 4, Ga 3).",
  },
  {
    slug: 'passage-de-la-mer-rouge',
    title: 'Le passage de la mer Rouge',
    reference: 'Ex 14:1-31',
    parallels: 'section',
    themes: ['protection', 'foi'],
    contextStory:
      "Israël vient de sortir d'Égypte après quatre siècles d'esclavage. Pharaon change d'avis et le poursuit avec ses chars. Coincé entre l'armée et la mer, le peuple panique. Moïse lui demande de ne pas avoir peur : Dieu ouvre la mer, Israël passe à pied sec, et l'armée égyptienne est engloutie.",
    teaching:
      "Devant une impasse, Dieu peut ouvrir un chemin là où il n'y en a pas. Sa protection invite à rester calme et à avancer avec confiance quand il ouvre la voie.",
  },
  {
    slug: 'sous-l-abri-du-tres-haut',
    title: "Sous l'abri du Très-Haut",
    reference: 'Ps 91',
    parallels: 'section',
    themes: ['protection'],
    contextStory:
      "Psaume de confiance pour celui qui se réfugie auprès de Dieu. Il passe en revue les dangers de la nuit et du jour — piège, épidémie, flèche, attaque — et se termine par une promesse dite par Dieu lui-même.",
    teaching:
      "La sécurité du croyant ne vient pas de l'absence de danger, mais de la présence de Dieu. Quand le diable a cité ce psaume pour pousser Jésus à se jeter du haut du temple (Mt 4), Jésus a refusé : on s'y confie, on ne s'en sert pas pour mettre Dieu à l'épreuve.",
  },
  {
    slug: 'l-eternel-est-mon-berger',
    title: "L'Éternel est mon berger",
    reference: 'Ps 23',
    parallels: 'section',
    themes: ['protection', 'foi'],
    contextStory:
      "David a été berger avant d'être roi. Il connaît le travail du berger : trouver de l'herbe et de l'eau, guider, défendre le troupeau contre les bêtes sauvages. Il décrit Dieu avec ces images.",
    teaching:
      "Celui qui se laisse conduire par Dieu ne manque de rien d'essentiel, même dans la vallée la plus sombre. Jésus se présente comme le bon berger qui donne sa vie pour ses brebis (Jn 10).",
  },
  {
    slug: 'souviens-toi-de-celui-qui-donne-la-force',
    title: 'C’est Dieu qui donne la force d’acquérir',
    reference: 'De 8:1-20',
    parallels: 'section',
    themes: ['entrepreneuriat'],
    contextStory:
      "Après quarante ans dans le désert, Israël est sur le point d'entrer dans le pays promis. Moïse annonce une terre riche en blé, vignes, fer et cuivre, et met le peuple en garde : une fois rassasié, il risque d'oublier Dieu.",
    teaching:
      "La réussite peut rendre orgueilleux. Moïse rappelle que c'est Dieu qui donne la force de produire la richesse (v. 18). L'entrepreneur reste reconnaissant et fidèle quand les affaires prospèrent.",
  },
  {
    slug: 'isaac-seme-en-temps-de-famine',
    title: 'Isaac sème en temps de famine',
    reference: 'Ge 26:12-33',
    parallels: 'section',
    themes: ['entrepreneuriat'],
    contextStory:
      "Pendant une famine, Isaac reste dans le pays des Philistins. Il sème et récolte au centuple la même année, et ses troupeaux grandissent. Jaloux, les Philistins bouchent ses puits. Isaac en creuse d'autres sans se battre, jusqu'à trouver de la place. Finalement, le roi Abimélec vient lui proposer une alliance.",
    teaching:
      "Un travail béni de Dieu peut prospérer même en temps de crise. Face à la concurrence déloyale, Isaac persévère au lieu de se battre, et Dieu finit par lui donner de l'espace et la paix avec ses voisins.",
  },
  {
    slug: 'va-vers-la-fourmi',
    title: 'Va vers la fourmi, paresseux',
    reference: 'Pr 6:6-11',
    parallels: 'section',
    themes: ['entrepreneuriat', 'sagesse'],
    contextStory: "Un maître de sagesse envoie le paresseux observer un petit insecte, la fourmi.",
    teaching:
      "La fourmi n'a ni chef ni surveillant, et pourtant elle prépare ses réserves pendant la bonne saison. La discipline personnelle et la prévoyance protègent de la pauvreté qui arrive sans prévenir.",
  },
  {
    slug: 'nehemie-lance-la-reconstruction',
    title: 'Levons-nous, et bâtissons !',
    reference: 'Né 2:11-20',
    parallels: 'section',
    themes: ['entrepreneuriat', 'foi'],
    contextStory:
      "Néhémie, échanson du roi de Perse, a obtenu la permission de rebâtir les murailles de Jérusalem, en ruine depuis des années. Arrivé sur place, il inspecte les dégâts de nuit, sans rien dire. Puis il réunit les responsables et les motive. Des voisins hostiles se moquent du projet.",
    teaching:
      "Un projet réussi commence par un diagnostic lucide, une vision partagée et la confiance en Dieu face aux critiques. Néhémie ne se laisse pas décourager par les moqueries : le Dieu des cieux fera réussir l'œuvre.",
  },
  {
    slug: 'si-l-eternel-ne-batit-la-maison',
    title: "Si l'Éternel ne bâtit la maison",
    reference: 'Ps 127',
    parallels: 'section',
    themes: ['entrepreneuriat', 'mariage'],
    contextStory:
      "Court psaume attribué à Salomon, le roi bâtisseur du temple. Il fait partie des « cantiques des degrés », chantés par les pèlerins en montant à Jérusalem.",
    teaching:
      "Travailler jour et nuit sans Dieu ne garantit rien ; c'est lui qui fait réussir la maison, la ville et la famille. Le repos et les enfants sont des dons de Dieu, pas seulement le fruit de l'effort.",
  },
  {
    slug: 'confie-toi-en-l-eternel',
    title: "Confie-toi en l'Éternel de tout ton cœur",
    reference: 'Pr 3:1-10',
    parallels: 'section',
    themes: ['sagesse', 'foi'],
    contextStory: "Un père transmet à son fils les leçons de sa vie, pour qu'il ne les oublie pas.",
    teaching:
      "Faire confiance à Dieu plutôt qu'à sa seule intelligence, le reconnaître dans toutes ses décisions et l'honorer avec ses biens : c'est le chemin d'une vie droite et paisible.",
  },
];

async function main() {
  await runMigrations();

  const themeIds = new Map<string, number>();
  for (const [position, t] of THEMES.entries()) {
    const values = {
      slug: t.slug,
      name: t.name,
      description: t.description,
      icon: t.icon,
      color: t.color,
      position,
      parentId: t.parent ? themeIds.get(t.parent)! : null,
      published: true,
    };
    const [row] = await db
      .insert(themes)
      .values(values)
      .onConflictDoUpdate({ target: themes.slug, set: values })
      .returning({ id: themes.id });
    themeIds.set(t.slug, row!.id);
  }
  console.log(`✔ ${THEMES.length} thèmes`);

  for (const g of GROUPS) {
    const range = parseReference(g.reference);
    if (!(await rangeExists(range))) throw new Error(`${g.reference} absent : lancez d'abord npm run bible:import`);

    let parallels;
    let sourceSectionId: number | null = null;
    if (g.parallels === 'section') {
      const [section] = await db
        .select()
        .from(sections)
        .where(
          and(
            eq(sections.bookId, range.bookId),
            eq(sections.chapterStart, range.chapterStart),
            eq(sections.verseStart, range.verseStart),
          ),
        )
        .limit(1);
      if (!section) throw new Error(`Aucune section 1910 ne commence à ${g.reference}`);
      sourceSectionId = section.id;
      parallels = (await db.select().from(sectionParallels).where(eq(sectionParallels.sectionId, section.id))).map((p) => pickRange(p));
    } else {
      const parsed = parseReferences(g.parallels);
      if (parsed.errors.length) throw new Error(`${g.slug} : ${parsed.errors.join(', ')}`);
      parallels = parsed.ranges;
    }

    const values = {
      ...range,
      slug: g.slug,
      title: g.title,
      contextStory: g.contextStory,
      teaching: g.teaching,
      status: 'published' as const,
      sourceSectionId,
    };
    await db.transaction(async (tx) => {
      const [row] = await tx
        .insert(passageGroups)
        .values(values)
        .onConflictDoUpdate({ target: passageGroups.slug, set: values })
        .returning({ id: passageGroups.id });
      const groupId = row!.id;
      await tx.delete(groupParallels).where(eq(groupParallels.groupId, groupId));
      if (parallels.length) await tx.insert(groupParallels).values(parallels.map((p, position) => ({ groupId, ...p, position })));
      await tx.delete(groupThemes).where(eq(groupThemes.groupId, groupId));
      await tx.insert(groupThemes).values(
        g.themes.map((slug, position) => {
          const themeId = themeIds.get(slug);
          if (!themeId) throw new Error(`Thème inconnu ${slug}`);
          return { groupId, themeId, position };
        }),
      );
    });
    console.log(`  · ${g.title} — ${formatReference(range)} (${parallels.length} parallèles)`);
  }
  console.log(`✔ ${GROUPS.length} groupes publiés`);

  const planValues = {
    slug: 'annuel',
    name: 'La Bible en un an, par thèmes de vie',
    description: 'Chaque jour, un ou plusieurs groupes de passages, lus en entier avec leurs parallèles.',
    totalDays: 365,
    published: true,
  };
  const [plan] = await db
    .insert(readingPlans)
    .values(planValues)
    .onConflictDoUpdate({ target: readingPlans.slug, set: planValues })
    .returning({ id: readingPlans.id });
  const result = await generatePlan(plan!.id, 'rotate');
  console.log(`✔ Plan « annuel » : ${result.filledDays} jours remplis${result.warning ? ` — ${result.warning}` : ''}`);
}

main()
  .catch((err) => {
    console.error('✖', err.cause?.message ?? err.message ?? err);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
