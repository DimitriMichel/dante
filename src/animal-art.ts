/** Unmodified historical scans; provenance and rights are in docs/graphics-sources.md. */
export const animalArt = {
  elephant: { label: 'Elephant', file: '/engravings/elephant.jpg', width: 1059, height: 951, year: '1891', source: 'https://commons.wikimedia.org/wiki/File:SFR_b%2Bw_-_elephant.jpg' },
  antelope: { label: 'Antelope', file: '/engravings/antelope.jpg', width: 977, height: 1051, year: '1891', source: 'https://commons.wikimedia.org/wiki/File:SFR_b%2Bw_-_antelope.jpg' },
  crane: { label: 'Demoiselle crane', file: '/engravings/crane.jpg', width: 960, height: 1279, year: '1891', source: 'https://commons.wikimedia.org/wiki/File:SFR_b%2Bw_-_demoiselle_crane.jpg' },
  jackal: { label: 'Jackal', file: '/engravings/jackal.jpg', width: 960, height: 833, year: '1891', source: 'https://commons.wikimedia.org/wiki/File:SFR_b%2Bw_-_young_jackal.jpg' },
  pigeon: { label: 'Nicobar pigeon', file: '/engravings/pigeon.jpg', width: 1280, height: 764, year: '1891', source: 'https://commons.wikimedia.org/wiki/File:SFR_b%2Bw_-_Nicobar_pigeon.jpg' },
  lobster: { label: 'Lobster', file: '/engravings/lobster.jpg', width: 1013, height: 749, year: '1891', source: 'https://commons.wikimedia.org/wiki/File:SFR_b%2Bw_-_lobster.jpg' },
} as const;
export type AnimalKind = keyof typeof animalArt;
export function isAnimal(kind: string): kind is AnimalKind { return Object.hasOwn(animalArt, kind); }
