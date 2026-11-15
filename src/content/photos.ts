/**
 * Photograph slots for the website (DESIGN.md §6.3). Photographs are BGDI's own, taken from the
 * current WordPress site (theblackgirlsdream.org/wp-content/uploads) and stored in public/img/bgdi/.
 * BGDI must still confirm that recorded permission exists for every child shown (CONFIRM), and which
 * event each photograph is from. A slot with `src: null` renders a static placeholder.
 */
export type PhotoSlot = { src: string | null; width: number; height: number; position?: string };

const p = (file: string, width: number, height: number, position?: string): PhotoSlot => ({
  src: `/img/bgdi/${file}`,
  width,
  height,
  position,
});

export const photos = {
  // A student at the microphone at the debate competition (2024).
  heroCompetition: p("2024-04-IMG_8117-2048x1365.jpeg", 2048, 1365, "60% 30%"),
  // Students in the hall during a session.
  session: p("2024-04-IMG_8114-2048x1365.jpeg", 2048, 1365, "50% 40%"),
  // The team in BGDI shirts.
  volunteersArriving: p("2022-09-IMG_8006-2048x1365.jpeg", 2048, 1365, "50% 35%"),
  // A student at the lectern.
  programmeDebate: p("2022-09-IMG_7628-1365x2048.jpeg", 1365, 2048, "50% 40%"),
  // The competition hall at Mapo Hall.
  programmeCompetition: p("2022-03-82080D6F-E72A-4C22-93F1-48EDB5D4EFFF-2048x1365.jpeg", 2048, 1365),
  // Students in the audience (CONFIRM: replace with an Inspire Her Future photograph).
  programmeIhf: p("2024-04-IMG_7923-scaled.jpeg", 1707, 2560, "50% 30%"),
  // Hands raised (CONFIRM: replace with an Èkó Dára photograph).
  programmeEkoDara: p("2022-09-IMG_7936-2048x1365.jpeg", 2048, 1365),
  programmeOther: p("2022-09-IMG_8603-2048x1365.jpeg", 2048, 1365),
  team: p("2022-09-IMG_8298-2048x1365.jpeg", 2048, 1365),
  founder: p("2024-04-Karimot-Odebode-picture2.jpg", 1170, 1474, "50% 25%"),
  storyA: p("2024-04-IMG_8587-2048x1365.jpeg", 2048, 1365),
  storyB: p("2022-03-D1EB5AE5-AA97-4D8B-97F2-ED64F113059F-2048x1365.jpeg", 2048, 1365),
  storyC: p("2022-05-IMG_7472-2048x1365.jpg", 2048, 1365),
  // Team portraits (adults), used in the "people" section.
  portrait1: p("2024-04-IMG-20240417-WA0020.jpg", 736, 1080, "50% 25%"),
  portrait2: p("2024-04-IMG-20240417-WA0021.jpg", 772, 1080, "50% 25%"),
  portrait3: p("2024-04-IMG-20240417-WA0022.jpg", 767, 1072, "50% 25%"),
  portrait4: p("2024-04-IMG-20240417-WA0023.jpg", 795, 1070, "50% 25%"),
} satisfies Record<string, PhotoSlot>;

export type PhotoKey = keyof typeof photos;

export const programmePhoto: Record<string, PhotoKey> = {
  "debate-and-public-speaking": "programmeDebate",
  "ibadan-schools-debate-competition": "programmeCompetition",
  "inspire-her-future": "programmeIhf",
  "eko-dara": "programmeEkoDara",
};
