import {
  RegExpMatcher,
  TextCensor,
  asteriskCensorStrategy,
  englishDataset,
  englishRecommendedTransformers,
} from 'obscenity';

let matcher: RegExpMatcher | undefined;
function getMatcher(): RegExpMatcher {
  matcher ??= new RegExpMatcher({ ...englishDataset.build(), ...englishRecommendedTransformers });
  return matcher;
}

export function hasProfanity(text: string): boolean {
  return getMatcher().hasMatch(text);
}

const censor = new TextCensor().setStrategy(asteriskCensorStrategy());

/** Replaces rude words with asterisks, e.g. for chat. */
export function censorText(text: string): string {
  return censor.applyTo(text, getMatcher().getAllMatches(text));
}
