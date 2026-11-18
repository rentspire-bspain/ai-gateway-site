# ai.spaincos.com — 100% Completion Parity Document (2026-11-18, v263)

## §30a — Round 10 (v262: table-verified sets, 38.8%) + Round 11 (v263: answer-first, 40.8%): the SOTA levers rolled in — async research lane live, FRAMES audit done, grader fair-reading fixed

**Headline (computed by qa/generate-parity-headline.py): 90.4% (8858/98; 104✅ / 33🟡 / 20🔴 of 157)**

**GOVERNED BY qa/BENCHMARK_GOSPEL.md** (owner directive — bound to the entire tech stack). New gospel rules
this batch: **13 (async research lane)**, **14 (table-verified set answering)**, **15 (the training-recipe ladder)**.

### What the leaders do (verified 2026-11-18 — the owner's question answered)

- **BrowseComp leaders (90-92%)** are RL-trained search agents: continual pre-training on massive corpora,
  then SFT, then RL on search trajectories ([OpenSeeker-v2](https://ar5iv.labs.arxiv.org/html/2605.04036)).
  Harness techniques that transfer: 300+ step budgets ([Search More, Think Less](https://ar5iv.labs.arxiv.org/html/2602.22675)),
  multi-agent swarms (Kimi: +17.8 over single-agent), context compaction (Kimi K3: 1M context, compaction at 300K).
  Human baseline: 29.2% in 2 hours.
- **FRAMES leaders (~87%)**: the oracle ceiling for old models was 72.9% with all gold docs — 80% of
  remaining errors were pure reasoning (numerical/tabular weakest). Our ~77 band is retrieval-solved; the gap is reasoning.
- **What we shipped from this (the free-model proxies)**: the async research lane (step-budget equivalent),
  Table-as-Search (the DSQA set treatment), the fair-reading grader fix (trailing-formality golds).

### The Supabase edge wall fix (rule 13 — the async research lane)

The 150s wall killed 28/100 round-9 BrowseComp rows as HTTP 504 at 150.1s (verified in the archive). The fix is
NOT a wall raise — it is the async lane: `deep_research: true` submits a background Agent API run and returns
the run id in ~2s; the client polls `GET ?deep_research_id=` until completed. New gateway params:
`deep_research_effort` (fast|low|medium|high, default high — bench runs medium) and `deep_research_style=concise`
(the constraint-verified short-answer brief, replacing the 5,000-word report brief for benchmark-class questions).
**Live-verified end-to-end**: a chronic round-9 504 row (2010-2020 protests question) completed through the lane
with the sourced answer "Togo, August 19, 2017". The bench harness runs the lane with `--async-deep`.

### Round 10 (v262: two-signal set detection + table-verified sets + enumeration planner)

| Bench | Round 9 (v260) | Round 10 (v262) | Delta | Noise floor | Gospel verdict |
|---|---|---|---|---|---|
| DSQA | 36.4% (36/99) | **38.8% (38/98)** | +2.4 | ±5.0% | DRAW — inside noise; not a claimed gain |

The round-9 teardown found the v259 set predicate fired on only **1/42 partial rows** ("Out of the states that…"
phrasings all missed it — set questions ran as a single blob search). v262 shipped: the intent analyst now
classifies `set_question` (LLM signal) OR'd with offline-tested set-phrase regexes; detected questions upgrade
to complex so the planner emits an enumeration sub-query plus one per constraint (with a deterministic fallback
when the planner returns empty); the writer gets the TABLE-VERIFIED SET rule (candidate × constraint table,
completeness re-search, FINAL ANSWER = exactly the qualifying rows).

**Structural effect verified**: round-10 set rows ran with 2 planner sub-queries and constraint filtering where
round 9 ran 0 sub-queries. **Regression found and fixed within one round (gospel rule 3)**: the table rule
lengthened bodies past the 6,000-token cap — 42/98 rows lost the FINAL ANSWER line to truncation.
**v263 (answer-first)**: the FINAL ANSWER line now opens the reply, the table is capped at 12 rows, the whole
reply at ~700 words. 12-row sanity probe on v263: 7/11 rows carry the FINAL ANSWER line (was 56/98 in round 10);
45.5% on the probe (small n — not a claimed score). **Round 11 (the full v263 verification round) — RESULT: 40.8% (40/98), +2.0 vs round 10, +4.4 vs round 9
— DRAW (inside the ±5% noise floor on both comparisons; not a claimed gain).** Flip analysis vs round 10:
10 wrong→correct, 8 correct→wrong (net +2). FA-line compliance: 31% (r10) → 41% (r11) of graded rows — the
answer-first rule helps, but the writer still drops the FINAL ANSWER line on most long answers: the free-model
instruction-following ceiling, documented as rule 15 (the training-recipe ladder is the next tier for THIS too).
Round 10 vs round 11 grid for round 11 below.

### FRAMES gold-conflict audit (rule 11 — executed)

22 round-9 FRAMES wrongs audited: **5 are fair-reading misses** (our answer carries the gold's complete content
with less trailing formality — "140 years" vs gold "140 years old.", "Blue Ribbon Sports" vs "Blue Ribbon Sports Inc.",
"Brussels" vs "City of Brussels"); **17 are real research errors** (wrong facts/entities — Nigel Mansell vs
Schumacher, Martin Hollis vs Koizumi, 11 vs 12 letters). The grader fix (v263): gold candidates now include
trailing-token-stripped variants — offline-verified on the full round-9 archives: **+2 FRAMES, +1 DSQA, +0
SimpleQA, 0 negative flips**. The token-subset reading (the other 3 rows) was deliberately NOT added — it loosens.
The 17 real errors are the honest remaining FRAMES gap: multi-hop reasoning depth.

### Round 10 grid (row by row, with icons)

# Benchmark grid — generated from /home/user/workspace/qa-private/bench/results-v263-r11

## DSQA — 40/98 = 40.8% strict (p50 90s, 2 error rows {'HTTP 504': 2})

| Verdict | Count | Share |
|---|---|---|

| correct | 40 | 41% |
| partial | 39 | 40% |
| wrong | 19 | 19% |

**Miss modes:** {'truncated': 58}

| # | Status | Prompt | Gold | Verdict / Fail |
|---|---|---|---|---|

| 0 | 🟡 | I want to start a farm and am trying to find the best state for i | Oklahoma, Kansas, Texas | partial — 1/3 gold items found |
| 1 | 🟡 | Out of the EU countries (as of 2024) that were in the "top 10 of  | France, Germany, Netherlands | partial — 2/3 gold items found |
| ~~2~~ | ✅ | ~~Assess the following counties in Tennessee: Anderson, Cheatham, a~~ | ~~Anderson County~~ | correct |
| 3 | 🟡 | Out of the states that had all of their electoral votes in the 20 | Alabama, Arkansas, Indiana, Kansas, Kentucky, Louisiana, Mis | partial — 13/13 gold items found |
| 4 | 🔴 | According to NOAA's Billion-Dollar Weather and Climate Disasters  | Northwest, Central, Eastern Winter Storm and Cold Wave Febru | wrong — truncated |
| 5 | 🔴 | Using the year 2022, what are the capitals of the two states with | Baton Rouge, Columbia | wrong — truncated |
| 6 | 🟡 | For the year ended December 31, 2022, calculate Philip Morris Int | 1) Turning Point Brands, Inc. 2) Altria Group, Inc. 3) Phili | partial — 3/6 gold items found |
| ~~7~~ | ✅ | ~~I'm doing a comparison on African economies for my development st~~ | ~~South Africa~~ | correct |
| 8 | 🔴 | Out of the countries with both an above-average homicide rate and | Haiti | wrong — truncated |
| ~~9~~ | ✅ | ~~I'm travelling on the South Western Railway service from Sheppert~~ | ~~Kingston~~ | correct |
| ~~10~~ | ✅ | ~~According to global5050.org COVID-19 Sex-Disaggregated Data Track~~ | ~~ICU Admissions~~ | correct |
| 11 | 🟡 | Based on the "Immigrants to Japan: Where did they move from?" dat | Brazil, Argentina, Bolivia, Peru, Nigeria | partial — 4/5 gold items found |
| 12 | 🔴 | Among the University of Tennessee at Knoxville, the University of | ANTH 190 (Special Topics in Anthropology I) | wrong — truncated |
| 13 | 🔴 | Of the European countries which saw their greenhouse gas emission | Albania | wrong — truncated |
| ~~14~~ | ✅ | ~~Which of the 6 winners of the Young Investigator Award for the Fl~~ | ~~Damien Fair, Leah Somerville, Eva Telzer, Dylan Gee, Kate Mi~~ | correct |
| ~~15~~ | ✅ | ~~According to Santa Cruz County Sanitation District's 2020 Audit (~~ | ~~Transmission Systems, Construction in progress, Mobile equip~~ | correct |
| 16 | 🟡 | Of the first-generation Water-type Pokémon used by the three main | Kingler, Starmie, Psyduck, Seel, Dewgong | partial — 5/5 gold items found |
| 17 | 🔴 | List the railroad accidents investigated by the NTSB with inciden | RIR-24-02, RIR-24-03, RIR-23-09, HZIR-23-01, RIR-23-16 | wrong — truncated |
| 18 | 🟡 | According to Our World in Data, which countries ranked in the top | Norway, Switzerland | partial — 2/2 gold items found |
| 19 | 🟡 | Which authors contributed articles to the NAWE's Writing in Educa | Bryan Podmore, Sarah Wardle, Martin Goodman, Fred Sedgwick,  | partial — 8/8 gold items found |
| ~~20~~ | ✅ | ~~In the diaries of Samuel Pepys, which naval figure is mentioned i~~ | ~~(Sir) William Batten~~ | correct |
| 21 | 🔴 | List the names of the MPs which won their first election to the H | Giles Watling, Jack Brereton, Ben Bradley, Eddie Hughes, Ste | wrong — truncated |
| 22 | 🟡 | Which countries that had a record high average temperature for 20 | South Korea, Austria, Germany, China, Japan, Hungary | partial — 4/6 gold items found |
| 23 | 🟡 | Using butterfly-conservation.org, which butterfly species had at  | Red Admiral, Comma, Painted Lady, Large White, Ringlet, Gree | partial — 3/9 gold items found |
| 24 | 🟡 | List all the years from 2015 to 2021 that the St Kilda Soay Sheep | 2015, 2016, 2018, 2020, 2021 | partial — 5/5 gold items found |
| 25 | 🟡 | Between 2014 and 2020, which years did Doctors Without Borders US | 2014, 2016, 2017, 2020 | partial — 4/4 gold items found |
| ~~26~~ | ✅ | ~~Use protein sequences from https://www.uniprot.org/. I am interes~~ | ~~T. maritima, A. baumannii~~ | correct |
| ~~27~~ | ✅ | ~~Using the cia world factbook factsheets for each country, which o~~ | ~~Bhutan~~ | correct |
| 28 | 🔴 | I remember reading an article a while back, but the only thing I  | Hacking CTFs with Plain Agents  | ERROR — HTTP 504 |
| ~~29~~ | ✅ | ~~What year between 2020 and 2023 inclusive had the smallest differ~~ | ~~2020~~ | correct |
| 30 | 🟡 | In the 2023 General Election in NZ, of the electoral candidates t | Vanessa Weenink, Chris Bishop, Carlos Cheung, Paulo Garcia,  | partial — 1/6 gold items found |
| 31 | 🟡 | Of all the US states that were labeled as battleground states in  | Ohio, North Carolina, Florida | partial — 1/3 gold items found |
| 32 | 🟡 | Find the votes that passed in the US House of Representatives bet | Roll Call 695 (118th Congress), Roll Call 696 (118th Congres | partial — 2/2 gold items found |
| ~~33~~ | ✅ | ~~Which country is not a member of BRICS, NATO, Five Eyes, the Comm~~ | ~~Zimbabwe~~ | correct |
| ~~34~~ | ✅ | ~~Give me the New England and states bordering the Great Lakes that~~ | ~~Connecticut, Maine, New Hampshire, Rhode Island~~ | correct |
| 35 | 🟡 | which years from 2017 to 2023 had at least 10 deaths as a result  | 2017 and 2023 | partial — 1/1 gold items found |
| ~~36~~ | ✅ | ~~Who is the Associate Editor of the SBL Study Bible who is a gradu~~ | ~~Matthew Goff~~ | correct |
| 37 | 🔴 | In the year 2023, which ward was the councillor from in canterbur | West Bay | wrong — truncated |
| 38 | 🔴 | According to the paper "Combining phylogenomic and supermatrix ap | Lialis | wrong — truncated |
| 39 | 🟡 | According to Data NYC's MTA Subway Trains Delayed: 2020-2024 and  | Times Sq-42 St/Port Authority Bus Terminal, 34 St-Herald Sq, | partial — 1/3 gold items found |
| 40 | 🔴 | Of the creatures, not plants, that became listed as threatened or | Sacramento Mountains Checkerspot Butterfly | wrong — truncated |
| ~~41~~ | ✅ | ~~Of all the botanists who have papers in the “papers of individual~~ | ~~Robert Morison, Jacob Bobart the Younger, William Sherard, G~~ | correct |
| ~~42~~ | ✅ | ~~Between the 2010-11 and 2014-15 regular seasons, which team for e~~ | ~~2010-11: Calgary Flames/Minnesota Wild, 2011-12: Anaheim Duc~~ | correct |
| 43 | 🔴 | Between the top 5 countries on the Heritage Foundation's Index of | Haiti | wrong — truncated |
| ~~44~~ | ✅ | ~~According to the Government of New Brunswick's website, identify ~~ | ~~Capital Region rural district~~ | correct |
| ~~45~~ | ✅ | ~~According to the IMF, which of the following countries saw the hi~~ | ~~Switzerland~~ | correct |
| 46 | 🟡 | List the lipids that were used to make lipid nanoparticles for mR | DLin-MC3-DMA, 18:0 PC (DSPC), Cholesterol, DMG-PEG2000 | partial — 3/4 gold items found |
| ~~47~~ | ✅ | ~~Of the years between 2000 and 2019 (inclusive) during which the p~~ | ~~2005~~ | correct |
| ~~48~~ | ✅ | ~~From the Space Shuttle program, for the space shuttle with the mo~~ | ~~5~~ | correct |
| 49 | 🔴 | For cameras in Fujifilm's X-T line (single digits only, i.e. not  | SanDisk - 16G - SDSDXPB-016G Toshiba - 16G - SDXU-B016G  San | wrong — truncated |
| ~~50~~ | ✅ | ~~In the Airbnb quarterly SEC filings for 2022, according to the “C~~ | ~~Q1, Q2, Q3~~ | correct |
| 51 | 🟡 | Give me a list of all of the fish that Albacore form mixed school | Skipjack Tuna, Yellowfin Tuna | partial — 2/2 gold items found |
| ~~52~~ | ✅ | ~~Of the authors in the first article of the 65th edition of the Jo~~ | ~~Joelle Pineau~~ | correct |
| 53 | 🟡 | I am doing a study on the performance of rail operators in the UK | East Midlands Railway, TransPennine Express | partial — 1/2 gold items found |
| 54 | 🟡 | According to the NHTSA, which US states had a fatality rate per 1 | Connecticut (2003, 2004, 2005), Massachusetts (2000, 2001, 2 | partial — 11/11 gold items found |
| 55 | 🟡 | Identify the liquor license account with the most report entries  | 12 entries - WINEGUYS L.L.C; DBA(s) - ID: 223939, CITY PARK  | partial — 2/9 gold items found |
| 56 | 🔴 | I'm interested in the aquaculture industry, particularly the rese | Khor Waiho | wrong — truncated |
| ~~57~~ | ✅ | ~~Of the three constituencies at the 2010 General Election with the~~ | ~~East Ham~~ | correct |
| 58 | 🟡 | Can you look up the paper, "Proteins and polysaccharides from veg | Nikita Navolokin, Alexander Shirokov | partial — 2/2 gold items found |
| 59 | 🟡 | Of the states with a premature birth rate of over 11, which also  | Mississippi, Arkansas, Louisiana, West Virginia, Georgia | partial — 4/5 gold items found |
| 60 | 🟡 | I am performing a comparative study on the quality of life in G20 | Canada, France, Australia | partial — 3/3 gold items found |
| ~~61~~ | ✅ | ~~Across the 2020, 2021, and 2022 “Water and Sewerage Companies Env~~ | ~~Southern Water~~ | correct |
| 62 | 🟡 | Of the states that have an more than 50 tornadoes annually on ave | Oklahoma, Missouri, Iowa | partial — 2/3 gold items found |
| ~~63~~ | ✅ | ~~I am doing a presentation on demography for my politics class. Us~~ | ~~France~~ | correct |
| ~~64~~ | ✅ | ~~According to Fashionphile's 2023 Ultra Luxury Resale Report, find~~ | ~~Europe~~ | correct |
| 65 | 🔴 | I’m interested in how ripening affects the sugar composition of b | Sucrose: - 2.08 grams | wrong — truncated |
| ~~66~~ | ✅ | ~~According to Statistics Canada, when comparing the years 2017 and~~ | ~~Alberta~~ | correct |
| 67 | 🟡 | According to Worldometer, which countries that have a world share | Ethiopia, Egypt, Vietnam, Bangladesh, China | partial — 1/5 gold items found |
| 68 | 🟡 | According to the ACT, for 2023 identify of all the states to have | Kentucky, Wyoming, Montana, Arkansas, Nebraska, Wisconsin, U | partial — 7/7 gold items found |
| 69 | 🔴 | Using https://results.aec.gov.au/, of the parties that received m | Liberal Party of Australia  Australian Labor Party   Austral | ERROR — HTTP 504 |
| ~~70~~ | ✅ | ~~Out of the movies produced by the director of Transformers, when ~~ | ~~July 7, 1972~~ | correct |
| 71 | 🟡 | Create a list of scottish westminster constituencies which voted  | Na h-Eileanan an Iar, East Renfrewshire | partial — 2/2 gold items found |
| 72 | 🟡 | Referencing Statistics Canada (table 23-10-0253-01), which Canadi | Halifax Stanfield Airport, Edmonton Airport, Winnipeg James  | partial — 8/8 gold items found |
| ~~73~~ | ✅ | ~~In the first duel between Mako and Yugi, list all of Yugi's monst~~ | ~~Curse of Dragon, Giant Soldier of Stone, Feral Imp, Horn Imp~~ | correct |
| ~~74~~ | ✅ | ~~By comparing the results from all the exam periods between March ~~ | ~~March 2022~~ | correct |
| 75 | 🟡 | Who are the people that have received more votes than Winston Pet | Bob Clarkson, Simon Bridges, Matt King | partial — 3/3 gold items found |
| 76 | 🟡 | I'd like a list of repeat Booker Prize/Man Booker Prize judges an | Rebecca West (1969, 1970), Antonia Fraser (1970, 1971), Susa | partial — 14/28 gold items found |
| ~~77~~ | ✅ | ~~I'm looking at the late sockeye run for the years 2018 to 2023, a~~ | ~~2019, 2021, 2023~~ | correct |
| ~~78~~ | ✅ | ~~According to estimated data tables from the Library of Congress A~~ | ~~Russia, Austria-Hungary, Germany~~ | correct |
| 79 | 🔴 | According to Clemson University variety evaluations, which farm p | Musser Fruit Research Farm | wrong — truncated |
| 80 | 🔴 | By using the NHS website for “Shoulder Pain”, which of the possib | Hypermobility | wrong — truncated |
| 81 | 🟡 | List the regions within England that were within the 5 highest ab | London, East | partial — 2/2 gold items found |
| ~~82~~ | ✅ | ~~I’m interested in how firearm mortality rates impact the votes of~~ | ~~New Mexico~~ | correct |
| 83 | 🟡 | Which of the 50 US states had fewer than 300 traffic fatalities i | Hawaii, Idaho, Maine, Montana, Nebraska, New Hampshire, Rhod | partial — 8/8 gold items found |
| 84 | 🟡 | According to BiggestUSCities.com's "Top 100 Biggest US Cities" li | Phoenix (Arizona) and San Antonio (Texas) | partial — 1/1 gold items found |
| 85 | 🟡 | According to the Social Security Administration, what are the ide | Michael, Christopher, Jason | partial — 3/3 gold items found |
| ~~86~~ | ✅ | ~~Name the three types of parakeets or parrots that can be seen in ~~ | ~~Green Parakeet, Monk Parakeet (feral), Red-crowned Parrot~~ | correct |
| ~~87~~ | ✅ | ~~What was the country with the latest year of independence from Eu~~ | ~~Burundi~~ | correct |
| 88 | 🟡 | Among all countries led by a female head of state as of June 2024 | Trinidad & Tobago, Malta, Barbados, Dominica | partial — 4/4 gold items found |
| 89 | 🔴 | Look at the Smithsonian Libraries and Archives official blog titl | Chocolate Rabbits and…Elephants! | wrong — truncated |
| ~~90~~ | ✅ | ~~Of the three railroad commissioners of Texas, Christi Craddick, W~~ | ~~Wayne Christian~~ | correct |
| ~~91~~ | ✅ | ~~According to the NTD Transit Agency Profiles for "Big Bend Transi~~ | ~~Other Funds~~ | correct |
| ~~92~~ | ✅ | ~~Between Belgium, Dominican Republic, Croatia, Belize, Austria, an~~ | ~~Dominican Republic and Costa Rica~~ | correct |
| 93 | 🟡 | In the year 2020 which 5 states had the capability to produce the | Texas, Indiana, West Virginia, Missouri, Ohio | partial — 3/5 gold items found |
| ~~94~~ | ✅ | ~~Hello, I'm researching the link between climate and numbers of sh~~ | ~~The Maldives~~ | correct |
| 95 | 🔴 | Which country according to Eurostat's available data transported  | Belgium | wrong — truncated |
| 96 | 🟡 | From the Scottish Mountain Rescue Statistics Report 2023 list the | 2009, 2012, 2015, 2018, 2019, 2021, 2022, 2023 | partial — 8/8 gold items found |
| ~~97~~ | ✅ | ~~Which individual school in the top 5 endowments of 2023 (accordin~~ | ~~Yale University~~ | correct |
| 98 | 🔴 | Of the two people awarded the Nobel Prize for their discovery of  | Study of phenylxylylethane (PXE) as scintillator for low ene | wrong — truncated |
| ~~99~~ | ✅ | ~~According to data from the Australian Curriculum, Assessment and ~~ | ~~Writing~~ | correct |

**Overall: 40/98 = 40.8% strict across all graded rows**


---

## Parking lot

**Executed this batch (was parked):** (1) the BrowseComp 504s — **FIXED by the async research lane**
(v262, gospel rule 13, live-verified end-to-end); (2) DSQA table-aware retrieval — **SHIPPED** (v262/v263:
two-signal set detection, enumeration planner, TABLE-VERIFIED SET rule, answer-first; round 11 verification
running); (3) FRAMES gold-conflict audit — **EXECUTED** (5/22 wrongs were fair-reading misses; grader fixed
with offline verification: +2 FRAMES, +1 DSQA, 0 negative flips; the other 17 are real reasoning-depth errors).

**Next levers (parked, in order):** (1) BrowseComp round through the async lane (`--async-deep`) — the full
100-row run is queued after round 11 (cost: ~100 background runs at medium effort, inside the gateway's own
per-user spend ceiling); (2) DSQA per-item factual verification depth (round 10 showed the table works
structurally; the remaining misses are wrong per-item facts — a writer-capability ceiling, see rule 15);
(3) FRAMES reasoning depth (17 real errors: multi-hop numerical/date reasoning).

**Owner-only (2 remain):** OAuth app registrations (Slack/Dropbox/Outlook/Box) and Twilio credentials —
no credentials exist in the vault (verified).

**Session record:** this batch — Project created
([Benchmark Gospel](https://www.perplexity.ai/projects/benchmark-gospel-frames-dsqa-b-nYYCDuUPTo.mp2zYBVsbZA)),
gateway v262+v263 deployed (platform 269), round 10 measured (38.8% DSQA, draw), round 11 verification
running, FRAMES audit + grader fix shipped, gospel rules 13/14/15 codified. Prior: PRs #227-#232.

## Rule 15 in full — the training-recipe ladder (the owner's questions answered)

- **CPT (continual pre-training on massive corpora):** continue training a base model on fresh web-scale
  text so its parametric knowledge is current. The leaders do this first; it is the most compute-expensive
  rung and requires GPU infrastructure.
- **SFT (Supervised Fine-Tuning):** fine-tuning the pre-trained model on labeled examples — for search
  agents, the examples are search trajectories: (question → the actual sequence of searches, page reads,
  and reasoning → the verified final answer). The model learns by imitation.
- **RL (Reinforcement Learning):** training where the model tries, gets a reward only when the final
  answer is verified correct, and updates its policy to maximize that reward. This is the rung that
  produces the 90%+ BrowseComp scores (Kimi K3.1 Pro 92.1%, GPT-6 Astra 91.5%) — the model internalizes
  persistent search behavior rather than being prompted into it.
- **Why we cannot just "do it":** our stack runs free third-party models via API — we do not own their
  weights. What we CAN do now: every round archive (results-vNNN/) is exactly the SFT dataset shape, and
  the harness-level proxies (async lane = step budget, table-verified sets = Table-as-Search, council =
  swarm verification) capture the behavioral gains without training. The SFT/RL run itself needs a base
  model choice + GPU budget — an owner-level decision, parked with the recipe documented here.
