import { Libre_Franklin, Source_Serif_4 } from "next/font/google";

// Self-hosted at build by next/font. The vietnamese subset carries ẹ and ọ, latin-ext carries ṣ
// (Yoruba dots below and tone marks; DESIGN.md §4.2).
export const serif = Source_Serif_4({
  subsets: ["latin", "latin-ext", "vietnamese"],
  weight: ["400"],
  display: "swap",
  variable: "--font-serif",
});

export const text = Libre_Franklin({
  subsets: ["latin", "latin-ext", "vietnamese"],
  weight: ["400", "500"],
  display: "swap",
  variable: "--font-text",
});
