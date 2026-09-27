/** Unmodified historical scans; provenance and rights are in docs/graphics-sources.md. */
export const animalArt = {
  elephant: { label: 'Elephant', file: '/engravings/elephant.jpg', width: 1059, height: 951, year: '1891', source: 'https://commons.wikimedia.org/wiki/File:SFR_b%2Bw_-_elephant.jpg' },
  antelope: { label: 'Antelope', file: '/engravings/antelope.jpg', width: 977, height: 1051, year: '1891', source: 'https://commons.wikimedia.org/wiki/File:SFR_b%2Bw_-_antelope.jpg' },
  crane: { label: 'Demoiselle crane', file: '/engravings/crane.jpg', width: 960, height: 1279, year: '1891', source: 'https://commons.wikimedia.org/wiki/File:SFR_b%2Bw_-_demoiselle_crane.jpg' },
  jackal: { label: 'Jackal', file: '/engravings/jackal.jpg', width: 960, height: 833, year: '1891', source: 'https://commons.wikimedia.org/wiki/File:SFR_b%2Bw_-_young_jackal.jpg' },
  pigeon: { label: 'Nicobar pigeon', file: '/engravings/pigeon.jpg', width: 1280, height: 764, year: '1891', source: 'https://commons.wikimedia.org/wiki/File:SFR_b%2Bw_-_Nicobar_pigeon.jpg' },
  lobster: { label: 'Lobster', file: '/engravings/lobster.jpg', width: 1013, height: 749, year: '1891', source: 'https://commons.wikimedia.org/wiki/File:SFR_b%2Bw_-_lobster.jpg' },
  'green-turtle': { label: 'Green turtle', file: '/engravings/green-turtle.jpg', width: 1993, height: 1228, year: '1891', source: 'https://commons.wikimedia.org/wiki/File:SFR_b%2Bw_-_green_turtle.jpg' },
  herring: { label: 'Herring pair', file: '/engravings/herring.jpg', width: 1942, height: 1552, year: '1891', source: 'https://commons.wikimedia.org/wiki/File:SFR_b%2Bw_-_herring.jpg' },
  'secretary-bird': { label: 'Secretary bird', file: '/engravings/secretary-bird.jpg', width: 960, height: 1051, year: '1891', source: 'https://commons.wikimedia.org/wiki/File:SFR_b%2Bw_-_secretary_bird.jpg' },
  lions: { label: 'Lion family', file: '/engravings/lions.jpg', width: 960, height: 877, year: '1891', source: 'https://commons.wikimedia.org/wiki/File:SFR_b%2Bw_-_lions.jpg' },
  walrus: { label: 'Walrus', file: '/engravings/walrus.jpg', width: 960, height: 859, year: '1891', source: 'https://commons.wikimedia.org/wiki/File:SFR_b%2Bw_-_walrus.jpg' },
  'wild-boar': { label: 'Wild boar', file: '/engravings/wild-boar.jpg', width: 732, height: 643, year: '1891', source: 'https://commons.wikimedia.org/wiki/File:SFR_b%2Bw_-_wild_boar.jpg' },
} as const;
export type AnimalKind = keyof typeof animalArt;
export function isAnimal(kind: string): kind is AnimalKind { return Object.hasOwn(animalArt, kind); }
