# Art credits

Every image in `public/art/candidates` is a photograph of a public domain painting or print, supplied by the museum that owns it under its open access program. Nothing here is generated, traced, or stock. Each entry links to the museum's own record, which is where the license was confirmed.

| File | Title | Artist | Date | Museum | License | Source |
| --- | --- | --- | --- | --- | --- | --- |
| `whistler-nocturne-southampton.jpg` | Nocturne: Blue and Gold—Southampton Water | James McNeill Whistler (American, 1834–1903) | 1872 | Art Institute of Chicago | Public domain (AIC record: is_public_domain = true; images CC0) | https://www.artic.edu/artworks/56905 |
| `inness-moonrise.jpg` | Moonrise | George Inness (American, 1825–1894) | 1891 | Art Institute of Chicago | Public domain (AIC record: is_public_domain = true; images CC0) | https://www.artic.edu/artworks/64754 |
| `inness-twilight-in-italy.jpg` | Twilight in Italy | George Inness (American, 1825–1894) | 1890 | Art Institute of Chicago | Public domain (AIC record: is_public_domain = true; images CC0) | https://www.artic.edu/artworks/64764 |
| `breton-song-of-the-lark.jpg` | The Song of the Lark | Jules Breton (French, 1827–1906) | 1884 | Art Institute of Chicago | Public domain (AIC record: is_public_domain = true; images CC0) | https://www.artic.edu/artworks/94841 |
| `hiroshige-numazu-twilight.jpg` | Numazu: Twilight (Numazu, tasogare zu), from the series "Fifty-three Stations of the Tokaido Road (Tokaido gojusan tsugi no uchi)," also known as the Hoeido Tokaido | Utagawa Hiroshige 歌川 広重, Japanese, 1797-1858 | c. 1833/34 | Art Institute of Chicago | Public domain (AIC record: is_public_domain = true; images CC0) | https://www.artic.edu/artworks/25594 |
| `kiyochika-matsuchi-hill-dusk.jpg` | Second Month: Matsuchi Hill in Snow at Dusk (Kisaragi, Matsuchiyama yuki no tasogare), from the series "True Views of Famous Places in Tokyo (Tokyo meisho shinkei no uchi)" | Kobayashi Kiyochika, Japanese, 1847-1915 | 1896 | Art Institute of Chicago | Public domain (AIC record: is_public_domain = true; images CC0) | https://www.artic.edu/artworks/21780 |
| `blakelock-moonlight.jpg` | Moonlight | Ralph Albert Blakelock | 1886/1895 | National Gallery of Art | CC0 (NGA Open Access; published_images.csv openaccess = 1) | https://www.nga.gov/collection/art-object-page.177627.html |
| `metcalf-may-night.jpg` | May Night | Willard Leroy Metcalf | 1906 | National Gallery of Art | CC0 (NGA Open Access; published_images.csv openaccess = 1) | https://www.nga.gov/collection/art-object-page.195805.html |
| `lane-lumber-schooners-evening.jpg` | Lumber Schooners at Evening on Penobscot Bay | Fitz Henry Lane | 1863 | National Gallery of Art | CC0 (NGA Open Access; published_images.csv openaccess = 1) | https://www.nga.gov/collection/art-object-page.57611.html |
| `cole-sunrise-catskills.jpg` | Sunrise in the Catskills | Thomas Cole | 1826 | National Gallery of Art | CC0 (NGA Open Access; published_images.csv openaccess = 1) | https://www.nga.gov/collection/art-object-page.71025.html |
| `inness-lake-albano-sunset.jpg` | Lake Albano, Sunset | George Inness | c. 1874 | National Gallery of Art | CC0 (NGA Open Access; published_images.csv openaccess = 1) | https://www.nga.gov/collection/art-object-page.46426.html |
| `turner-keelmen-moonlight.jpg` | Keelmen Heaving in Coals by Moonlight | Joseph Mallord William Turner | 1835 | National Gallery of Art | CC0 (NGA Open Access; published_images.csv openaccess = 1) | https://www.nga.gov/collection/art-object-page.1225.html |

## How the license was checked

- Art Institute of Chicago: the public API record for each work returns `is_public_domain: true`. AIC publishes those images under CC0. Image files come from the museum's IIIF server at the 1686px width it allows.
- National Gallery of Art: each work's primary image appears in `published_images.csv` of the NGA open data release with `openaccess` set, and the object page carries the Open Access download. NGA releases those images under CC0. Files come from the NGA IIIF server at up to 2200px.
- The Met Collection API search endpoint returned 410 Gone on 2026-10-18, so no Met works are included. The object endpoint still answers, so Met candidates can be added by object id later.

## Color grade

On the page every painting sits under the same light treatment, defined once in `src/components/brand/painting.tsx`: a night multiply layer, a soft marigold wash, and a top and bottom gradient for text contrast. The files themselves are untouched.
