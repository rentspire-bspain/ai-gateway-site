# ai.spaincos.com — 100% Completion Parity Document (2026-11-17, v258)

## §29cx — Round 6 (clean v257 re-run) + the benchmark gospel codified platform-wide

**Headline (computed by qa/generate-parity-headline.py): 90.4% (8858/98; 104✅ / 33🟡 / 20🔴 of 157)**

**GOVERNED BY qa/BENCHMARK_GOSPEL.md (owner directive 2026-11-17) — the standing performance law,
now bound to the entire tech stack:** the gospel doc in master (PR #218), the mechanical enforcer
qa/gospel-check.py (pre-gate + round comparison with noise floors), the harness docstring, the
pre-launch harness gate that blocks every push/deploy if the gospel is missing or altered (PR #219),
and a BINDING system rule injected into EVERY gateway session (ai.spaincos.com, BoundView.com,
every webapp, every tool and skill) so any performance question gets the law cited back.

### Round 6 (clean v257 measurement — no gateway change since round 5)

| Bench | Round 5 | Round 6 | Delta | Noise floor | Gospel verdict |
|---|---|---|---|---|---|
| SimpleQA | 98.0% | 96.5% (191/198) | -1.5 | ±2.0% | DRAW (inside noise) |
| FRAMES | 74.0% | **80.8% (80/99)** | **+6.8** | ±4.3% | **GAIN — beyond noise; round 7 must confirm (rule 2)** |
| DSQA | 36.7% | 41.0% (41/100) | +4.3 | ±5.0% | DRAW (inside noise) |
| BrowseComp | 28.6% | 34.1% (29/85) | +5.5 | ±4.7% | GAIN-borderline; 15 HTTP-504 error rows auto-retry next round |

Round 6 ran with the same gateway as round 5 (v257, platform 260) and the same grader — the deltas
are pure run variance plus the 546/504 error rows (15 BrowseComp 504s, 3 total 546s). The FRAMES
gain is the only beyond-noise movement: per the gospel it is a GAIN-PENDING-CONFIRMATION — round 7
(which measures v258) doubles as its confirmation run.

### What was done to pursue the gains (the explanation the owner asked for)

1. **FRAMES +6.8 (74.0 -> 80.8)** — no code change; 11 wrong->correct flips vs 5 correct->wrong.
   The flips: the Pedro Ramírez row (Argentinian president resignation — a consistent 3-round miss
   now correct), the Henry O. Fairbanks / Thomas P. Koch row (previously bound to the wrong mayors),
   the "Breast and skin" pretexting row, two numeric rows (60, 12), the Duane Allman row, and the
   Last of Us Part II row — all research-depth/reasoning variance in the free-lane writer. The
   down-flips: 1 transient HTTP-546, 3 truncations (auto-retry next round), 1 hallucinated middle
   name ("Martin Bannister Sartre" vs gold "Martin Gilbert Sartre"). Full flip table below.
2. **DSQA +4.3 (36.7 -> 41.0)** — inside noise; the set-coverage lever (v257's top-3 sub-queries)
   shows no reproducible yield beyond the v253 set-aggregation baseline (~39-43 band).
3. **BrowseComp +5.5** — the 15 HTTP-504 error rows depress this round's n; 29/85 correct vs
   26/91. Within the band's variance; v258's council + constraint verification are the levers
   built to move it (round 7 measures).
4. **SimpleQA -1.5** — inside noise; 2 HTTP-546 error rows.

### v258 — constraint-verified answering + reliability council (deployed AFTER round 6; round 7 measures)

- **Constraint-verified answering**: a binding writer rule for multi-constraint identification
  questions — extract EVERY constraint, check EACH against the named entity, answer only the entity
  satisfying ALL (never the most). Root cause: the writer answered Kurt Russell where the
  constraint set's unique match is Rishi Kapoor — binding the entity matching most-but-not-all
  constraints.
- **Reliability council**: the multi-model council now auto-runs on these questions (previously
  only "extreme" complexity, which no benchmark question reaches). Independent drafts + synthesis
  vote on the binding — directly targeting the round-to-round variance (BrowseComp 25.8/35.6/27.7/
  28.6/34.1 across five rounds).
- **Coverage tested offline**: ~155/171 BrowseComp, 36/824 FRAMES, 9/575 DSQA, 0/435 SimpleQA
  (no false fires). Env AUTO_COUNCIL_MCI=0 opts the council out.
- **Platform-wide gospel injection + pre-launch gate** ride the same deploy (PR #219).

### Round 6 vs Round 5 FRAMES — full row-by-row flip analysis

**FRAMES: 11 wrong→correct, 5 correct→wrong (net +6).**

| Flip | Prompt | Gold | Round 6 answer |
|---|---|---|---|
| ⬆️ wrong→correct | As of August 3rd 2024, how many countries are full members of the | 12 | (truncated — no FINAL ANSWER line) |
| ⬆️ wrong→correct | How many years apart did a Kim Jong Un impersonator who was inter | 60 | (truncated — no FINAL ANSWER line) |
| ⬆️ wrong→correct | If an Ixodes scapularis tick in its nymph stage feeds on a host i | Two seasons. | Two seasons later.  ### SUB-RESEARCH 1: Ixodes scapularis nymph spring adult same year lifecycle Yes. In the typical nor |
| ⬇️ correct→wrong | If the author of the philosophical magnum opus Being and Time wer | Martin Gilbert Sartre | Martin Bannister Sartre  ## Suggested Follow-ups  - Verify which other philosophers declined Nobel Prizes before Sartre' |
| ⬆️ wrong→correct | In the same year that HMS Holland 1 was launched, a British monar | 6 years, 11 months, 25 days. | About 6 years and 11 months  ## Suggested Follow-ups  - Find the launch year of HMS Holland 1 and the British monarch wh |
| ⬆️ wrong→correct | Mass Effect 2 once won the D.I.C.E. Award for Game of the Year. W | Martin Hollis | (truncated — no FINAL ANSWER line) |
| ⬇️ correct→wrong | Of the four main characters on Seinfeld, which actor is the oldes | Michael Richards | (truncated — no FINAL ANSWER line) |
| ⬆️ wrong→correct | On the same day Roald Dahl first published a work, a famous guita | Duane Allman | Duane Allman  ## Suggested Follow-ups  - Compare Duane Allman's 2003 No. 2 ranking with his 2011 list position - List th |
| ⬆️ wrong→correct | The author of the book "A Good Woman"'s author was married to a m | Breast and skin | Breast and skin cancer (melanoma)  ## Suggested Follow-ups  - Trace the 2006 HP pretexting scandal timeline from Dunn's  |
| ⬇️ correct→wrong | The female of the pair who have been called "the worst guests in  | Jake Pavelka | (truncated — no FINAL ANSWER line) |
| ⬆️ wrong→correct | The latest game, as of August 4, 2024, from the creator of Kirby  | The Last of Us Part II | The Last of Us Part II.  ## Suggested Follow-ups  - List all 2020 Game Awards categories The Last of Us Part II won, wit |
| ⬇️ correct→wrong | What William Wyler movie debuted the same year that the chairman  | Jezebel | (truncated — no FINAL ANSWER line) |
| ⬇️ correct→wrong | What band had a male lead singer born on the day Mohammad Mosadde | Kool & the Gang | (truncated — no FINAL ANSWER line) |
| ⬆️ wrong→correct | What is the middle name of the U.S. president who died on the sam | David | (truncated — no FINAL ANSWER line) |
| ⬆️ wrong→correct | Who was the Argentinian president who resigned from the position  | Pedro Ramírez | (truncated — no FINAL ANSWER line) |
| ⬆️ wrong→correct | Who was the Mayor of Quincy, Massachusetts when the Quincy Medica | Henry O. Fairbanks and Thomas P. Koch | Henry O. Fairbanks (mayor when Quincy Medical Center opened in 1890) and Thomas P. Koch (mayor when it closed in 2014)   |

### The round 6 grid (row by row, with icons)

**Legend: ✅ correct (struck through — done), 🟡 partial (some gold items found), 🔴 wrong or error.** Verdicts are exact (graded on full text at write time); miss labels are approximate post-run (stored content is capped at 3,000 chars).

# Benchmark grid — generated from /home/user/workspace/qa-private/bench/results

## SIMPLEQA — 191/198 = 96.5% strict (p50 34s, 2 error rows {'HTTP 546': 2})

| Verdict | Count | Share |
|---|---|---|

| correct | 191 | 96% |
| wrong | 7 | 4% |

**Miss modes:** {'truncated': 7}

| # | Status | Prompt | Gold | Verdict / Fail |
|---|---|---|---|---|

| ~~0~~ | ✅ | ~~What were the day, month, and year of release for Aseprite v1.3?~~ | ~~27 Nov 2023~~ | correct |
| ~~1~~ | ✅ | ~~The 1972 Canadian federal budget was first presented on what day,~~ | ~~8 May 1972~~ | correct |
| ~~2~~ | ✅ | ~~What year was the municipality of Ciudad Bolívar, Antioquia, Colo~~ | ~~1839~~ | correct |
| ~~3~~ | ✅ | ~~In Season 16 of The Bachelor, which contestant quit?~~ | ~~Brittney Schreiner~~ | correct |
| ~~4~~ | ✅ | ~~What was the original name of the village of Berrien Springs, Mic~~ | ~~Wolf's Prairie~~ | correct |
| ~~5~~ | ✅ | ~~In which year was the municipality of Macanal, Boyacá, Colombia, ~~ | ~~1807~~ | correct |
| ~~6~~ | ✅ | ~~In which year was Alexandra Park declared a local nature reserve?~~ | ~~2013~~ | correct |
| ~~7~~ | ✅ | ~~In the 2021 research paper titled "EEG-Based Driving Fatigue Dete~~ | ~~92.71%~~ | correct |
| ~~8~~ | ✅ | ~~What year was Türksat 2A decommissioned?~~ | ~~2016~~ | correct |
| ~~9~~ | ✅ | ~~What is the surname of the individual who won the Faraday Lecture~~ | ~~Hinshelwood~~ | correct |
| ~~10~~ | ✅ | ~~What was the name of the new curriculum model that Randolph Colle~~ | ~~TAKE2~~ | correct |
| ~~11~~ | ✅ | ~~In what year was Alma S. Woolley awarded a doctorate in Nursing E~~ | ~~1980~~ | correct |
| ~~12~~ | ✅ | ~~What month, date, and year did Tupac appear in A Different World?~~ | ~~June 24, 1993~~ | correct |
| ~~13~~ | ✅ | ~~How many men competed in fencing during the 1964 Summer Olympics?~~ | ~~203~~ | correct |
| ~~14~~ | ✅ | ~~What was Beloit College's Center for the Sciences renamed in 2017~~ | ~~Marjorie and James Sanger Center for the Sciences.~~ | correct |
| ~~15~~ | ✅ | ~~How many referees were selected from the South American Football ~~ | ~~6~~ | correct |
| ~~16~~ | ✅ | ~~What year did Chiharu Shiota introduce "Dialogue with Absence"?~~ | ~~2010~~ | correct |
| ~~17~~ | ✅ | ~~In what city did Ciara perform for her Beauty Marks Tour on Septe~~ | ~~Puyallup~~ | correct |
| ~~18~~ | ✅ | ~~What was the first year Whig politician James Vernon the Younger ~~ | ~~1702~~ | correct |
| ~~19~~ | ✅ | ~~As of the 2020 census, what was the population of the city of For~~ | ~~10,423~~ | correct |
| ~~20~~ | ✅ | ~~What were the month and year when Telegram reached 180 million mo~~ | ~~December 2017~~ | correct |
| ~~21~~ | ✅ | ~~What is the first vampire number in recreational mathematics obta~~ | ~~102510~~ | correct |
| ~~22~~ | ✅ | ~~What is the fifth track on Alec Benjamin's album, "(Un)Commentary~~ | ~~speakers ~~ | correct |
| ~~23~~ | ✅ | ~~Which year was György Lukács appointed as the Hungarian Minister ~~ | ~~1919~~ | correct |
| ~~24~~ | ✅ | ~~Which day, month, and year was the second episode of Season 2 of ~~ | ~~April 15, 2020~~ | correct |
| ~~25~~ | ✅ | ~~What is the surname of the U.S. President who attended the 66th b~~ | ~~Eisenhower~~ | correct |
| ~~26~~ | ✅ | ~~Which angel is portrayed in Leonardo da Vinci's "Virgin of the Ro~~ | ~~The angel Uriel.~~ | correct |
| ~~27~~ | ✅ | ~~On which month and year did the Colombian Cardinal Pedro Rubiano ~~ | ~~January 2008~~ | correct |
| ~~28~~ | ✅ | ~~In what year did the Japanese mathematician Kiyosi Ito receive th~~ | ~~1985~~ | correct |
| ~~29~~ | ✅ | ~~In what year was the praying mantis species Eremiaphila cyclopter~~ | ~~1939~~ | correct |
| ~~30~~ | ✅ | ~~What was the date, month, and year when France proposed that the ~~ | ~~January 14, 1991~~ | correct |
| ~~31~~ | ✅ | ~~Who won the Paris Kanellakis Theory and Practice Award in 2000?~~ | ~~Narendra Karmarkar~~ | correct |
| ~~32~~ | ✅ | ~~How many corners did Barcelona take in the Champions League semi-~~ | ~~3~~ | correct |
| ~~33~~ | ✅ | ~~In what year was the mathematician George Andrews elected a Fello~~ | ~~1997~~ | correct |
| ~~34~~ | ✅ | ~~What day, month, and year did William II of Holland become King o~~ | ~~3 October 1247~~ | correct |
| ~~35~~ | ✅ | ~~What day, month, and year was Georgi Ivanov Peev, the Bulgarian f~~ | ~~11 March 1979~~ | correct |
| ~~36~~ | ✅ | ~~What were Terry Kath's famously ironic last words?~~ | ~~What do you think I'm gonna do? Blow my brains out?~~ | correct |
| ~~37~~ | ✅ | ~~At which art school was Will Hicok Low an instructor in 1890?~~ | ~~National Academy of Design~~ | correct |
| ~~38~~ | ✅ | ~~In a 1988 paper, which author defined Mammalia phylogenetically a~~ | ~~Timothy Rowe~~ | correct |
| ~~39~~ | ✅ | ~~What was the name of the Detroit-born medium to whom William Lyon~~ | ~~Etta Wriedt~~ | correct |
| ~~40~~ | ✅ | ~~What was the nationality of the scientists who used lasers to mea~~ | ~~Belgian~~ | correct |
| ~~41~~ | ✅ | ~~What were the day, month, and year when Google introduced the nat~~ | ~~2 of January of 2019~~ | correct |
| ~~42~~ | ✅ | ~~What is the surname of the individual who won the Linus Pauling A~~ | ~~Eyring~~ | correct |
| ~~43~~ | ✅ | ~~In TWD Season 11, Episode 10, we learn that Connie got whose uncl~~ | ~~Pamela Milton's uncle~~ | correct |
| ~~44~~ | ✅ | ~~On what day, month, and year was Juan Nogueira, Brazilian amateur~~ | ~~1 May 1988~~ | correct |
| ~~45~~ | ✅ | ~~Between what years did Getachew Reda complete a Master of Law at ~~ | ~~2001 and 2002~~ | correct |
| ~~46~~ | ✅ | ~~From which year to which year did the Albanian politician Ibrahim~~ | ~~From 1976 to 1977~~ | correct |
| ~~47~~ | ✅ | ~~On which game version was The International 2014 of Dota 2 played~~ | ~~6.81b~~ | correct |
| ~~48~~ | ✅ | ~~In 2014, who took over development of the Brooding language for t~~ | ~~BenJamin P. Johnson~~ | correct |
| ~~49~~ | ✅ | ~~How many stitches did John Lennon get as a result of his Aston Ma~~ | ~~17~~ | correct |
| ~~50~~ | ✅ | ~~What TV show did Kim Fields announce that she was expecting her s~~ | ~~The Real~~ | correct |
| ~~51~~ | ✅ | ~~In what year did Nikolai Andreev win the Leelavati Award?~~ | ~~2022~~ | correct |
| 52 | 🔴 | What is the Swedish word for the time of night known as "the elev | Elvavrålet | ERROR — HTTP 546 |
| 53 | 🔴 | On what day, month, and year did Florence Farmer, a pioneer of wo | June 26, 1958 | ERROR — HTTP 546 |
| ~~54~~ | ✅ | ~~In which month and year was Sayyid Ghulam Muhiyuddin Ahmed bin Kh~~ | ~~November 1888~~ | correct |
| ~~55~~ | ✅ | ~~What was the date, month, and year when Clifford Cunnell, an Engl~~ | ~~5 October 2016~~ | correct |
| ~~56~~ | ✅ | ~~For how many episodes did Gabrielle Fitzpatrick star in "Roar"?~~ | ~~1~~ | correct |
| ~~57~~ | ✅ | ~~In what year was the Showstreet Palace Theater added to Dollywood~~ | ~~1992~~ | correct |
| ~~58~~ | ✅ | ~~What is the name of Helmut Lang's solo exhibition from 2011 in Ea~~ | ~~Make it hard~~ | correct |
| 59 | 🔴 | Who was the 11th Prime Minister of India? | Shri H. D. Deve Gowda | wrong — truncated |
| ~~60~~ | ✅ | ~~What was the name of the episode in which Shai appeared on Family~~ | ~~Good Cop, Bad Cop~~ | correct |
| ~~61~~ | ✅ | ~~In what year was the pink donut with sprinkles sculpture first pr~~ | ~~2007~~ | correct |
| ~~62~~ | ✅ | ~~Give the full name of Rana Ayyub's father (an Indian journalist).~~ | ~~Mohammad Ayyub Waqif~~ | correct |
| ~~63~~ | ✅ | ~~What year was the municipality of Paya, Boyacá, Colombia, founded~~ | ~~1600~~ | correct |
| ~~64~~ | ✅ | ~~What was the name of the MP of Red Deer, Alberta, in 1987?~~ | ~~Gordon Towers~~ | correct |
| ~~65~~ | ✅ | ~~In which month and year did WhatsApp start rolling out support fo~~ | ~~March 2021~~ | correct |
| ~~66~~ | ✅ | ~~In Horizon Zero Dawn's Frozen Wilds DLC, what is CYAN an acronym?~~ | ~~Caldera of Yellowstone Analytic Nexus~~ | correct |
| 67 | 🔴 | According to Hinduism, which planet is associated with Yamraj? | Pluto | wrong — truncated |
| ~~68~~ | ✅ | ~~What year did the Lego part with ID gal56 first release?~~ | ~~2002~~ | correct |
| ~~69~~ | ✅ | ~~The Persina Nature Park in Bulgaria was originally established on~~ | ~~December 4, 2000.~~ | correct |
| ~~70~~ | ✅ | ~~Who was the recipient of the ISCB Accomplishment by a Senior Scie~~ | ~~Michael Waterman~~ | correct |
| ~~71~~ | ✅ | ~~What year were the guidelines outlining requirements for the incl~~ | ~~2015~~ | correct |
| ~~72~~ | ✅ | ~~Give the name of the Kashmiri dish in which mutton intestines are~~ | ~~Methi Maaz.~~ | correct |
| ~~73~~ | ✅ | ~~In which year was Prof. H. U. Hamidi appointed as Vice Chancellor~~ | ~~1990~~ | correct |
| ~~74~~ | ✅ | ~~On what day, month, and year did the 2nd ASEM Environment Ministe~~ | ~~October 12, 2003~~ | correct |
| ~~75~~ | ✅ | ~~Which lake in Kashmir is connected to the Khushal Sar and Gil Sar~~ | ~~Nigeen Lake~~ | correct |
| ~~76~~ | ✅ | ~~In which U.S. state was painter Davyd Whaley born?~~ | ~~Tennessee~~ | correct |
| ~~77~~ | ✅ | ~~Which valley is known as the "Golden Crown of Kashmir"?~~ | ~~Breng Valley~~ | correct |
| ~~78~~ | ✅ | ~~What is the name of the multituberculate mammal of early Paleocen~~ | ~~Taeniolabis taoensis~~ | correct |
| ~~79~~ | ✅ | ~~In which country did Jean-Christophe Yoccoz do his military servi~~ | ~~Brazil~~ | correct |
| ~~80~~ | ✅ | ~~In what year was Peicho Peev the Bulgarian chess International Ma~~ | ~~1973~~ | correct |
| ~~81~~ | ✅ | ~~What was the original name of Forthton, Ontario, located north of~~ | ~~Stone's Corner~~ | correct |
| ~~82~~ | ✅ | ~~On which day, month, and year was the RS-1 satellite launched fro~~ | ~~18 July 1980~~ | correct |
| ~~83~~ | ✅ | ~~What was Zero Bridge originally nicknamed in Srinagar, Kashmir?~~ | ~~Zorr Bridge~~ | correct |
| ~~84~~ | ✅ | ~~What exhibit was displayed in the TD Gallery at the Toronto Refer~~ | ~~Vice & Virtue~~ | correct |
| ~~85~~ | ✅ | ~~Specify the day, month, and year Canon introduced two new UHDgc 2~~ | ~~April 2, 2019~~ | correct |
| ~~86~~ | ✅ | ~~Who played Sarah Robinson in "Felicity" Season 4, Episode 4?~~ | ~~Monica~~ | correct |
| ~~87~~ | ✅ | ~~What prize did De Broglie win in 1952?~~ | ~~Kalinga Prize.~~ | correct |
| ~~88~~ | ✅ | ~~Which glacier is known as the "Third Pole"?~~ | ~~The Siachen Glacier~~ | correct |
| ~~89~~ | ✅ | ~~Which hotel was awarded World's Leading Adventure Hotel 2022?~~ | ~~Pikaia Lodge~~ | correct |
| ~~90~~ | ✅ | ~~What quote did Dr. Richard Trager say to Miles Upshur while openi~~ | ~~I'm not giving up on you~~ | correct |
| ~~91~~ | ✅ | ~~What was the original name of the show that conductor David Rando~~ | ~~Music for the Connoisseur~~ | correct |
| ~~92~~ | ✅ | ~~What is the name of the Dutch businessman and convicted drug traf~~ | ~~Rudi Dekkers~~ | correct |
| ~~93~~ | ✅ | ~~What's the notion to which the lexical semantic map in Figure 4 o~~ | ~~breathe~~ | correct |
| ~~94~~ | ✅ | ~~What language is represented in Figure 4 of the paper "Identifyin~~ | ~~Zenzontepec Chatino~~ | correct |
| ~~95~~ | ✅ | ~~Who among the people who proposed the three-stage system in an ar~~ | ~~Clarence van Riet Lowe~~ | correct |
| ~~96~~ | ✅ | ~~In which Chechen village was journalist Anna Politkovskaya detain~~ | ~~Khatuni.~~ | correct |
| ~~97~~ | ✅ | ~~Who was awarded the Oskar Kokoschka Prize in 1998?~~ | ~~Maria Lassnig~~ | correct |
| ~~98~~ | ✅ | ~~Which hill station is known as "The Gateway to Ladakh"?~~ | ~~Dras~~ | correct |
| ~~99~~ | ✅ | ~~As of 2021, who is the host of The Doers Nepal podcast?~~ | ~~Anup Ghimire~~ | correct |
| ~~100~~ | ✅ | ~~Which president had a meeting with Kwame Nkrumah right before the~~ | ~~Maurice Yameogo~~ | correct |
| ~~101~~ | ✅ | ~~What is the forest cover area of Uttarakhand in square kilometers~~ | ~~ 24,303.04~~ | correct |
| ~~102~~ | ✅ | ~~What day, month, and year did the singer and actress Vanessa Hudg~~ | ~~ 2 December 2023~~ | correct |
| 103 | 🔴 | In the show Severance, who is the eighth CEO of Lumon Industries? | James Eagan | wrong — truncated |
| ~~104~~ | ✅ | ~~What is the surname of the individual who won the Polanyi Medal f~~ | ~~Casavecchia~~ | correct |
| ~~105~~ | ✅ | ~~On what day, month, and year did Olton Willem van Genderen, a Sur~~ | ~~November 9, 1990~~ | correct |
| ~~106~~ | ✅ | ~~What patch for the original PS3 Dark Souls added 3 Humanities to ~~ | ~~1.06~~ | correct |
| 107 | 🔴 | What is the height of the Space Shuttle Atlantis in meters? | 17.2 meters | wrong — truncated |
| ~~108~~ | ✅ | ~~On what day, month, and year did Bruno Kreisky (an Austrian socia~~ | ~~April 23, 1942~~ | correct |
| ~~109~~ | ✅ | ~~Which scientist received the Penrose Medal before the year Presto~~ | ~~Francis J. Pettijohn~~ | correct |
| ~~110~~ | ✅ | ~~On what day, month, and year was John II of France coronated as K~~ | ~~26 September 1350~~ | correct |
| ~~111~~ | ✅ | ~~What is the name of the dedicated infrared flash used to project ~~ | ~~Flood Illuminator~~ | correct |
| ~~112~~ | ✅ | ~~In Table 2 in the Transformer paper (2017), which two languages d~~ | ~~German and French~~ | correct |
| ~~113~~ | ✅ | ~~From what year to what year was David Lloyd Wolper, born in 1928,~~ | ~~1953-1955~~ | correct |
| ~~114~~ | ✅ | ~~As of the 2020 Census, what was the population of Grand Mound, Io~~ | ~~615~~ | correct |
| ~~115~~ | ✅ | ~~How many busts of Pope Paul V did Gian Lorenzo Bernini make?~~ | ~~2~~ | correct |
| ~~116~~ | ✅ | ~~What was the title of the journal that Charles Raymond Perrault s~~ | ~~Artificial Intelligence~~ | correct |
| ~~117~~ | ✅ | ~~What is the rate of climb, in feet per minute, of the Agusta A.10~~ | ~~1,220 ft/min~~ | correct |
| ~~118~~ | ✅ | ~~What team finished with 38 points at the end of the 2021-2022 Pre~~ | ~~Leeds United~~ | correct |
| ~~119~~ | ✅ | ~~To which academic society was computer scientist Sarita Vikram Ad~~ | ~~The American Academy of Arts and Sciences.~~ | correct |
| ~~120~~ | ✅ | ~~In which year, month, and day was the Nokia 8110 announced?~~ | ~~9 September 1996~~ | correct |
| ~~121~~ | ✅ | ~~On what day, month, and year was Harbhajan Singh Rissam (an India~~ | ~~14 May 2011~~ | correct |
| ~~122~~ | ✅ | ~~Who won the 2015 Maine State Pumpkin and Squash Weigh-Off, held a~~ | ~~Edwin Pierpont~~ | correct |
| ~~123~~ | ✅ | ~~What day, month, and year did Lisa Marie Presley die?~~ | ~~12 January 2023 ~~ | correct |
| ~~124~~ | ✅ | ~~What is the forest cover area of Karnataka in square kilometers a~~ | ~~ 38,575.48~~ | correct |
| ~~125~~ | ✅ | ~~What day, month, and year was Edward Ambrose Hug, the American Ma~~ | ~~July 14, 1880~~ | correct |
| ~~126~~ | ✅ | ~~What watch company made the world's first computerized diver's wa~~ | ~~Seiko~~ | correct |
| ~~127~~ | ✅ | ~~In which city in Pakistan did Bahria Town (Private) Limited estab~~ | ~~Lahore~~ | correct |
| ~~128~~ | ✅ | ~~Which year was Bil Keane's first syndicated strip, Channel Chuckl~~ | ~~1954~~ | correct |
| ~~129~~ | ✅ | ~~In which year was Arthur C. Wade, an American lawyer in the 1800s~~ | ~~1877~~ | correct |
| ~~130~~ | ✅ | ~~With whom did Ada Lovelace and her mother attend one of Charles B~~ | ~~Mary Somerville~~ | correct |
| 131 | 🔴 | Who founded the municipality of Sora, Boyacá, Colombia? | Tomás Gualba Castellanos | wrong — truncated |
| ~~132~~ | ✅ | ~~What is the surname of the individual who was awarded the Francis~~ | ~~Pickett~~ | correct |
| ~~133~~ | ✅ | ~~What candidate in Season 11 of The Bachelorette was an amateur se~~ | ~~Shawn Evans~~ | correct |
| ~~134~~ | ✅ | ~~Cornelia Parker curated the "Black and White Room" for which exhi~~ | ~~Royal Academy Summer Exhibition~~ | correct |
| ~~135~~ | ✅ | ~~During which years did Margaret Hamburg work as a clinical instru~~ | ~~1986 to 1990~~ | correct |
| ~~136~~ | ✅ | ~~What was the name of the journal that Gloria Niemeyer Francke was~~ | ~~American Journal of Hospital Pharmacy~~ | correct |
| ~~137~~ | ✅ | ~~What is the Edo name of the crown traditionally worn by the Iyoba~~ | ~~ukpe-okhue~~ | correct |
| ~~138~~ | ✅ | ~~What is the name of the voice actor who voices Alvina in the game~~ | ~~Ève Karpf~~ | correct |
| ~~139~~ | ✅ | ~~In what year were double-digit vehicle codes introduced in Japan ~~ | ~~1967~~ | correct |
| ~~140~~ | ✅ | ~~Who was the voice of Colonel Drucker in the Medal of Honor (2010)~~ | ~~Adrian Holmes~~ | correct |
| ~~141~~ | ✅ | ~~What is the name of the Brazilian entomologist who first describe~~ | ~~Ubirajara Martins~~ | correct |
| ~~142~~ | ✅ | ~~What year was the municipality of Anorí, Antioquia, Colombia, fou~~ | ~~1808~~ | correct |
| ~~143~~ | ✅ | ~~In which month and year did Apollo 14 pilot Edgar Mitchell and Ap~~ | ~~March 2011~~ | correct |
| ~~144~~ | ✅ | ~~Which mathematician received the Chern Medal in 2022?~~ | ~~Barry Mazur~~ | correct |
| ~~145~~ | ✅ | ~~What day, month, and year was Aniello Formisano, an Italian polit~~ | ~~June 10, 1954.~~ | correct |
| ~~146~~ | ✅ | ~~What was Janice Burgess's alma mater?~~ | ~~Brandeis University~~ | correct |
| ~~147~~ | ✅ | ~~What health crisis did Bob Barker experience on May 30, 2022?~~ | ~~Stroke~~ | correct |
| ~~148~~ | ✅ | ~~How many days was Kaitlin Armstrong on the run from authorities f~~ | ~~43~~ | correct |
| ~~149~~ | ✅ | ~~In what year did the mathematician Joachim Neubüser graduate from~~ | ~~1957~~ | correct |
| ~~150~~ | ✅ | ~~To whom was R. C. Harvey married?~~ | ~~Linda Kubicek~~ | correct |
| ~~151~~ | ✅ | ~~Who finished 14th in the 2021–22 Premier League season?~~ | ~~Aston Villa~~ | correct |
| ~~152~~ | ✅ | ~~What is the MD5 checksum of the file named "ffrelay-debian-4.30.g~~ | ~~180caf23dd71383921e368128fb6db52~~ | correct |
| ~~153~~ | ✅ | ~~What month and year was the "Bust of Charles I" by Gian Lorenzo B~~ | ~~January 1698~~ | correct |
| ~~154~~ | ✅ | ~~In 2015, in what exhibition was Henry Ossawa Tanner's work includ~~ | ~~We Speak: Black Artists in Philadelphia, 1920s-1970s~~ | correct |
| ~~155~~ | ✅ | ~~Domenico Lino Morichini first examined the fossilized tooth of wh~~ | ~~Elephant~~ | correct |
| ~~156~~ | ✅ | ~~Who was the Brazilian Vice-President of the International Mathema~~ | ~~Marcelo Viana~~ | correct |
| ~~157~~ | ✅ | ~~What is the half-life of radon-224 in hours?~~ | ~~1.8~~ | correct |
| 158 | 🔴 | What is the full name of the singer who sang the song 'Angels' wi | Aida Emilevna Garifullina | wrong — truncated |
| ~~159~~ | ✅ | ~~In which year was the John Brophy Award first awarded?~~ | ~~1989~~ | correct |
| ~~160~~ | ✅ | ~~What year did Rosemarie Trockel start to use industrial knitting ~~ | ~~1985~~ | correct |
| ~~161~~ | ✅ | ~~Who was the first-ever personality to hoist the Indian National F~~ | ~~Adil Hussain~~ | correct |
| ~~162~~ | ✅ | ~~What year did Ollie Johnston sell his locomotive named Marie E.?~~ | ~~1993~~ | correct |
| ~~163~~ | ✅ | ~~How many chimpanzees were observed with cold-like symptoms when t~~ | ~~14~~ | correct |
| ~~164~~ | ✅ | ~~What is the surname of the individual who won the Bioinorganic Ch~~ | ~~Cowan~~ | correct |
| ~~165~~ | ✅ | ~~In which school did Ghana's former minister Kwadwo Baah-Wiredu st~~ | ~~Kumasi High School~~ | correct |
| ~~166~~ | ✅ | ~~In what year did Aftab Ghulam Nabi Kazi's (12th Deputy Chairman o~~ | ~~2009~~ | correct |
| ~~167~~ | ✅ | ~~What month and year were the Opuke Thermal Pools & Spa opened in ~~ | ~~November 2021~~ | correct |
| ~~168~~ | ✅ | ~~Where was the body of Stuart Leary, a South African sportsman who~~ | ~~Table Mountain, South Africa~~ | correct |
| ~~169~~ | ✅ | ~~Which contestant from Season 2 of The Bachelor was a former NBA c~~ | ~~Lori Todd~~ | correct |
| ~~170~~ | ✅ | ~~Which English singer was a film and television critic for The Obs~~ | ~~George Melly~~ | correct |
| ~~171~~ | ✅ | ~~In what year did John Lennon and Yoko Ono donate their psychedeli~~ | ~~1977~~ | correct |
| ~~172~~ | ✅ | ~~How many minutes and seconds did it take Indian swimmer Vedaant M~~ | ~~16:01.73 seconds~~ | correct |
| ~~173~~ | ✅ | ~~In which month and year did "Flying" magazine publish "Battling t~~ | ~~March 2001~~ | correct |
| ~~174~~ | ✅ | ~~In which year was the municipality of La Pintada, Antioquia, Colo~~ | ~~1815~~ | correct |
| ~~175~~ | ✅ | ~~How many UN Volunteers served in 54 United Nations missions, agen~~ | ~~ 8,282~~ | correct |
| ~~176~~ | ✅ | ~~Who was the first President of the Supreme Court of Bolivia?~~ | ~~Manuel María Urcullo.~~ | correct |
| ~~177~~ | ✅ | ~~Which player character in Exandria Unlimited: Calamity was Sam Ri~~ | ~~Laerryn Coramar-Seelie, played by Aabria Iyengar~~ | correct |
| ~~178~~ | ✅ | ~~What is the name of the college from where Dr. Farooq Abdullah, a~~ | ~~SMS Medical College, Jaipur~~ | correct |
| ~~179~~ | ✅ | ~~At what age did Wiley Lee Griggs III, an American Negro league in~~ | ~~71~~ | correct |
| ~~180~~ | ✅ | ~~In Season 3 of the American version of "The Circle," in which epi~~ | ~~7~~ | correct |
| ~~181~~ | ✅ | ~~What is the third vampire number in recreational mathematics?~~ | ~~1435~~ | correct |
| ~~182~~ | ✅ | ~~What was the height, in meters, of Damian Lamonte Ollie Lillard S~~ | ~~1.65~~ | correct |
| ~~183~~ | ✅ | ~~From 1855 to 1859, James Luke Prendergast (1800-1895) served as L~~ | ~~Harbour Grace~~ | correct |
| ~~184~~ | ✅ | ~~From what university did John P. Sall receive an honorary doctora~~ | ~~ North Carolina State University~~ | correct |
| ~~185~~ | ✅ | ~~What were the month and year when the Indonesian Food and Drug Au~~ | ~~August 2022~~ | correct |
| ~~186~~ | ✅ | ~~Who was the 14th Chief Justice of Kenya?~~ | ~~David Kenani Maraga~~ | correct |
| ~~187~~ | ✅ | ~~Which year was the non-profit organization Prayas Nepal establish~~ | ~~2003~~ | correct |
| ~~188~~ | ✅ | ~~In which year did Jacinda Kate Laurell Ardern receive a Harvard h~~ | ~~2022~~ | correct |
| ~~189~~ | ✅ | ~~What was the economy rate of S. N. Thakur per over in the match b~~ | ~~13.00	~~ | correct |
| ~~190~~ | ✅ | ~~How many children did Gilbert Hani and Mary Hani have?~~ | ~~6~~ | correct |
| ~~191~~ | ✅ | ~~What day, month, and year did the Türksat 1A satellite explode be~~ | ~~24 January 1994~~ | correct |
| ~~192~~ | ✅ | ~~What year did Louis de Broglie become a professor of theoretical ~~ | ~~1928~~ | correct |
| ~~193~~ | ✅ | ~~What are the season number, episode number, and title of the "Vik~~ | ~~Season 2, Episode 2 "Invasion"~~ | correct |
| ~~194~~ | ✅ | ~~Who adopted Jett Williams in 1954?~~ | ~~Lillie Williams Stone~~ | correct |
| 195 | 🔴 | What month, day, and year did the Durban-based shack-dwellers' mo | 14 May 2009 | wrong — truncated |
| ~~196~~ | ✅ | ~~How many inductees did the American Classical Hall of Fame have i~~ | ~~One.~~ | correct |
| ~~197~~ | ✅ | ~~Who was the 2022 winner of "Best Just Chatting Streamer" at The S~~ | ~~Mizkif~~ | correct |
| ~~198~~ | ✅ | ~~In what year was Eugenius Aristides Nisbet elected to the Georgia~~ | ~~1827~~ | correct |
| ~~199~~ | ✅ | ~~What is the name of the astronomer who discovered 216433 Milianle~~ | ~~Erwin Schwab~~ | correct |

## FRAMES — 80/99 = 80.8% strict (p50 40s, 1 error rows {'HTTP 546': 1})

| Verdict | Count | Share |
|---|---|---|

| correct | 80 | 81% |
| wrong | 19 | 19% |

**Miss modes:** {'truncated': 19}

| # | Status | Prompt | Gold | Verdict / Fail |
|---|---|---|---|---|

| ~~0~~ | ✅ | ~~Who was Prime Minister in Australia at the same time that Norman ~~ | ~~Malcolm Fraser~~ | correct |
| ~~1~~ | ✅ | ~~How many letters were in the name of the first single by the arti~~ | ~~12~~ | correct |
| ~~2~~ | ✅ | ~~What primate species, known for its large population in China and~~ | ~~Rhesus Macaques~~ | correct |
| 3 | 🔴 | Regarding the award that the man who created the initial sketch f | Eight | wrong — truncated |
| ~~4~~ | ✅ | ~~Who was the youngest climber to podium at the first year climbing~~ | ~~Alberto Ginés López (18 at the time).~~ | correct |
| ~~5~~ | ✅ | ~~If you were to combine two words, the first of which has a specie~~ | ~~Russia~~ | correct |
| ~~6~~ | ✅ | ~~As of August 3rd 2024, what's the name of the university in the c~~ | ~~Eastern Michigan University~~ | correct |
| 7 | 🔴 | What team scored the most points in an NBA finals game while Rona | Game 1 of the Finals in 1985 the Boston Celtics scored 148 p | wrong — truncated |
| ~~8~~ | ✅ | ~~What was the military rank of the employer of the astronomer who ~~ | ~~Major General was the rank of Thomas Brisbane.~~ | correct |
| ~~9~~ | ✅ | ~~I am thinking of a movie where Hans Zimmer won a Grammy Award for~~ | ~~Crimson Tide~~ | correct |
| ~~10~~ | ✅ | ~~Which American high school can boast of an alumnus for whom the f~~ | ~~Kathleen Senior High School in Lakeland, Florida~~ | correct |
| ~~11~~ | ✅ | ~~Who was the successor of the Egyptian Pharaoh that was in power w~~ | ~~Merneptah~~ | correct |
| ~~12~~ | ✅ | ~~What was the 2021 population of the birthplace of the leader of t~~ | ~~9,162 was the population of Shaftesbury (the birthplace of C~~ | correct |
| ~~13~~ | ✅ | ~~What teammates were inducted into the college football hall of fa~~ | ~~ Gus Welch, and William "Lone Star" Dietz.~~ | correct |
| ~~14~~ | ✅ | ~~What was the age difference at their deaths (in years) between Ed~~ | ~~200~~ | correct |
| ~~15~~ | ✅ | ~~How many years apart did a Kim Jong Un impersonator who was inter~~ | ~~60~~ | correct |
| ~~16~~ | ✅ | ~~The Wisconsin Butter Fire led to dams being built to protect a la~~ | ~~Otis Redding~~ | correct |
| ~~17~~ | ✅ | ~~As of 1st August 2024 Queens of the Stone Age, Them Crooked Vultu~~ | ~~Man~~ | correct |
| ~~18~~ | ✅ | ~~On the same day Roald Dahl first published a work, a famous guita~~ | ~~Duane Allman~~ | correct |
| ~~19~~ | ✅ | ~~As of August 3rd 2024, how many countries are full members of the~~ | ~~12~~ | correct |
| ~~20~~ | ✅ | ~~Who was the winner of Tour de France the same year that a major c~~ | ~~Louison Bobet~~ | correct |
| ~~21~~ | ✅ | ~~What song was #1 on Billboard's Hot 100 for the most days during ~~ | ~~Monster Mash' by Bobby 'Boris' Pickett & the Crypt-Kickers~~ | correct |
| ~~22~~ | ✅ | ~~What Volkswagen former car model has nearly the same name as a Ba~~ | ~~Scirocco (The Bangkok restaurant is called Sirocco)~~ | correct |
| 23 | 🔴 | Of the four main characters on Seinfeld, which actor is the oldes | Michael Richards | ERROR — HTTP 546 |
| ~~24~~ | ✅ | ~~Concerning the 2007 book by Sofi Oksanen, the novel was described~~ | ~~1872~~ | correct |
| ~~25~~ | ✅ | ~~How old was the author of Dragon Ball when the manga was first re~~ | ~~29~~ | correct |
| ~~26~~ | ✅ | ~~When Justin Trudeau was elected as Prime Minister of Canada, who ~~ | ~~Manuel Valls~~ | correct |
| ~~27~~ | ✅ | ~~Who was the building named after on South Forest Avenue, which wa~~ | ~~Grady Gammage~~ | correct |
| ~~28~~ | ✅ | ~~Which of these series was published earliest? Wedding Peach, Toky~~ | ~~Sailor Moon~~ | correct |
| ~~29~~ | ✅ | ~~As of August 5, 2024, what is the name of the federal law that wa~~ | ~~The Sherman Antitrust Act~~ | correct |
| ~~30~~ | ✅ | ~~When Metallica released its album "Master of Puppets," how old we~~ | ~~22~~ | correct |
| ~~31~~ | ✅ | ~~Where did the daughter of the winner of the first US presidential~~ | ~~George Washington University~~ | correct |
| ~~32~~ | ✅ | ~~A Japanese aircraft carrier that was first built to become a luxu~~ | ~~The aircraft carrier Hiyō was sunk in the Battle of the Phil~~ | correct |
| ~~33~~ | ✅ | ~~How many Pokemon World Championships occurred in the contiguous U~~ | ~~- Five Pokemon World Championships took place in the contigu~~ | correct |
| ~~34~~ | ✅ | ~~Out of all of the feature-length theatrical films that John Carpe~~ | ~~Starman (1984)~~ | correct |
| 35 | 🔴 | Baldur's Gate 3 was released in 2023 and the game and its staff h | 57 years old | wrong — truncated |
| ~~36~~ | ✅ | ~~According to the population data in their respective Wikipedia ar~~ | ~~84,512~~ | correct |
| ~~37~~ | ✅ | ~~Which 2024 college/university president has a degree from Harvard~~ | ~~Eli Capilouto~~ | correct |
| 38 | 🔴 | What William Wyler movie debuted the same year that the chairman  | Jezebel | wrong — truncated |
| ~~39~~ | ✅ | ~~As of August 1, 2024, if you add together the age of Ana Ollo Hua~~ | ~~100 (59 + 76) - 35~~ | correct |
| ~~40~~ | ✅ | ~~This founder of the Academy of Science, St. Louis became establis~~ | ~~Cuscuta~~ | correct |
| ~~41~~ | ✅ | ~~In the same year that HMS Holland 1 was launched, a British monar~~ | ~~6 years, 11 months, 25 days.~~ | correct |
| ~~42~~ | ✅ | ~~How many Red Hot Chili Peppers albums were released while Nelson ~~ | ~~4~~ | correct |
| 43 | 🔴 | Fossils of the extinct sea snail, Alvania belgica, were originall | City of Brussels | wrong — truncated |
| ~~44~~ | ✅ | ~~How many countries were part of the commonwealth on the date Prin~~ | ~~On 8 September 2022, there were 56 countries as part of the ~~ | correct |
| ~~45~~ | ✅ | ~~What is the difference in mean flow rate (in cubic feet per secon~~ | ~~75.5 cubic ft/s~~ | correct |
| ~~46~~ | ✅ | ~~Who was the Argentinian president who resigned from the position ~~ | ~~Pedro Ramírez~~ | correct |
| ~~47~~ | ✅ | ~~In the year that the film 'Moana' was released, who was the hitti~~ | ~~Ty Van Burkleo~~ | correct |
| ~~48~~ | ✅ | ~~How many of Ron Hutchinson's teams won League Championships while~~ | ~~Of the six hockey teams that Hutchinson played on during his~~ | correct |
| ~~49~~ | ✅ | ~~Mary Gaulden Jagger worked in the Biology Division of the Oak Rid~~ | ~~Frontier, 2022~~ | correct |
| ~~50~~ | ✅ | ~~What lasted longer: the reign of Queen Elizabeth II or the life o~~ | ~~The reign of Queen Elizabeth II~~ | correct |
| ~~51~~ | ✅ | ~~How old was Harvard University, when the person whom the longest ~~ | ~~140 years old.~~ | correct |
| 52 | 🔴 | How many of Mark Calaway's consecutive Wrestlemania wins occurred | Five | wrong — truncated |
| ~~53~~ | ✅ | ~~What is the shortest possible abbreviation in the United States f~~ | ~~R~~ | correct |
| 54 | 🔴 | If Anastasia Romanov had still been alive when the 90s cartoon mo | Duchess Anastasia Romanov would have been 96 years old. | wrong — truncated |
| ~~55~~ | ✅ | ~~How many years had the station that preceded the Salthill and Mon~~ | ~~143 years~~ | correct |
| ~~56~~ | ✅ | ~~Which member of the Wu-Tang Clan was born on Staten Island?~~ | ~~Ghostface Killah~~ | correct |
| 57 | 🔴 | What is the percentage increase of total deaths of Japanese durin | 66409.3% increase | wrong — truncated |
| 58 | 🔴 | Which Pope served the longest between the Battle of the Milvian B | St. Sylvester I, whose Latin name was Silvester | wrong — truncated |
| ~~59~~ | ✅ | ~~I'm trying to show my daughter some of the movies I grew up with.~~ | ~~*She's All That*~~ | correct |
| 60 | 🔴 | If the author of the philosophical magnum opus Being and Time wer | Martin Gilbert Sartre | wrong — truncated |
| 61 | 🔴 | What geographical commonality do the person who first described A | They were both born in Vienna. | wrong — truncated |
| ~~62~~ | ✅ | ~~Who was the Mayor of Quincy, Massachusetts when the Quincy Medica~~ | ~~Henry O. Fairbanks and Thomas P. Koch~~ | correct |
| 63 | 🔴 | The female of the pair who have been called "the worst guests in  | Jake Pavelka | wrong — truncated |
| ~~64~~ | ✅ | ~~I grew up in a village on Long Island in the Town of Oyster Bay. ~~ | ~~Sea Cliff Elementary School~~ | correct |
| ~~65~~ | ✅ | ~~Which country did tennis' first Golden Slam winner represent when~~ | ~~West Germany~~ | correct |
| 66 | 🔴 | Who is the Formula One driver who won their first Driver's Champi | Nigel Mansell, Williams Grand Prix Engineering, 15 years | wrong — truncated |
| ~~67~~ | ✅ | ~~Mass Effect 2 once won the D.I.C.E. Award for Game of the Year. W~~ | ~~Martin Hollis~~ | correct |
| ~~68~~ | ✅ | ~~What are the first three letters of the capital city of the count~~ | ~~Cop~~ | correct |
| ~~69~~ | ✅ | ~~The latest game, as of August 4, 2024, from the creator of Kirby ~~ | ~~The Last of Us Part II~~ | correct |
| ~~70~~ | ✅ | ~~What's the star sign of the author of A Court of Thorns and Roses~~ | ~~Pisces~~ | correct |
| ~~71~~ | ✅ | ~~The Assistant to the Regional Manager on The Office TV show (US v~~ | ~~Betanin~~ | correct |
| ~~72~~ | ✅ | ~~Who was the character in the roster of the Marvel vs. Capcom entr~~ | ~~Jill Valentine~~ | correct |
| ~~73~~ | ✅ | ~~What is the scientific name of an amphibian that is listed as end~~ | ~~Ambystoma texanum~~ | correct |
| ~~74~~ | ✅ | ~~How many years apart were the Canadian Museum of History and the ~~ | ~~24 years~~ | correct |
| ~~75~~ | ✅ | ~~What is the the sum of the ages of the men who were executed by f~~ | ~~80~~ | correct |
| ~~76~~ | ✅ | ~~The author of the book "A Good Woman"'s author was married to a m~~ | ~~Breast and skin~~ | correct |
| 77 | 🔴 | Joel Oshiro Dyck played professional ice hockey for three teams.  | Joel Oshiro Dyck played for the Chatham Wheels, the Wheeling | wrong — truncated |
| ~~78~~ | ✅ | ~~If an Ixodes scapularis tick in its nymph stage feeds on a host i~~ | ~~Two seasons.~~ | correct |
| ~~79~~ | ✅ | ~~What movie won the Academy Award for Best Picture the same year t~~ | ~~The Deer Hunter~~ | correct |
| ~~80~~ | ✅ | ~~What is an animal that is distantly related to the capybara and h~~ | ~~Chinchilla~~ | correct |
| ~~81~~ | ✅ | ~~How many years apart was the founding of Snell & Wilmer from the ~~ | ~~16 years~~ | correct |
| ~~82~~ | ✅ | ~~How many of Hitler's three couriers of his last will and other po~~ | ~~1~~ | correct |
| 83 | 🔴 | Give me the difference in time, measured in hours not days, betwe | 2128 hours | wrong — truncated |
| ~~84~~ | ✅ | ~~What was the word that featured the least in the longest recorded~~ | ~~You~~ | correct |
| ~~85~~ | ✅ | ~~When Taylor Swift first released her studio album "1989," how man~~ | ~~4~~ | correct |
| ~~86~~ | ✅ | ~~In which year did the 4th Sheriff of Yorkshire to be part of the ~~ | ~~1190~~ | correct |
| ~~87~~ | ✅ | ~~A disease that had millions of dollars raised for on April 20, 19~~ | ~~1981~~ | correct |
| 88 | 🔴 | What band had a male lead singer born on the day Mohammad Mosadde | Kool & the Gang | wrong — truncated |
| ~~89~~ | ✅ | ~~As of 1 August 2024, How many more seasons did Outrageous Fortune~~ | ~~1~~ | correct |
| 90 | 🔴 | What was the age difference between the inventor of Barbie and th | 6 months and 26 days. | wrong — truncated |
| ~~91~~ | ✅ | ~~Little River Canyon National Preserve has three waterfalls, one o~~ | ~~2,452 ft~~ | correct |
| 92 | 🔴 | Two famous modernist writers were born and died on the same year. | Virginia Woolf and James Joyce. Virginia Woolf lived 82 days | wrong — truncated |
| ~~93~~ | ✅ | ~~Of all states within New England in the United States, which had ~~ | ~~Of the 6 states within New England, Maine, New Hampshire, an~~ | correct |
| ~~94~~ | ✅ | ~~What popular ice cream dessert shares its birthplace with Fred Ro~~ | ~~The Banana Split~~ | correct |
| 95 | 🔴 | What was the former name of the brand of sneakers worn by the Hea | Blue Ribbon Sports Inc. | wrong — truncated |
| ~~96~~ | ✅ | ~~In the Eurovision Song Contest 2024, one country scored a combine~~ | ~~Italy and Norway~~ | correct |
| ~~97~~ | ✅ | ~~What is the middle name of the U.S. president who died on the sam~~ | ~~David~~ | correct |
| ~~98~~ | ✅ | ~~What is the birth date of the person picked right after Lee Vaugh~~ | ~~August 24, 1974~~ | correct |
| ~~99~~ | ✅ | ~~I'm thinking of a painting. It was done by the same man who paint~~ | ~~Mock Election~~ | correct |

## DSQA — 41/100 = 41.0% strict (p50 69s, 0 error rows {})

| Verdict | Count | Share |
|---|---|---|

| correct | 41 | 41% |
| partial | 40 | 40% |
| wrong | 19 | 19% |

**Miss modes:** {'truncated': 58, 'dead-end': 1}

| # | Status | Prompt | Gold | Verdict / Fail |
|---|---|---|---|---|

| 0 | 🟡 | I want to start a farm and am trying to find the best state for i | Oklahoma, Kansas, Texas | partial — 1/3 gold items found |
| 1 | 🟡 | Out of the EU countries (as of 2024) that were in the "top 10 of  | France, Germany, Netherlands | partial — 3/3 gold items found |
| ~~2~~ | ✅ | ~~Assess the following counties in Tennessee: Anderson, Cheatham, a~~ | ~~Anderson County~~ | correct |
| 3 | 🟡 | Out of the states that had all of their electoral votes in the 20 | Alabama, Arkansas, Indiana, Kansas, Kentucky, Louisiana, Mis | partial — 13/13 gold items found |
| 4 | 🔴 | According to NOAA's Billion-Dollar Weather and Climate Disasters  | Northwest, Central, Eastern Winter Storm and Cold Wave Febru | wrong — truncated |
| 5 | 🟡 | Using the year 2022, what are the capitals of the two states with | Baton Rouge, Columbia | partial — 1/2 gold items found |
| 6 | 🟡 | For the year ended December 31, 2022, calculate Philip Morris Int | 1) Turning Point Brands, Inc. 2) Altria Group, Inc. 3) Phili | partial — 3/6 gold items found |
| ~~7~~ | ✅ | ~~I'm doing a comparison on African economies for my development st~~ | ~~South Africa~~ | correct |
| 8 | 🔴 | Out of the countries with both an above-average homicide rate and | Haiti | wrong — truncated |
| ~~9~~ | ✅ | ~~I'm travelling on the South Western Railway service from Sheppert~~ | ~~Kingston~~ | correct |
| 10 | 🔴 | According to global5050.org COVID-19 Sex-Disaggregated Data Track | ICU Admissions | wrong — truncated |
| 11 | 🟡 | Based on the "Immigrants to Japan: Where did they move from?" dat | Brazil, Argentina, Bolivia, Peru, Nigeria | partial — 4/5 gold items found |
| 12 | 🔴 | Among the University of Tennessee at Knoxville, the University of | ANTH 190 (Special Topics in Anthropology I) | wrong — truncated |
| 13 | 🔴 | Of the European countries which saw their greenhouse gas emission | Albania | wrong — truncated |
| 14 | 🟡 | Which of the 6 winners of the Young Investigator Award for the Fl | Damien Fair, Leah Somerville, Eva Telzer, Dylan Gee, Kate Mi | partial — 5/5 gold items found |
| 15 | 🟡 | According to Santa Cruz County Sanitation District's 2020 Audit ( | Transmission Systems, Construction in progress, Mobile equip | partial — 2/3 gold items found |
| 16 | 🟡 | Of the first-generation Water-type Pokémon used by the three main | Kingler, Starmie, Psyduck, Seel, Dewgong | partial — 5/5 gold items found |
| 17 | 🔴 | List the railroad accidents investigated by the NTSB with inciden | RIR-24-02, RIR-24-03, RIR-23-09, HZIR-23-01, RIR-23-16 | wrong — truncated |
| 18 | 🟡 | According to Our World in Data, which countries ranked in the top | Norway, Switzerland | partial — 2/2 gold items found |
| 19 | 🟡 | Which authors contributed articles to the NAWE's Writing in Educa | Bryan Podmore, Sarah Wardle, Martin Goodman, Fred Sedgwick,  | partial — 8/8 gold items found |
| ~~20~~ | ✅ | ~~In the diaries of Samuel Pepys, which naval figure is mentioned i~~ | ~~(Sir) William Batten~~ | correct |
| 21 | 🔴 | List the names of the MPs which won their first election to the H | Giles Watling, Jack Brereton, Ben Bradley, Eddie Hughes, Ste | wrong — truncated |
| 22 | 🟡 | Which countries that had a record high average temperature for 20 | South Korea, Austria, Germany, China, Japan, Hungary | partial — 4/6 gold items found |
| 23 | 🟡 | Using butterfly-conservation.org, which butterfly species had at  | Red Admiral, Comma, Painted Lady, Large White, Ringlet, Gree | partial — 8/9 gold items found |
| 24 | 🟡 | List all the years from 2015 to 2021 that the St Kilda Soay Sheep | 2015, 2016, 2018, 2020, 2021 | partial — 5/5 gold items found |
| 25 | 🟡 | Between 2014 and 2020, which years did Doctors Without Borders US | 2014, 2016, 2017, 2020 | partial — 4/4 gold items found |
| ~~26~~ | ✅ | ~~Use protein sequences from https://www.uniprot.org/. I am interes~~ | ~~T. maritima, A. baumannii~~ | correct |
| ~~27~~ | ✅ | ~~Using the cia world factbook factsheets for each country, which o~~ | ~~Bhutan~~ | correct |
| 28 | 🔴 | I remember reading an article a while back, but the only thing I  | Hacking CTFs with Plain Agents  | wrong — truncated |
| ~~29~~ | ✅ | ~~What year between 2020 and 2023 inclusive had the smallest differ~~ | ~~2020~~ | correct |
| ~~30~~ | ✅ | ~~In the 2023 General Election in NZ, of the electoral candidates t~~ | ~~Vanessa Weenink, Chris Bishop, Carlos Cheung, Paulo Garcia, ~~ | correct |
| ~~31~~ | ✅ | ~~Of all the US states that were labeled as battleground states in ~~ | ~~Ohio, North Carolina, Florida~~ | correct |
| 32 | 🔴 | Find the votes that passed in the US House of Representatives bet | Roll Call 695 (118th Congress), Roll Call 696 (118th Congres | wrong — truncated |
| ~~33~~ | ✅ | ~~Which country is not a member of BRICS, NATO, Five Eyes, the Comm~~ | ~~Zimbabwe~~ | correct |
| ~~34~~ | ✅ | ~~Give me the New England and states bordering the Great Lakes that~~ | ~~Connecticut, Maine, New Hampshire, Rhode Island~~ | correct |
| 35 | 🟡 | which years from 2017 to 2023 had at least 10 deaths as a result  | 2017 and 2023 | partial — 1/1 gold items found |
| ~~36~~ | ✅ | ~~Who is the Associate Editor of the SBL Study Bible who is a gradu~~ | ~~Matthew Goff~~ | correct |
| 37 | 🔴 | In the year 2023, which ward was the councillor from in canterbur | West Bay | wrong — truncated |
| 38 | 🔴 | According to the paper "Combining phylogenomic and supermatrix ap | Lialis | wrong — truncated |
| 39 | 🟡 | According to Data NYC's MTA Subway Trains Delayed: 2020-2024 and  | Times Sq-42 St/Port Authority Bus Terminal, 34 St-Herald Sq, | partial — 1/3 gold items found |
| ~~40~~ | ✅ | ~~Of the creatures, not plants, that became listed as threatened or~~ | ~~Sacramento Mountains Checkerspot Butterfly~~ | correct |
| 41 | 🟡 | Of all the botanists who have papers in the “papers of individual | Robert Morison, Jacob Bobart the Younger, William Sherard, G | partial — 4/4 gold items found |
| ~~42~~ | ✅ | ~~Between the 2010-11 and 2014-15 regular seasons, which team for e~~ | ~~2010-11: Calgary Flames/Minnesota Wild, 2011-12: Anaheim Duc~~ | correct |
| 43 | 🔴 | Between the top 5 countries on the Heritage Foundation's Index of | Haiti | wrong — truncated |
| ~~44~~ | ✅ | ~~According to the Government of New Brunswick's website, identify ~~ | ~~Capital Region rural district~~ | correct |
| ~~45~~ | ✅ | ~~According to the IMF, which of the following countries saw the hi~~ | ~~Switzerland~~ | correct |
| 46 | 🟡 | List the lipids that were used to make lipid nanoparticles for mR | DLin-MC3-DMA, 18:0 PC (DSPC), Cholesterol, DMG-PEG2000 | partial — 1/4 gold items found |
| ~~47~~ | ✅ | ~~Of the years between 2000 and 2019 (inclusive) during which the p~~ | ~~2005~~ | correct |
| ~~48~~ | ✅ | ~~From the Space Shuttle program, for the space shuttle with the mo~~ | ~~5~~ | correct |
| 49 | 🔴 | For cameras in Fujifilm's X-T line (single digits only, i.e. not  | SanDisk - 16G - SDSDXPB-016G Toshiba - 16G - SDXU-B016G  San | wrong — truncated |
| 50 | 🟡 | In the Airbnb quarterly SEC filings for 2022, according to the “C | Q1, Q2, Q3 | partial — 3/3 gold items found |
| 51 | 🟡 | Give me a list of all of the fish that Albacore form mixed school | Skipjack Tuna, Yellowfin Tuna | partial — 2/2 gold items found |
| ~~52~~ | ✅ | ~~Of the authors in the first article of the 65th edition of the Jo~~ | ~~Joelle Pineau~~ | correct |
| 53 | 🟡 | I am doing a study on the performance of rail operators in the UK | East Midlands Railway, TransPennine Express | partial — 1/2 gold items found |
| 54 | 🟡 | According to the NHTSA, which US states had a fatality rate per 1 | Connecticut (2003, 2004, 2005), Massachusetts (2000, 2001, 2 | partial — 9/11 gold items found |
| 55 | 🔴 | Identify the liquor license account with the most report entries  | 12 entries - WINEGUYS L.L.C; DBA(s) - ID: 223939, CITY PARK  | wrong — truncated |
| ~~56~~ | ✅ | ~~I'm interested in the aquaculture industry, particularly the rese~~ | ~~Khor Waiho~~ | correct |
| ~~57~~ | ✅ | ~~Of the three constituencies at the 2010 General Election with the~~ | ~~East Ham~~ | correct |
| 58 | 🟡 | Can you look up the paper, "Proteins and polysaccharides from veg | Nikita Navolokin, Alexander Shirokov | partial — 2/2 gold items found |
| 59 | 🟡 | Of the states with a premature birth rate of over 11, which also  | Mississippi, Arkansas, Louisiana, West Virginia, Georgia | partial — 5/5 gold items found |
| 60 | 🟡 | I am performing a comparative study on the quality of life in G20 | Canada, France, Australia | partial — 3/3 gold items found |
| ~~61~~ | ✅ | ~~Across the 2020, 2021, and 2022 “Water and Sewerage Companies Env~~ | ~~Southern Water~~ | correct |
| ~~62~~ | ✅ | ~~Of the states that have an more than 50 tornadoes annually on ave~~ | ~~Oklahoma, Missouri, Iowa~~ | correct |
| ~~63~~ | ✅ | ~~I am doing a presentation on demography for my politics class. Us~~ | ~~France~~ | correct |
| ~~64~~ | ✅ | ~~According to Fashionphile's 2023 Ultra Luxury Resale Report, find~~ | ~~Europe~~ | correct |
| 65 | 🔴 | I’m interested in how ripening affects the sugar composition of b | Sucrose: - 2.08 grams | wrong — truncated |
| ~~66~~ | ✅ | ~~According to Statistics Canada, when comparing the years 2017 and~~ | ~~Alberta~~ | correct |
| ~~67~~ | ✅ | ~~According to Worldometer, which countries that have a world share~~ | ~~Ethiopia, Egypt, Vietnam, Bangladesh, China~~ | correct |
| 68 | 🟡 | According to the ACT, for 2023 identify of all the states to have | Kentucky, Wyoming, Montana, Arkansas, Nebraska, Wisconsin, U | partial — 7/7 gold items found |
| 69 | 🟡 | Using https://results.aec.gov.au/, of the parties that received m | Liberal Party of Australia  Australian Labor Party   Austral | partial — 5/5 gold items found |
| ~~70~~ | ✅ | ~~Out of the movies produced by the director of Transformers, when ~~ | ~~July 7, 1972~~ | correct |
| 71 | 🟡 | Create a list of scottish westminster constituencies which voted  | Na h-Eileanan an Iar, East Renfrewshire | partial — 2/2 gold items found |
| 72 | 🟡 | Referencing Statistics Canada (table 23-10-0253-01), which Canadi | Halifax Stanfield Airport, Edmonton Airport, Winnipeg James  | partial — 5/8 gold items found |
| 73 | 🟡 | In the first duel between Mako and Yugi, list all of Yugi's monst | Curse of Dragon, Giant Soldier of Stone, Feral Imp, Horn Imp | partial — 4/5 gold items found |
| ~~74~~ | ✅ | ~~By comparing the results from all the exam periods between March ~~ | ~~March 2022~~ | correct |
| ~~75~~ | ✅ | ~~Who are the people that have received more votes than Winston Pet~~ | ~~Bob Clarkson, Simon Bridges, Matt King~~ | correct |
| 76 | 🟡 | I'd like a list of repeat Booker Prize/Man Booker Prize judges an | Rebecca West (1969, 1970), Antonia Fraser (1970, 1971), Susa | partial — 28/28 gold items found |
| ~~77~~ | ✅ | ~~I'm looking at the late sockeye run for the years 2018 to 2023, a~~ | ~~2019, 2021, 2023~~ | correct |
| 78 | 🟡 | According to estimated data tables from the Library of Congress A | Russia, Austria-Hungary, Germany | partial — 3/3 gold items found |
| ~~79~~ | ✅ | ~~According to Clemson University variety evaluations, which farm p~~ | ~~Musser Fruit Research Farm~~ | correct |
| 80 | 🔴 | By using the NHS website for “Shoulder Pain”, which of the possib | Hypermobility | wrong — truncated |
| 81 | 🟡 | List the regions within England that were within the 5 highest ab | London, East | partial — 2/2 gold items found |
| ~~82~~ | ✅ | ~~I’m interested in how firearm mortality rates impact the votes of~~ | ~~New Mexico~~ | correct |
| 83 | 🟡 | Which of the 50 US states had fewer than 300 traffic fatalities i | Hawaii, Idaho, Maine, Montana, Nebraska, New Hampshire, Rhod | partial — 8/8 gold items found |
| 84 | 🟡 | According to BiggestUSCities.com's "Top 100 Biggest US Cities" li | Phoenix (Arizona) and San Antonio (Texas) | partial — 1/1 gold items found |
| 85 | 🟡 | According to the Social Security Administration, what are the ide | Michael, Christopher, Jason | partial — 3/3 gold items found |
| 86 | 🟡 | Name the three types of parakeets or parrots that can be seen in  | Green Parakeet, Monk Parakeet (feral), Red-crowned Parrot | partial — 2/3 gold items found |
| ~~87~~ | ✅ | ~~What was the country with the latest year of independence from Eu~~ | ~~Burundi~~ | correct |
| ~~88~~ | ✅ | ~~Among all countries led by a female head of state as of June 2024~~ | ~~Trinidad & Tobago, Malta, Barbados, Dominica~~ | correct |
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

## BROWSECOMP — 29/85 = 34.1% strict (p50 92s, 15 error rows {'HTTP 504': 15})

| Verdict | Count | Share |
|---|---|---|

| correct | 29 | 34% |
| wrong | 56 | 66% |

**Miss modes:** {'truncated': 55, 'answered-wrong': 1}

| # | Status | Prompt | Gold | Verdict / Fail |
|---|---|---|---|---|

| 0 | 🔴 | There is a dissertation written before 2020 that analyzes the Got |  Michael Reed Holzer | wrong — truncated |
| 1 | 🔴 | Can you tell me the first and last birth name of this person base | Aaradhya Bachchan | wrong — truncated |
| 2 | 🔴 | An artwork was created by someone born in the 1900s and raised ca | Verity | wrong — truncated |
| 3 | 🔴 | A person who, in a specific year between 2010 and 2020, both year | Phoenix New Times | ERROR — HTTP 504 |
| 4 | 🔴 | I am seeking the full name of an actor based on the following det | Rishi Kapoor | ERROR — HTTP 504 |
| 5 | 🔴 | In a 2020 interview, a certain individual stated that they starte | Ihuoma Sonia Uche | wrong — truncated |
| 6 | 🔴 | Between 2010 and 2020 inclusive, less than 10 people were killed, | March 19 | wrong — answered-wrong |
| ~~7~~ | ✅ | ~~Three people wrote an article published between 2020 and 2023 lis~~ | ~~Rain~~ | correct |
| ~~8~~ | ✅ | ~~Sometime between 2015 and 2020 (inclusive), an exhibition was hel~~ | ~~Collecting Ladies: Ferdinand von Mueller and Women Botanical~~ | correct |
| ~~9~~ | ✅ | ~~I want to know the name of a novel, published before 2023, whose ~~ | ~~Loving Frank~~ | correct |
| ~~10~~ | ✅ | ~~A certain individual who is an entrepreneur that resides in the U~~ | ~~Wale Adebayo~~ | correct |
| 11 | 🔴 | An individual whose eldest child was born when they were between  | Michael Caine | wrong — truncated |
| ~~12~~ | ✅ | ~~In a cricket match played between 1980 and 1990 (exclusive), a pl~~ | ~~34~~ | correct |
| 13 | 🔴 | A US federal agency created in the 1940s researched a scientific  | Secret Oral Teachings in Tibetan Buddhist Sects | wrong — truncated |
| 14 | 🔴 | A person is from a country that's been an EU member since 1995. T | Million Voices | wrong — truncated |
| 15 | 🔴 | In their book published between 1950 and 1970, Writer A claimed t | Reasons of a Hindu for rejecting the Doctrines of Christiani | wrong — truncated |
| 16 | 🔴 | An alliance of more than three universities in the same country f | multiple-membership, multiple-classification | ERROR — HTTP 504 |
| ~~17~~ | ✅ | ~~There is an author who has had their work appear in more than thi~~ | ~~United Kingdom, Germany~~ | correct |
| 18 | 🔴 | This research publication, published before July 2021, was co-aut | Development of waffle with fat filling using unconventional  | wrong — truncated |
| ~~19~~ | ✅ | ~~An Emmy award winner wrote an article published in 2018 about the~~ | ~~Magic Mommy Stories~~ | correct |
| 20 | 🔴 | In an article posted sometime between 2016 and 2019 (inclusive),  | 13 June 1852 | wrong — truncated |
| 21 | 🔴 | A paper authored by six people was published in November 2022. It | DMREF-1922234 | wrong — truncated |
| 22 | 🔴 | A company co-founder was born in the year their country won the W | $1.05 billion | wrong — truncated |
| ~~23~~ | ✅ | ~~As of December 2023, I am seeking the name of a historic site con~~ | ~~The Gingras Trading Post State Historic Site~~ | correct |
| 24 | 🔴 | The actor was born in May between 1996 and 1999 and graduated wit | Ahmed Ghozzi | wrong — truncated |
| 25 | 🔴 | I am looking for the full name of a series in which:  - The first | Stranger Things | ERROR — HTTP 504 |
| 26 | 🔴 | An author (1) published short fiction pieces in two online litera | The Inconsequential Codes on Lipsticks | wrong — truncated |
| 27 | 🔴 | Identify the company that underwent a name change prior to 2020,  | Auxly | wrong — truncated |
| ~~28~~ | ✅ | ~~In a FIFA World Cup match held between 2018 and 2023, there were ~~ | ~~Sergio Costa ~~ | correct |
| ~~29~~ | ✅ | ~~In 2023, an article was published online about a school welcoming~~ | ~~27~~ | correct |
| 30 | 🔴 | As of December 31, 2023, I am seeking the name of the sibling who | Adam Horne | wrong — truncated |
| 31 | 🔴 | There is a certain drug that I am interested in that was describe | Vanderbilt clinical oncology research career development awa | wrong — truncated |
| 32 | 🔴 | A specific person, who will be referred to as person 1 from now o | Joan Alta Iwan | wrong — truncated |
| ~~33~~ | ✅ | ~~Given the following hints that are all true as of 2023, there was~~ | ~~2015, Album of The Year ~~ | correct |
| 34 | 🔴 | A video game from the 2010s was released to negative reviews. Thr | Javier Rodriguez | wrong — truncated |
| ~~35~~ | ✅ | ~~There is a TV show episode in which one of the main characters un~~ | ~~Legion; Season 1; Chapter 5~~ | correct |
| 36 | 🔴 | A person started in programming at a university founded between 1 | Smilegate Foundation | wrong — truncated |
| ~~37~~ | ✅ | ~~How much did tourist arrivals in accommodations increase in Novem~~ | ~~5.4%~~ | correct |
| 38 | 🔴 | What is the real-life first and last name of the entertainer who; | Georgia Hirst | ERROR — HTTP 504 |
| 39 | 🔴 | There is a national team coach who was a football pioneer in the  | Kai Tomety | ERROR — HTTP 504 |
| 40 | 🔴 | A new school was founded in the '90s by combining a girls' and bo | Convent of Our Lady of Mercy | wrong — truncated |
| 41 | 🔴 | On the second Saturday of a month between 2011 and 2021 (inclusiv | 11/01/2021 | wrong — truncated |
| ~~42~~ | ✅ | ~~A final was held between 1995 and 2005 inclusive, and two teams p~~ | ~~Martin Devaney~~ | correct |
| 43 | 🔴 | I need you to name the first and last name of the production cont | Shafeer Sait | wrong — truncated |
| 44 | 🔴 | After 2010 but before 2023, a bank discovered that when converted | Sukhumvit Soi 23 | wrong — truncated |
| 45 | 🔴 | A society founded in the 1960s published an article 60 years late | Hannah Belcher | wrong — truncated |
| 46 | 🔴 | An actor who grew up in an Asian country for more than ten years  | Cole Zanetti | wrong — truncated |
| ~~47~~ | ✅ | ~~A country whose flag was a result of correct prediction has a gov~~ | ~~$26.1 billion~~ | correct |
| 48 | 🔴 | An individual hails from a nation where their grandfather immigra | Jaroslav Stetkevych | wrong — truncated |
| 49 | 🔴 | Person X was born in the first half of the 1900s and passed away  | Zius Galit | wrong — truncated |
| 50 | 🔴 | Please tell me the name of the learning institution that fits the | Queen Arwa University | wrong — truncated |
| 51 | 🔴 | There’s an actress who made her debut on stage at the age of 13 a | Pirouette | ERROR — HTTP 504 |
| ~~52~~ | ✅ | ~~According to the company's annual report in 1997, it recorded an ~~ | ~~7%~~ | correct |
| 53 | 🔴 | A slave in Africa and, later, a merchant who died en route to the | Jaja of Opobo: The slave who became a king | ERROR — HTTP 504 |
| ~~54~~ | ✅ | ~~A company was acquired between 2013 and 2023. The CEO of that com~~ | ~~Volkswagen Jetta~~ | correct |
| ~~55~~ | ✅ | ~~In a capital city in the South American continent, there's a buil~~ | ~~La Estrella; Argentina~~ | correct |
| 56 | 🔴 | Can you tell me the name of a movie which was released in year 20 | Dosti: Friends Forever | wrong — truncated |
| 57 | 🔴 | Hey Chat, I'm trying to remember someone's popular name. This per | Peter King | ERROR — HTTP 504 |
| 58 | 🔴 | The band was formed in June between 2013 and 2016, inclusive. One | COUNTERFEIT. | ERROR — HTTP 504 |
| 59 | 🔴 | A video game development studio based in a state founded in the e | Turbett, Sweet, Carriero, Wolfe | wrong — truncated |
| 60 | 🔴 | As of December 2022, I am seeking the name of the author's then-w | Seulah | wrong — truncated |
| ~~61~~ | ✅ | ~~An actor with a catholic upbringing born to a middle-class family~~ | ~~1979~~ | correct |
| 62 | 🔴 | Name the band based on the following information as of December 2 | Death SS | wrong — truncated |
| 63 | 🔴 | Provide the name of the city as of 2021 a certain actor is from b | New Orleans | wrong — truncated |
| 64 | 🔴 | There is a competition for a certain trading card game that took  | Denko Sekka | wrong — truncated |
| ~~65~~ | ✅ | ~~A drawing from the 1700s shows a townlet featuring around 15 - 20~~ | ~~Rodenburg~~ | correct |
| 66 | 🔴 | Please provide the name of this particular movie:  This movie was | Two Living, One Dead | wrong — truncated |
| 67 | 🔴 | There is a religious building, that was first constructed during  | SK 34979 36323 | wrong — truncated |
| ~~68~~ | ✅ | ~~The band was formed between 2001 and 2004 by a composer, music pr~~ | ~~Jadal~~ | correct |
| 69 | 🔴 | Can you name the landmark based on the following details as of 31 | Ballysaggartmore Towers | wrong — truncated |
| 70 | 🔴 | Help me identify the individual that matches the below criteria:  | Oliver Mtukudzi | ERROR — HTTP 504 |
| ~~71~~ | ✅ | ~~In a drama series with a central theme of music that streamed in ~~ | ~~Bandish Bandits~~ | correct |
| 72 | 🔴 | There is an Indian author who got promoted from associate profess | Finding the mathematical overlaps of the axiom of choice in  | wrong — truncated |
| 73 | 🔴 | A specific article published between 2019 and 2021, both years in | Intersemiotic Convergence | wrong — truncated |
| 74 | 🔴 | I’m looking for the name of a U.S. newspaper which was only in pu | Iditarod Nugget | wrong — truncated |
| 75 | 🔴 | A Harvard award-winning author wrote an article less than 5 years | Daniel Goleman | ERROR — HTTP 504 |
| 76 | 🔴 | Provide the name of the month and country a certain individual wa | December, Nigeria | wrong — truncated |
| 77 | 🔴 | There is an article about a tribe's drug conviction rate. One of  | Tamlin S. Conner | wrong — truncated |
| ~~78~~ | ✅ | ~~A pack of downloadable content was released for a strategy video ~~ | ~~Mathilda Bjarnehed~~ | correct |
| 79 | 🔴 | A particular cricket match played before 2022, in which the follo | Pragyan Ojha | wrong — truncated |
| 80 | 🔴 | The following information is verifiable as of 31 December 2023:   | Jess | wrong — truncated |
| 81 | 🔴 | A paper was submitted between 2015 and 2020, analyzes tax incenti | Nasarawa State University | ERROR — HTTP 504 |
| ~~82~~ | ✅ | ~~Which company meets the following criteria?  Launched six e-learn~~ | ~~Ascendia~~ | correct |
| 83 | 🔴 | There is a true life story about a janitor who also teaches salsa | 2006: 66% | wrong — truncated |
| ~~84~~ | ✅ | ~~There are two different blog posts, both written between 2015 and~~ | ~~Ralph Bronner ~~ | correct |
| 85 | 🔴 | Rescue operations for finding a person somewhere between 2010 and | Hilal Ahmad Dar | wrong — truncated |
| ~~86~~ | ✅ | ~~Provide the full name of a certain director born between 1970 and~~ | ~~Uche Jombo Rodriguez~~ | correct |
| 87 | 🔴 | She holds an MBA and a Master’s degree, and as of 2023, she was a | Eno Ebele Jerry  | wrong — truncated |
| 88 | 🔴 | The artist released their debut album in October between 2012 and | Dina El Wedidi | wrong — truncated |
| 89 | 🔴 | In a family drama movie produced between 1999 - 2009 (inclusive), | Baghban | wrong — truncated |
| 90 | 🔴 | A former head of state of a country that has a creole as one of i | 30/07/1980 | wrong — truncated |
| 91 | 🔴 | As of December 31, 2023, I am searching for the first name of the | Ian | wrong — truncated |
| 92 | 🔴 | Give me this person's full birth name. - This person was born in  | Jacqueline Georgette Cantrelle | wrong — truncated |
| 93 | 🔴 | I’m looking for a paper that was submitted to a university before | Stephen D. Boyles | wrong — truncated |
| ~~94~~ | ✅ | ~~The player I'm looking for was named the man of the match in an i~~ | ~~Sam Curran~~ | correct |
| ~~95~~ | ✅ | ~~Please identify the fictional character who occasionally breaks t~~ | ~~Plastic Man~~ | correct |
| 96 | 🔴 | - A source, published sometime between January 1, 2008, and Decem | Amherst College | wrong — truncated |
| ~~97~~ | ✅ | ~~What is the full name name of the author who, prior to December 2~~ | ~~Ian Solomon~~ | correct |
| 98 | 🔴 | There's this popular figure with multiple Grammy awards in the en | St. John’s Health Center | ERROR — HTTP 504 |
| 99 | 🔴 | I was going through the website of one of the prestigious awards  | Avatar, 2010 | ERROR — HTTP 504 |

**Overall: 341/482 = 70.7% strict across all graded rows**



---

## Parking lot (owner-only items and next levers)

**Benchmark next levers:** (1) v258 council + constraint verification — round 7 in flight measures
it; (2) DSQA table-aware retrieval (fetch and parse the actual source tables, not snippets) — the
38-41 partials are a retrieval-depth limit; (3) FRAMES gold-conflict audit (several golds conflict
with retrievable sources — quantify dataset errors vs model errors).

**Owner-only blockers (exact steps):** broaden the fine-grained PAT (github.com/settings/
personal-access-tokens — grant the fleet repo scope), register OAuth apps for Slack/Dropbox/
Outlook/Box (api.slack.com/apps, console.dropbox.com, etc. — Connectors 58→85, +324 pts), apply the
4 SQL migrations (Supabase SQL editor, project bnxermyboeigvwonfrzx), Supabase auth_config_write
for passkeys (dashboard settings/auth), Twilio credentials (console.twilio.com — Voice 65→80),
SHMT PR #3889 approve+merge as rentspire-bspain-2 then redeploy the runner (python3 infra/fly/
spain-runner/deploy_machine.py), passkey e2e, .edu student-verify e2e (now CLOSED — live per the
Neurons session), OpenRouter auto-top-up, low-balance credit alert.

**Session record:** PR #213 (grid icons), PR #214 (v258 gateway source), PR #218 (benchmark gospel
+ enforcer), PR #219 (platform-wide gospel binding + pre-launch gate). Gateway deployed: v258
(platform 261) — constraint-verified answering + reliability council + gospel injection. Site
build marker: v250 (unchanged — no site changes). Round 7 in flight against v258.

