/** Public domain paintings for the landing page. Credits and license notes live in public/art/CREDITS.md. */
export interface Painting {
  slug: string;
  file: string;
  title: string;
  artist: string;
  date: string;
  museum: string;
  license: string;
  source: string;
  width: number;
  height: number;
  /** Suggested object-position for a wide crop. */
  focus: string;
  /** Why it is a candidate. */
  note: string;
}

export const paintings: Painting[] = [
  { slug: "whistler-nocturne-southampton", file: "/art/candidates/whistler-nocturne-southampton.jpg", title: "Nocturne: Blue and Gold—Southampton Water", artist: "James McNeill Whistler (American, 1834–1903)", date: "1872", museum: "Art Institute of Chicago", license: "Public domain (AIC record: is_public_domain = true; images CC0)", source: "https://www.artic.edu/artworks/56905", width: 1686, height: 1114, focus: "50% 55%", note: "Calm water at dusk, blue giving way to gold. Horizontal, quiet, almost nothing happening, which is what you want behind a UI." },
  { slug: "inness-moonrise", file: "/art/candidates/inness-moonrise.jpg", title: "Moonrise", artist: "George Inness (American, 1825–1894)", date: "1891", museum: "Art Institute of Chicago", license: "Public domain (AIC record: is_public_domain = true; images CC0)", source: "https://www.artic.edu/artworks/64754", width: 1686, height: 2021, focus: "50% 40%", note: "A soft moonrise over a dark meadow. Vertical, so the hero crop takes the middle band." },
  { slug: "inness-twilight-in-italy", file: "/art/candidates/inness-twilight-in-italy.jpg", title: "Twilight in Italy", artist: "George Inness (American, 1825–1894)", date: "1890", museum: "Art Institute of Chicago", license: "Public domain (AIC record: is_public_domain = true; images CC0)", source: "https://www.artic.edu/artworks/64764", width: 1686, height: 1110, focus: "50% 45%", note: "Warm orange twilight behind dark trees. Reads as hope at the end of the day." },
  { slug: "breton-song-of-the-lark", file: "/art/candidates/breton-song-of-the-lark.jpg", title: "The Song of the Lark", artist: "Jules Breton (French, 1827–1906)", date: "1884", museum: "Art Institute of Chicago", license: "Public domain (AIC record: is_public_domain = true; images CC0)", source: "https://www.artic.edu/artworks/94841", width: 1686, height: 2186, focus: "50% 30%", note: "A young farm worker at sunrise, pausing to listen. The most human image here and the clearest dawn after a long night. Vertical; the crop keeps the sky and the horizon line." },
  { slug: "hiroshige-numazu-twilight", file: "/art/candidates/hiroshige-numazu-twilight.jpg", title: "Numazu: Twilight (Numazu, tasogare zu), from the series \"Fifty-three Stations of the Tokaido Road (Tokaido gojusan tsugi no uchi),\" also known as the Hoeido Tokaido", artist: "Utagawa Hiroshige 歌川 広重, Japanese, 1797-1858", date: "c. 1833/34", museum: "Art Institute of Chicago", license: "Public domain (AIC record: is_public_domain = true; images CC0)", source: "https://www.artic.edu/artworks/25594", width: 1686, height: 1144, focus: "50% 50%", note: "Travelers on a road at dusk under a full moon. A path, a lantern-less walk home, and the brand's own metaphor in a woodblock print." },
  { slug: "kiyochika-matsuchi-hill-dusk", file: "/art/candidates/kiyochika-matsuchi-hill-dusk.jpg", title: "Second Month: Matsuchi Hill in Snow at Dusk (Kisaragi, Matsuchiyama yuki no tasogare), from the series \"True Views of Famous Places in Tokyo (Tokyo meisho shinkei no uchi)\"", artist: "Kobayashi Kiyochika, Japanese, 1847-1915", date: "1896", museum: "Art Institute of Chicago", license: "Public domain (AIC record: is_public_domain = true; images CC0)", source: "https://www.artic.edu/artworks/21780", width: 1686, height: 885, focus: "50% 50%", note: "Snow at dusk with warm window light. Very wide; good for a band behind the trust or closing section." },
  { slug: "blakelock-moonlight", file: "/art/candidates/blakelock-moonlight.jpg", title: "Moonlight", artist: "Ralph Albert Blakelock", date: "1886/1895", museum: "National Gallery of Art", license: "CC0 (NGA Open Access; published_images.csv openaccess = 1)", source: "https://www.nga.gov/collection/art-object-page.177627.html", width: 2200, height: 1596, focus: "50% 45%", note: "The classic American nocturne: a dark tree against a moonlit sky. Deep indigo and a single light source, which is the palette exactly." },
  { slug: "metcalf-may-night", file: "/art/candidates/metcalf-may-night.jpg", title: "May Night", artist: "Willard Leroy Metcalf", date: "1906", museum: "National Gallery of Art", license: "CC0 (NGA Open Access; published_images.csv openaccess = 1)", source: "https://www.nga.gov/collection/art-object-page.195805.html", width: 2023, height: 2200, focus: "50% 50%", note: "A white house glowing in moonlight, a figure walking toward the door. Lit windows at night: the lantern idea without drawing a lantern." },
  { slug: "lane-lumber-schooners-evening", file: "/art/candidates/lane-lumber-schooners-evening.jpg", title: "Lumber Schooners at Evening on Penobscot Bay", artist: "Fitz Henry Lane", date: "1863", museum: "National Gallery of Art", license: "CC0 (NGA Open Access; published_images.csv openaccess = 1)", source: "https://www.nga.gov/collection/art-object-page.57611.html", width: 2200, height: 1407, focus: "50% 50%", note: "Luminist calm: still water, pink evening light, boats at rest. Very flat and wide, so UI floats over it cleanly." },
  { slug: "cole-sunrise-catskills", file: "/art/candidates/cole-sunrise-catskills.jpg", title: "Sunrise in the Catskills", artist: "Thomas Cole", date: "1826", museum: "National Gallery of Art", license: "CC0 (NGA Open Access; published_images.csv openaccess = 1)", source: "https://www.nga.gov/collection/art-object-page.71025.html", width: 2200, height: 1574, focus: "50% 40%", note: "Mist burning off the mountains at sunrise. Big, hopeful, and a little wild." },
  { slug: "inness-lake-albano-sunset", file: "/art/candidates/inness-lake-albano-sunset.jpg", title: "Lake Albano, Sunset", artist: "George Inness", date: "c. 1874", museum: "National Gallery of Art", license: "CC0 (NGA Open Access; published_images.csv openaccess = 1)", source: "https://www.nga.gov/collection/art-object-page.46426.html", width: 2200, height: 1474, focus: "50% 55%", note: "Golden sunset over a lake with a figure on the shore. Warm enough to carry a paper section." },
  { slug: "turner-keelmen-moonlight", file: "/art/candidates/turner-keelmen-moonlight.jpg", title: "Keelmen Heaving in Coals by Moonlight", artist: "Joseph Mallord William Turner", date: "1835", museum: "National Gallery of Art", license: "CC0 (NGA Open Access; published_images.csv openaccess = 1)", source: "https://www.nga.gov/collection/art-object-page.1225.html", width: 2200, height: 1634, focus: "50% 50%", note: "Moonlight and firelight on the river at night. Dramatic; probably too busy for the hero, strong for the closing." },
];

export const bySlug = Object.fromEntries(paintings.map((p) => [p.slug, p])) as Record<string, Painting>;

/** The three in use on the landing page until a final pick is made on /art-review. */
export const picks = {
  hero: bySlug["inness-moonrise"],
  trust: bySlug["metcalf-may-night"],
  closing: bySlug["breton-song-of-the-lark"],
};
