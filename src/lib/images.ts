/**
 * Public domain images from the Library of Congress. Each record was checked on
 * loc.gov for its rights statement before it was added; the full notes are in
 * CREDITS.md. Every image is shown through the Duotone component.
 */
export interface PublicImage {
  slug: string;
  file: string;
  /** The Library of Congress title, lightly shortened. */
  title: string;
  /** What a person who cannot see it should know. */
  alt: string;
  creator: string;
  date: string;
  collection: string;
  locId: string;
  locUrl: string;
  reproductionNumber: string;
  rights: string;
  width: number;
  height: number;
  /** Suggested object-position for a wide crop. */
  position: string;
  /** Why it belongs to this subject. */
  note: string;
}

const FSA = "Prints and Photographs Division, Farm Security Administration/Office of War Information Black-and-White Negatives";
const FSA_RIGHTS = "No known restrictions. The Library of Congress states the FSA/OWI black-and-white negatives are in the public domain and free to use and reuse.";

export const images: PublicImage[] = [
  {
    slug: "parks-bethune-cookman-library",
    file: "/art/public-works/parks-bethune-cookman-library.jpg",
    title: "Students in the library reading room, Bethune-Cookman College, Daytona Beach, Florida",
    alt: "Students reading at long tables in a college library, photographed in 1943.",
    creator: "Gordon Parks",
    date: "January 1943",
    collection: FSA,
    locId: "2017843202",
    locUrl: "https://www.loc.gov/item/2017843202/",
    reproductionNumber: "LC-DIG-fsa-8d24709",
    rights: FSA_RIGHTS,
    width: 976,
    height: 1024,
    position: "50% 40%",
    note: "Young people, a public room, and work being done together. Taken by Gordon Parks for a government program.",
  },
  {
    slug: "collier-penasco-clinic",
    file: "/art/public-works/collier-penasco-clinic.jpg",
    title: "Clinic operated by the Taos County cooperative health association, Penasco, New Mexico",
    alt: "A small rural clinic building run by a cooperative health association, photographed in 1943.",
    creator: "John Collier Jr.",
    date: "January 1943",
    collection: FSA,
    locId: "2017842038",
    locUrl: "https://www.loc.gov/item/2017842038/",
    reproductionNumber: "LC-USW3-013652-C",
    rights: FSA_RIGHTS,
    width: 1024,
    height: 821,
    position: "50% 50%",
    note: "A clinic run by a cooperative for six villages. The exact kind of organization that uses this product.",
  },
  {
    slug: "lange-delta-community-house",
    file: "/art/public-works/lange-delta-community-house.jpg",
    title: "Newly erected community house at the Delta cooperative farm, Hillhouse, Mississippi",
    alt: "A newly built wooden community house with a porch, photographed in 1937. It held the library, school, clinic, and meeting rooms.",
    creator: "Dorothea Lange",
    date: "June 1937",
    collection: FSA,
    locId: "2017770267",
    locUrl: "https://www.loc.gov/item/2017770267/",
    reproductionNumber: "LC-DIG-fsa-8b32124",
    rights: FSA_RIGHTS,
    width: 817,
    height: 1024,
    position: "50% 55%",
    note: "One building that housed the library, the school, the clinic, and the meeting rooms. Public works in a single frame.",
  },
  {
    slug: "lee-san-leandro-classroom",
    file: "/art/public-works/lee-san-leandro-classroom.jpg",
    title: "Classroom in a grade school, San Leandro, California",
    alt: "A classroom of children with their hands raised, photographed in 1942.",
    creator: "Russell Lee",
    date: "April 1942",
    collection: FSA,
    locId: "2017830378",
    locUrl: "https://www.loc.gov/item/2017830378/",
    reproductionNumber: "LC-USW3-001849-D",
    rights: FSA_RIGHTS,
    width: 1024,
    height: 789,
    position: "50% 45%",
    note: "A room full of raised hands. The most hopeful frame in the set, for the moment a grant is won.",
  },
  {
    slug: "rothstein-harlem-community-art-center",
    file: "/art/public-works/rothstein-harlem-community-art-center.jpg",
    title: "Hundreds are receiving free instruction at the Harlem Community Art Center",
    alt: "A WPA Federal Art Project silkscreen poster advertising free art classes at the Harlem Community Art Center, with bold lettering and flat shapes.",
    creator: "Jerome Henry Rothstein, for the WPA Federal Art Project",
    date: "between 1936 and 1938",
    collection: "Prints and Photographs Division, Work Projects Administration Poster Collection",
    locId: "98516701",
    locUrl: "https://www.loc.gov/item/98516701/",
    reproductionNumber: "LC-USZC2-5383",
    rights: "No known restrictions on publication, per the Library of Congress record for this poster.",
    width: 680,
    height: 1024,
    position: "50% 50%",
    note: "A poster made with public money to tell a neighborhood that something was free. The medium this brand is built on.",
  },
];

export const bySlug = Object.fromEntries(images.map((i) => [i.slug, i])) as Record<string, PublicImage>;

/** Where each image is used. */
export const plates = {
  trust: bySlug["parks-bethune-cookman-library"],
  closing: bySlug["lange-delta-community-house"],
  auth: bySlug["collier-penasco-clinic"],
  won: bySlug["lee-san-leandro-classroom"],
  poster: bySlug["rothstein-harlem-community-art-center"],
};
