import '@fontsource/eb-garamond/latin-400.css';
import '@fontsource/eb-garamond/latin-400-italic.css';
import '@fontsource/eb-garamond/latin-700.css';
import '@fontsource/eb-garamond/latin-700-italic.css';
import '@fontsource/libre-baskerville/latin-400.css';
import '@fontsource/libre-baskerville/latin-400-italic.css';
import '@fontsource/libre-baskerville/latin-700.css';
import '@fontsource/libre-baskerville/latin-700-italic.css';
import '@fontsource/playfair-display/latin-400.css';
import '@fontsource/playfair-display/latin-400-italic.css';
import '@fontsource/playfair-display/latin-700.css';
import '@fontsource/playfair-display/latin-700-italic.css';
import '@fontsource/bodoni-moda/latin-400.css';
import '@fontsource/bodoni-moda/latin-400-italic.css';
import '@fontsource/bodoni-moda/latin-700.css';
import '@fontsource/bodoni-moda/latin-700-italic.css';
import '@fontsource/cormorant-garamond/latin-400.css';
import '@fontsource/cormorant-garamond/latin-400-italic.css';
import '@fontsource/cormorant-garamond/latin-700.css';
import '@fontsource/cormorant-garamond/latin-700-italic.css';
import '@fontsource/crimson-pro/latin-400.css';
import '@fontsource/crimson-pro/latin-400-italic.css';
import '@fontsource/crimson-pro/latin-700.css';
import '@fontsource/crimson-pro/latin-700-italic.css';
import '@fontsource/lora/latin-400.css';
import '@fontsource/lora/latin-400-italic.css';
import '@fontsource/lora/latin-700.css';
import '@fontsource/lora/latin-700-italic.css';

export const fontOptions = {
  garamond: { label: 'EB Garamond', family: '"EB Garamond", Georgia, serif', folder: 'eb-garamond' },
  baskerville: { label: 'Libre Baskerville', family: '"Libre Baskerville", Georgia, serif', folder: 'libre-baskerville' },
  playfair: { label: 'Playfair Display', family: '"Playfair Display", Georgia, serif', folder: 'playfair-display' },
  bodoni: { label: 'Bodoni Moda', family: '"Bodoni Moda", Georgia, serif', folder: 'bodoni-moda' },
  cormorant: { label: 'Cormorant Garamond', family: '"Cormorant Garamond", Georgia, serif', folder: 'cormorant-garamond' },
  crimson: { label: 'Crimson Pro', family: '"Crimson Pro", Georgia, serif', folder: 'crimson-pro' },
  lora: { label: 'Lora', family: '"Lora", Georgia, serif', folder: 'lora' },
  georgia: { label: 'Georgia', family: 'Georgia, serif', folder: undefined },
};
export type FontKey = keyof typeof fontOptions;
