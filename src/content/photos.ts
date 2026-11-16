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
  // A student with the microphone in the hall.
  programmeDebate: p("2024-04-IMG_8117-2048x1365.jpeg", 2048, 1365, "62% 35%"),
  // Students on stage at the competition.
  programmeCompetition: p("2022-03-D1EB5AE5-AA97-4D8B-97F2-ED64F113059F-2048x1365.jpeg", 2048, 1365, "55% 50%"),
  // Speakers on stage (CONFIRM: replace with an Inspire Her Future photograph).
  programmeIhf: p("2022-09-IMG_8603-2048x1365.jpeg", 2048, 1365, "50% 45%"),
  // Students in school uniform (CONFIRM: replace with an Èkó Dára photograph).
  programmeEkoDara: p("2024-04-IMG_8587-2048x1365.jpeg", 2048, 1365, "50% 35%"),
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

  // Added for the 2026 revamp (all from BGDI's own uploads).
  // The home hero, seen through the logo's silhouette: a student at the lectern.
  heroDream: p("2022-09-IMG_7628-1365x2048.jpeg", 1365, 2048, "50% 88%"),
  // One hand up in a hall of raised hands.
  heroHands: p("2022-09-IMG_7936-2048x1365.jpeg", 2048, 1365, "64% 50%"),
  // A student at the lectern under the "my dreams are valid" banner.
  heroLectern: p("2022-09-IMG_7628-1365x2048.jpeg", 1365, 2048, "50% 38%"),
  // Student portraits at the 2024 competition, for the students wall.
  student1: p("2024-04-IMG_7923-scaled.jpeg", 1707, 2560, "50% 22%"),
  student2: p("2024-04-IMG_7931-scaled.jpeg", 1707, 2560, "50% 25%"),
  student3: p("2024-04-IMG_8076-scaled.jpeg", 1707, 2560, "50% 25%"),
  // Girls clapping in the audience, in school hats.
  student4: p("2022-05-IMG_7394-scaled-e1652908888215-2048x1208.jpg", 2048, 1208, "38% 40%"),
  // The full hall at the Ibadan Schools Debate Competition.
  hall: p("2022-09-IMG_7515-scaled.webp", 2560, 1707, "50% 55%"),
  // The four joining steps.
  stepForm: p("2022-05-IMG_7472-2048x1365.jpg", 2048, 1365, "45% 50%"),
  stepGuardian: p("2022-03-3A78F5F5-C0ED-45D4-BBC7-FFF52DB73E8B-scaled-e1663102997930-1280x1659.jpeg", 1280, 1659, "50% 30%"),
  stepGroup: p("2022-03-026D63AF-0777-42BF-8A7C-1B53F39EA038-scaled-e1652908368673-2048x1218.jpeg", 2048, 1218, "70% 50%"),
  stepSession: p("2024-04-IMG_8114-2048x1365.jpeg", 2048, 1365, "50% 40%"),
  // Volunteers.
  volunteersYellow: p("2022-09-IMG_8006-2048x1365.jpeg", 2048, 1365, "50% 35%"),
  volunteersSmiling: p("2022-11-WhatsApp-Image-2022-11-03-at-16.01.43-1024x682.jpg", 1024, 682, "50% 40%"),
  // The closing photograph: winners and judges on stage.
  stage: p("2022-09-IMG_8298-2048x1365.jpeg", 2048, 1365, "50% 45%"),
  // Students in the audience.
  audience: p("2022-03-026D63AF-0777-42BF-8A7C-1B53F39EA038-scaled-e1652908368673-2048x1218.jpeg", 2048, 1218),
  speakers: p("2022-03-145292FF-052E-48E0-82CB-53EA7AC8F770-2048x1365.jpeg", 2048, 1365),
  hallWide: p("2022-03-82080D6F-E72A-4C22-93F1-48EDB5D4EFFF-2048x1365.jpeg", 2048, 1365),
} satisfies Record<string, PhotoSlot>;

export type PhotoKey = keyof typeof photos;

export const programmePhoto: Record<string, PhotoKey> = {
  "debate-and-public-speaking": "programmeDebate",
  "ibadan-schools-debate-competition": "programmeCompetition",
  "inspire-her-future": "programmeIhf",
  "eko-dara": "programmeEkoDara",
};
