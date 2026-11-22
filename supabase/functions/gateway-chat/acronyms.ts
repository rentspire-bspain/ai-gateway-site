// acronyms.ts — cycle 2 gap 1. Pure Deno/Web; no imports.
// An unfamiliar ALL-CAPS acronym ("largest SLOHTF loans") is exactly where the model's prior is wrong: it pattern-matches the letters to a
// famous entity (Sound Transit) and answers confidently. The intent analyst must not be allowed to call such a query "simple / no search".
// detectUnknownAcronyms() returns the acronyms that are NOT in the allowlist; the handler forces retrieval, quotes the exact term in the
// search query, and adds a writer rule: never expand an unfamiliar acronym from memory.

const KNOWN = `
CIA FBI NSA DEA ATF DHS TSA ICE CBP FEMA NASA NOAA EPA FDA CDC NIH NIST DOD DOJ DOE DOT DOL HHS HUD VA USDA USPS USGS IRS SEC FTC FCC FDIC FHFA CFPB OCC OSHA EEOC NLRB FAA FERC NRC SBA GSA OMB CBO GAO FRB FOMC BLS BEA OPM SSA CMS ONC ATSDR
NATO OPEC WHO WTO IMF OECD UN UNICEF UNESCO NAFTA USMCA ASEAN BRICS EU UK USA UAE
FICO APR APY HOA NOI DSCR LTV LTC CLTV DTI ARM PMI PITI MLS REIT REITS CRE CMBS RMBS MBS ABS CLO CDO CDS LIBOR SOFR SONIA EURIBOR TIPS TIFIA HELOC FHA LIHTC QAP QCT DDA CDBG HOME RAD NMTC OZ ADU ADUS CC&R CCR CAM NNN NOO TIF TID BID SID PUD PUDS CUP PDF
ROI IRR NPV DCF EBITDA EBIT EPS ARR MRR CAC LTV ARPU CAGR YOY MOM QOQ YTD TTM GAAP IFRS GDP GNP CPI PPI PCE PMI NFP FOMC ETF ETFS IPO SPAC LBO MBO REIT CFO CEO COO CTO CMO CIO CRO CPA CFA CFP LLC LLP LP LTD INC CORP PLLC EIN SSN ITIN TIN W2 NDA MOU LOI PSA RFP RFQ RFI SOW SLA KPI OKR SOP QA QC HR PR IT ESG DEI ERISA FLSA FMLA ADA COBRA HIPAA FERPA GDPR CCPA FCRA ECOA FDCPA RESPA TILA UCC UCCJEA UETA LLCS REITS
AI ML LLM LLMS NLP GPU CPU TPU RAM ROM SSD HDD USB HDMI WIFI LAN WAN VPN DNS DHCP TCP UDP HTTP HTTPS SSL TLS SSH FTP SFTP SMTP IMAP POP SMS MMS URL URI API APIS SDK CLI GUI IDE UI UX CSS HTML XML JSON YAML TOML CSV TSV SQL NOSQL ORM CRUD REST SOAP GRPC GRAPHQL OAUTH SAML SSO MFA JWT CORS CSRF XSS DDOS DOS IOT SAAS PAAS IAAS CDN CMS CRM ERP SEO SEM PPC CPC CPM CTR CTA ASCII UTF UUID GUID MD5 SHA AES RSA PGP TPM BIOS UEFI LINUX UNIX MACOS IOS AWS GCP AZURE CICD DEVOPS NPM PIP JVM JDK JRE WASM DOM AJAX SPA PWA SSR SSG ISR OCR ASR TTS STT RAG LORA GAN CNN RNN LSTM BERT GPT ONNX CUDA OPENGL RGB CMYK HEX DPI PPI FPS GIF JPEG JPG PNG SVG MP3 MP4 MOV AVI
USD EUR GBP JPY CAD AUD CHF CNY INR MXN BTC ETH USDT USDC NFT DEFI DAO
NYC LA SF DC NY NJ PA TX FL CA WA OR NV AZ CO UT NM ID MT WY ND SD NE KS OK MN IA MO AR LA MS AL GA SC NC VA WV MD DE CT RI MA VT NH ME OH MI IN IL WI KY TN HI AK USA
NFL NBA MLB NHL MLS NCAA UFC WWE FIFA UEFA NASCAR PGA LPGA ATP WTA
CNN BBC NBC CBS ABC FOX ESPN NPR PBS MSNBC CNBC WSJ NYT AP
IBM HP AMD NVDA AAPL MSFT GOOG GOOGL AMZN TSLA META NFLX INTC CSCO ORCL SAP BMW GM UPS FEDEX AT&T AOL
MBA MD PHD JD LLM CPA RN LPN EMT ER ICU OR ICU CPR AED HIV AIDS COVID SARS MERS RSV DNA RNA PCR MRI CT EKG ECG EEG BMI BP HDL LDL ADHD OCD PTSD COPD CKD GERD IBS UTI STD STI IVF DUI DWI OWI HOV ETA ASAP FAQ DIY FYI TBD TBA TLDR AKA RSVP PS CC BCC EOD EOW COB OOO WFH PTO PTO RIP LOL IMO IMHO BTW OMG WTF NSFW AMA ELI5 VS ETC EG IE NB
USPTO PCT TM SSL IP DMCA FOIA FISA FCPA RICO ERISA UCC FRCP FRE CFR USC USCA STAT ALJ SCOTUS POTUS FLOTUS DOGE TARP ACA CHIPS NEPA CEQA RCRA CERCLA CWA CAA ESA FIRREA SOX DODD
SALT SALT TCJA OBBBA IRA IRC QBI QOF QOZ AMT EITC CTC FICA FUTA SUTA RMD RMDS IRA ROTH SEP SIMPLE HSA FSA HRA COLA SSI SSDI AGI MAGI ITIN W9 W4 K1 1099 1031 TIC DST
STEM STEAM SAT ACT GRE GMAT LSAT MCAT GPA AP IB IEP ESL TA RA PTA PTO K12
MPH RPM PSI BTU HVAC HVAC GPM CFM KWH MWH KW MW GW TW MPG MPGE EV EVS PHEV BEV ICE SUV RV ATV UTV VIN DMV DOT FMVSS NHTSA
LGBTQ NAACP ACLU NRA AARP AFL CIO SEIU UAW AFLCIO NGO NPO IRS501 EIN
`;

