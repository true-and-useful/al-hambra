# Pattern corpus

The launch collection is deliberately small and structurally mixed. The first pattern proves the basic construction path, the second breaks any abstraction fitted only to regular tiles, and the third proves that the kernel is not square-grid software. Source imagery is reference-only; the application ships independent geometric constructions and provenance links.

## Launch collection

### Alaeddin Eight

- **Relationship:** adapted from the Alâeddin Mosque minbar / P222 pattern family
- **Object:** ebony minbar, Alâeddin Mosque, Konya, Türkiye
- **Date and region:** inscription-dated September 1155; Anatolian Seljuk
- **Sources:** [Museum With No Frontiers monument record](https://islamicart.museumwnf.org/database_item.php?id=monument%3BISL%3Btr%3BMon01%3B3%3Ben), [MIT Tiling Search P222 analysis](https://tilingsearch.mit.edu/HTML/data161/P222.html), and [Kaplan's polygons-in-contact construction](https://cs.uwaterloo.ca/~csk/publications/Papers/kaplan_2005.pdf)
- **Construction reading:** square `p4m` lattice; regular square/octagon support; 22.5° angular vocabulary; one cell-spanning interlace. The implementation starts with a single-angle contact construction and must be relabelled `inspired by` if the historical graph cannot be fitted honestly.
- **Recognizable features:** regular eight-point cadence, square/octagonal rhythm, straight crossovers, and one unbroken through-strand. Vegetal carving inside the historical wood panels is not reproduced.
- **Image rights:** do not bundle source photography. The application links to the analysis and generates the geometry independently.

### Darb-i Imam Ten

- **Relationship:** inspired by Darb-i Imam pattern IRA0911
- **Object:** tile-mosaic geometric panel at the Darb-e Imam shrine complex, Isfahan, Iran
- **Date and region:** 857 AH / 1453 CE; Qara Qoyunlu-era Persia
- **Sources:** [Encyclopaedia Iranica monument record](https://www.iranicaonline.org/articles/darb-e-emam/), [MIT Tiling Search IRA0911 analysis](https://tilingsearch.mit.edu/HTML/data189/IRA0911.html), and [Kaplan's corrected-contact discussion](https://cs.uwaterloo.ca/~csk/publications/Papers/kaplan_2005.pdf)
- **Source construction reading:** centered rectangular `cmm` lattice; 36° angular vocabulary; regular pentagons; narrow and broad ten-point stars; seven irregular reflective tile types; six finite interlaces and one cell-spanning interlace.
- **Shipped interpretation:** paired corrected ten-point rosettes, multiple contact groups, local point corrections, finite loops, and an explicit seam-crossing through-strand. It does not reconstruct the source's seven supporting tile types or claim archaeological fidelity.
- **Image rights and identity:** source photographs remain reference-only. IRA0911 is periodic and is not the shrine's famous quasi-periodic spandrel; app copy and metadata must not conflate them.

### Kharraqan Twelve

- **Relationship:** adapted from the Kharraqan–W85 pattern family
- **Object:** twelvefold geometric ornament documented on the eastern Kharraqan tomb tower near Qazvin, Iran
- **Date and region:** 1067–68; Seljuk Iran
- **Sources:** [MIT Tiling Search W85 analysis](https://tilingsearch.mit.edu/HTML/data18/W85.html), [academic survey of the Kharraqan towers](https://link.springer.com/article/10.1007/s12210-023-01171-3), and [University of Michigan visual record](https://quod.lib.umich.edu/h/hart/x-931638/02d100882)
- **Source construction reading:** hexagonal `p6m` lattice; 30° angular vocabulary; regular twelve-point stars; equilateral-triangle and kite interstices; one finite and one cell-spanning interlace.
- **Shipped interpretation:** layered twelve-point rosettes on an oblique repeat, with axis links and one explicit seam-spanning continuation. The source's triangle/kite interstices and full historical strand graph have not yet been fitted and remain a provenance gate.
- **Recognizable target:** twelve-point stars on a triangular cadence, compact interstitial forms, the 30°/60° rhythm, and coexistence of closed and through-strands.
- **Image rights:** source images remain reference-only; the application ships an independent reconstruction and links to the records.

## Construction matrix

| Design | Lattice | Angular family | Primary anchors | Irregular support | Strand topology | Recipe pressure |
|---|---|---:|---|---:|---|---|
| Alaeddin Eight | `p4m`, square | 22.5° | square + octagon; eight-star | low | one through | baseline midpoint/contact-angle construction |
| Darb-i Imam Ten | `cmm`, centered rectangular | 36° | paired corrected ten-stars | local corrections | finite loops + one through | multiple contact groups, corrected points, seam pairing |
| Kharraqan Twelve | `p6m`, oblique | 30° | layered twelve-star | not yet fitted | closed rosettes + one through | oblique lattice and explicit seam continuation |

## Schema gate

Fit Alaeddin Eight and Darb-i Imam Ten through the same periodic-graph contract before freezing the recipe vocabulary. Kharraqan Twelve must preserve its oblique repeat and strand topology; otherwise it has not tested anything the square case did not already prove.
