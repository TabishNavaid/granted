/**
 * Foundation names as a person would write them. The IRS lists many trusts
 * surname first with trust-instrument codes, account numbers, and the bank
 * trustee attached ("Black Ann D Charitable Ochr", "Elsie N Hill Trust UW
 * 2-27-87", "John Hauck Foundation Fifth Third Bank NA"). The filed name is
 * kept on the record for the IRS lookup; this is only what we display.
 */

/** Names the rules below cannot recover, as the organization writes them. */
const FIXES: Record<string, string> = {
  "Rhi Legacy Foundation Inc.": "RHI Legacy Foundation Inc.",
  "The Joseph D Obrien III Memorial Foundation": "The Joseph D O'Brien III Memorial Foundation",
};

const BANK = /\s+(?:Fifth Third Bank|PNC Bank|U\.?S\.? Bank|Huntington National Bank|KeyBank|Key Bank|Wells Fargo Bank|Truist Bank|JPMorgan Chase Bank|Bank of America)(?:\s+N\.?A\.?)?(?:\s+(?:Trustee|Ttee))?$/i;
// Trust-instrument codes the IRS appends: under will, under agreement, trust under will, trust agreement, and bank trust codes.
const INSTRUMENT = /\s+(?:-\s+)?(?:UW|U\/W|UA|U\/A|TW|Ta|Tr|Ttee|Ochr)(?:\s+[\d/-]+)?$/;
const KIND = /\b(?:Foundation|Trust|Fund|Endowment|Society|Association|Corporation|Inc\.?)$/;

export function displayName(filed: string): string {
  let s = filed.replace(/\s+/g, " ").trim();
  if (FIXES[s]) return FIXES[s];
  s = s.replace(/\s+#?\d*\s*X{3}-X{2}-X{4}$/, "").replace(/\s+[A-Z]\d{5,}$/, "");
  s = s.replace(/\s+Aka\s+.*$/i, "").replace(/\s+C\/O\s+.*$/i, "");
  s = s.replace(BANK, "");
  s = s.replace(/^UA\s+/, "");
  let trust = false;
  for (let i = 0; i < 2 && INSTRUMENT.test(s); i++) {
    s = s.replace(INSTRUMENT, "");
    trust = true;
  }
  // PFDN: private foundation.
  const pf = /\sPFDN\b/i.test(s);
  s = s.replace(/\s+PFDN$/i, "").replace(/\s+PFDN\s+/i, ", ");
  s = s.replace(/\bFND\b|\bFdn\b/g, "Foundation").replace(/\s+-\s+(II|III|IV)$/, " $1");
  // "Black Ann D Charitable" is "Ann D Black Charitable".
  s = s.replace(/^([A-Z][a-z]+) ((?:[A-Z][a-z]+ )+)([A-Z])(?= (?:Charitable|Memorial|Family|Foundation|Trust|Fund)\b|$)/, "$2$3 $1");
  if (!KIND.test(s) && (trust || pf)) s += trust ? " Trust" : " Foundation";
  s = s.replace(/ (for|of|to|in) A (?=[A-Z][a-z]{2,})/g, " $1 a ");
  s = s.replace(/ Inc$/, " Inc.");
  return s;
}