export const KNOWN_ACRONYMS: ReadonlySet<string> = new Set(KNOWN.split(/\s+/).filter(Boolean).map((s) => s.toUpperCase()));

/** Prompt-sized excerpt of the allowlist for the intent analyst (it does not need all of it; the code enforces the full list). */
export const ACRONYM_PROMPT_EXAMPLES = "CIA, NASA, FBI, HUD, IRS, SEC, FICO, APR, HOA, NOI, USDA, GDP, CPI, ETF, LLC, API, SQL, NFL";

const SHOUTING = (s: string): boolean => {
  const letters = s.replace(/[^A-Za-z]/g, "");
  if (letters.length < 12) return false;
  const upper = letters.replace(/[^A-Z]/g, "").length;
  return upper / letters.length > 0.7;
};

/** All-caps 3-8 letter tokens in the query that are not on the allowlist. Returns [] for ALL-CAPS "shouting" queries and
 *  for tokens that only appear inside code fences / URLs / quoted identifiers. Order-preserving, de-duplicated. */
export function detectUnknownAcronyms(query: string): string[] {
  let q = String(query ?? "");
  if (!q || SHOUTING(q)) return [];
  q = q.replace(/```[\s\S]*?```/g, " ").replace(/`[^`\n]*`/g, " ").replace(/https?:\/\/\S+/g, " ").replace(/[\w.+-]+@[\w.-]+/g, " ");
  const out: string[] = [];
  for (const m of q.matchAll(/(?<![A-Za-z0-9_$-])([A-Z]{3,8})(?:'s|s)?(?![A-Za-z0-9_-])/g)) {
    const tok = m[1]; // plural/possessive suffix ("LLCs", "SLOHTF's") is outside the capture group
    if (KNOWN_ACRONYMS.has(tok)) continue;
    if (/^(?:THE|AND|FOR|BUT|NOT|YOU|ALL|ANY|CAN|HER|WAS|ONE|OUR|OUT|HAS|HAD|NOW|NEW|OLD|SEE|WHO|HOW|WHY|WHAT|WHEN|WITH|THIS|THAT|FROM|HAVE|WILL|YOUR|ABOUT|NOTE|TODO|FIXME|WARNING|IMPORTANT|NEVER|ALWAYS|MUST|ONLY|EACH|EVERY|TRUE|FALSE|NULL|NONE|DONE|OPEN|CLOSED|HIGH|LOW|MEDIUM|YES|NO)$/.test(tok)) continue;
    if (!out.includes(tok)) out.push(tok);
  }
  return out;
}

/** Make the search query carry each unknown acronym as an exact quoted term: `largest SLOHTF loans` -> `largest "SLOHTF" loans`. */
export function quoteAcronyms(searchQuery: string, acronyms: string[]): string {
  let q = String(searchQuery ?? "");
  for (const a of acronyms) {
    if (q.includes(`"${a}"`)) continue;
    q = q.replace(new RegExp(`(?<![A-Za-z0-9"])${a}(?![A-Za-z0-9"])`), `"${a}"`);
    if (!q.includes(`"${a}"`)) q = `"${a}" ${q}`;
  }
  return q;
}

/** One-line search-lane hint appended to the retrieval query so the search engine looks the term up rather than expanding it. */
export function acronymSearchHint(acronyms: string[]): string {
  return acronyms.length ? ` (find what ${acronyms.map((a) => `"${a}"`).join(", ")} actually refers to; do not guess the expansion)` : "";
}

export const ACRONYM_WRITER_RULE = "UNFAMILIAR ACRONYMS: never expand or interpret an acronym or initialism from memory unless it is a universally known one (CIA, NASA, IRS, FICO…) or the numbered sources define it. If the sources do not establish what an acronym in the question stands for, say so plainly and ask which entity/program the user means, listing the likeliest candidates the sources do show. Do not substitute a famous look-alike entity (a similar-sounding agency, program or company) for it.";
