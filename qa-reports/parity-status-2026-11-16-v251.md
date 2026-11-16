# ai.spaincos.com — 100% Completion Parity Document (2026-11-16, v251)

## §29cu — Benchmark teardown round 3: DSQA/BrowseComp deep-dive, harness truth fixes, fast-path + deep-link survival

**Headline (computed by qa/generate-parity-headline.py): 90.4% (8858/98; 104✅ / 33🟡 / 20🔴 of 157)**

### The four benchmark scores (strict, grader v2, as of the 2026-11-16 17:05Z run — re-run in flight)

| Benchmark | Strict score | G | Y | R | Error rows (to re-run) | p50 latency |
|---|---|---|---|---|---|---|
| SimpleQA | 97.0% (64/66) | 64 | 0 | 2 | 134 (HTTP 401) | 36.9s |
| FRAMES | 76.0% (38/50) | 38 | 0 | 12 | 50 (HTTP 401) | 41.2s |
| DSQA | 34.0% (34/100) | 34 | 43 | 23 | 0 | 67.3s |
| BrowseComp | 25.6% (23/90) | 23 | 0 | 67 | 10 (504/546) | 96.6s |

### What is actually holding DSQA and BrowseComp back (root-caused, with counts)

**1. Measurement defects (fixed in this batch — the scores were understated):**
- **JWT expiry killed the runs mid-suite**: 132/200 SimpleQA rows and 48/100 FRAMES rows died as HTTP 401 (the Supabase token is minted once and expires after 1h; the runs take longer). The harness now re-mints on 401 and retries (qa/ruthless-bench.py). Both suites re-run to full n.
- **The work-log preamble polluted set grading**: the platform's "Commands executed this turn" work log is part of the answer text; for DSQA set questions the grader counted its lines as set members, deflating precision. 24 of the 43 "partials" have EVERY gold item present — they were graded partial on formatting, not on facts. The harness now strips the work-log block before grading.
- **FINAL ANSWER compliance is near zero** (SimpleQA 6/66, DSQA 28/100): the writer ignores the user's explicit "end with FINAL ANSWER: <answer>" instruction, so the grader grades the whole response. This is a real product instruction-following gap (next batch: a writer-side rule to honor explicit output-format instructions).

**2. Product defects (the real remaining gap):**
- **DSQA set aggregation (19 rows missing gold items + 8 zero-found)**: multi-hop filtered-set questions ("states that X AND Y, ordered by Z") — the same class as the FRAMES multi-hop miss; needs planner sub-queries per constraint and a final enumeration pass.
- **BrowseComp deep browsing (49 wrong-fact rows)**: multi-entity chained questions where the model binds to the wrong entity at a hop. Needs the FRAMES-style decomposition extended to BrowseComp-length chains.
- **BrowseComp truncation (14 rows)**: long answers cut mid-sentence at the token ceiling — the D4-class truncation residue.
- **BrowseComp no-citations (4 rows)** + 5 hedged/no-answer rows.

### Granular row-by-row benchmark board

Every row of every benchmark, G/Y/R with strikethrough on passing rows. Error rows are explicitly marked and re-run queued (they are NOT scored as wrong).

### SIMPLEQA: 64/66 correct — 97.0% strict — 0 Y — 2 R — 134 error rows (re-run queued)

| # | G/Y/R | Prompt | Gold | Verdict / Fail |
|---|---|---|---|---|

| ~~0~~ | ~~G~~ | ~~What were the day, month, and year of release for Aseprite v1.3?~~ | ~~27 Nov 2023~~ | ~~correct~~ |

| ~~4~~ | ~~G~~ | ~~What was the original name of the village of Berrien Springs, Michigan~~ | ~~Wolf's Prairie~~ | ~~correct~~ |

| ~~3~~ | ~~G~~ | ~~In Season 16 of The Bachelor, which contestant quit?~~ | ~~Brittney Schreiner~~ | ~~correct~~ |

| ~~2~~ | ~~G~~ | ~~What year was the municipality of Ciudad Bolívar, Antioquia, Colombia,~~ | ~~1839~~ | ~~correct~~ |

| ~~1~~ | ~~G~~ | ~~The 1972 Canadian federal budget was first presented on what day, mont~~ | ~~8 May 1972~~ | ~~correct~~ |

| ~~5~~ | ~~G~~ | ~~In which year was the municipality of Macanal, Boyacá, Colombia, found~~ | ~~1807~~ | ~~correct~~ |

| ~~6~~ | ~~G~~ | ~~In which year was Alexandra Park declared a local nature reserve?~~ | ~~2013~~ | ~~correct~~ |

| ~~8~~ | ~~G~~ | ~~What year was Türksat 2A decommissioned?~~ | ~~2016~~ | ~~correct~~ |

| ~~9~~ | ~~G~~ | ~~What is the surname of the individual who won the Faraday Lectureship ~~ | ~~Hinshelwood~~ | ~~correct~~ |

| ~~7~~ | ~~G~~ | ~~In the 2021 research paper titled "EEG-Based Driving Fatigue Detection~~ | ~~92.71%~~ | ~~correct~~ |

| ~~11~~ | ~~G~~ | ~~In what year was Alma S. Woolley awarded a doctorate in Nursing Educat~~ | ~~1980~~ | ~~correct~~ |

| ~~12~~ | ~~G~~ | ~~What month, date, and year did Tupac appear in A Different World?~~ | ~~June 24, 1993~~ | ~~correct~~ |

| ~~10~~ | ~~G~~ | ~~What was the name of the new curriculum model that Randolph College la~~ | ~~TAKE2~~ | ~~correct~~ |

| ~~14~~ | ~~G~~ | ~~What was Beloit College's Center for the Sciences renamed in 2017?~~ | ~~Marjorie and James Sanger Center for the Sciences.~~ | ~~correct~~ |

| ~~13~~ | ~~G~~ | ~~How many men competed in fencing during the 1964 Summer Olympics?~~ | ~~203~~ | ~~correct~~ |

| ~~16~~ | ~~G~~ | ~~What year did Chiharu Shiota introduce "Dialogue with Absence"?~~ | ~~2010~~ | ~~correct~~ |

| ~~18~~ | ~~G~~ | ~~What was the first year Whig politician James Vernon the Younger acted~~ | ~~1702~~ | ~~correct~~ |

| ~~20~~ | ~~G~~ | ~~What were the month and year when Telegram reached 180 million monthly~~ | ~~December 2017~~ | ~~correct~~ |

| ~~15~~ | ~~G~~ | ~~How many referees were selected from the South American Football Confe~~ | ~~6~~ | ~~correct~~ |

| ~~17~~ | ~~G~~ | ~~In what city did Ciara perform for her Beauty Marks Tour on September ~~ | ~~Puyallup~~ | ~~correct~~ |

| ~~19~~ | ~~G~~ | ~~As of the 2020 census, what was the population of the city of Fort Ogl~~ | ~~10,423~~ | ~~correct~~ |

| ~~22~~ | ~~G~~ | ~~What is the fifth track on Alec Benjamin's album, "(Un)Commentary"?~~ | ~~speakers ~~ | ~~correct~~ |

| ~~23~~ | ~~G~~ | ~~Which year was György Lukács appointed as the Hungarian Minister of Cu~~ | ~~1919~~ | ~~correct~~ |

| ~~25~~ | ~~G~~ | ~~What is the surname of the U.S. President who attended the 66th birthd~~ | ~~Eisenhower~~ | ~~correct~~ |

| ~~21~~ | ~~G~~ | ~~What is the first vampire number in recreational mathematics obtained ~~ | ~~102510~~ | ~~correct~~ |

| ~~24~~ | ~~G~~ | ~~Which day, month, and year was the second episode of Season 2 of What ~~ | ~~April 15, 2020~~ | ~~correct~~ |

| ~~26~~ | ~~G~~ | ~~Which angel is portrayed in Leonardo da Vinci's "Virgin of the Rocks"?~~ | ~~The angel Uriel.~~ | ~~correct~~ |

| ~~28~~ | ~~G~~ | ~~In what year did the Japanese mathematician Kiyosi Ito receive the Fuj~~ | ~~1985~~ | ~~correct~~ |

| ~~30~~ | ~~G~~ | ~~What was the date, month, and year when France proposed that the UN Se~~ | ~~January 14, 1991~~ | ~~correct~~ |

| ~~27~~ | ~~G~~ | ~~On which month and year did the Colombian Cardinal Pedro Rubiano say, ~~ | ~~January 2008~~ | ~~correct~~ |

| ~~29~~ | ~~G~~ | ~~In what year was the praying mantis species Eremiaphila cycloptera des~~ | ~~1939~~ | ~~correct~~ |

| ~~31~~ | ~~G~~ | ~~Who won the Paris Kanellakis Theory and Practice Award in 2000?~~ | ~~Narendra Karmarkar~~ | ~~correct~~ |

| ~~33~~ | ~~G~~ | ~~In what year was the mathematician George Andrews elected a Fellow of ~~ | ~~1997~~ | ~~correct~~ |

| ~~34~~ | ~~G~~ | ~~What day, month, and year did William II of Holland become King of Ger~~ | ~~3 October 1247~~ | ~~correct~~ |

| ~~36~~ | ~~G~~ | ~~What were Terry Kath's famously ironic last words?~~ | ~~What do you think I'm gonna do? Blow my brains out?~~ | ~~correct~~ |

| ~~32~~ | ~~G~~ | ~~How many corners did Barcelona take in the Champions League semi-final~~ | ~~3~~ | ~~correct~~ |

| ~~38~~ | ~~G~~ | ~~In a 1988 paper, which author defined Mammalia phylogenetically as the~~ | ~~Timothy Rowe~~ | ~~correct~~ |

| ~~35~~ | ~~G~~ | ~~What day, month, and year was Georgi Ivanov Peev, the Bulgarian former~~ | ~~11 March 1979~~ | ~~correct~~ |

| ~~37~~ | ~~G~~ | ~~At which art school was Will Hicok Low an instructor in 1890?~~ | ~~National Academy of Design~~ | ~~correct~~ |

| ~~39~~ | ~~G~~ | ~~What was the name of the Detroit-born medium to whom William Lyon Mack~~ | ~~Etta Wriedt~~ | ~~correct~~ |

| ~~40~~ | ~~G~~ | ~~What was the nationality of the scientists who used lasers to measure ~~ | ~~Belgian~~ | ~~correct~~ |

| ~~43~~ | ~~G~~ | ~~In TWD Season 11, Episode 10, we learn that Connie got whose uncle kic~~ | ~~Pamela Milton's uncle~~ | ~~correct~~ |

| ~~44~~ | ~~G~~ | ~~On what day, month, and year was Juan Nogueira, Brazilian amateur heav~~ | ~~1 May 1988~~ | ~~correct~~ |

| ~~45~~ | ~~G~~ | ~~Between what years did Getachew Reda complete a Master of Law at Alaba~~ | ~~2001 and 2002~~ | ~~correct~~ |

| 46 | R | From which year to which year did the Albanian politician Ibrahim Rugo | From 1976 to 1977 | wrong  answered-wrong |

| ~~41~~ | ~~G~~ | ~~What were the day, month, and year when Google introduced the native d~~ | ~~2 of January of 2019~~ | ~~correct~~ |

| ~~42~~ | ~~G~~ | ~~What is the surname of the individual who won the Linus Pauling Award ~~ | ~~Eyring~~ | ~~correct~~ |

| ~~47~~ | ~~G~~ | ~~On which game version was The International 2014 of Dota 2 played?~~ | ~~6.81b~~ | ~~correct~~ |

| ~~51~~ | ~~G~~ | ~~In what year did Nikolai Andreev win the Leelavati Award?~~ | ~~2022~~ | ~~correct~~ |

| ~~48~~ | ~~G~~ | ~~In 2014, who took over development of the Brooding language for the Ri~~ | ~~BenJamin P. Johnson~~ | ~~correct~~ |

| ~~49~~ | ~~G~~ | ~~How many stitches did John Lennon get as a result of his Aston Martin ~~ | ~~17~~ | ~~correct~~ |

| ~~52~~ | ~~G~~ | ~~What is the Swedish word for the time of night known as "the eleven ro~~ | ~~Elvavrålet~~ | ~~correct~~ |

| ~~50~~ | ~~G~~ | ~~What TV show did Kim Fields announce that she was expecting her second~~ | ~~The Real~~ | ~~correct~~ |

| ~~53~~ | ~~G~~ | ~~On what day, month, and year did Florence Farmer, a pioneer of women i~~ | ~~June 26, 1958~~ | ~~correct~~ |

| ~~56~~ | ~~G~~ | ~~For how many episodes did Gabrielle Fitzpatrick star in "Roar"?~~ | ~~1~~ | ~~correct~~ |

| ~~57~~ | ~~G~~ | ~~In what year was the Showstreet Palace Theater added to Dollywood?~~ | ~~1992~~ | ~~correct~~ |

| ~~54~~ | ~~G~~ | ~~In which month and year was Sayyid Ghulam Muhiyuddin Ahmed bin Khairud~~ | ~~November 1888~~ | ~~correct~~ |

| ~~55~~ | ~~G~~ | ~~What was the date, month, and year when Clifford Cunnell, an English c~~ | ~~5 October 2016~~ | ~~correct~~ |

| ~~58~~ | ~~G~~ | ~~What is the name of Helmut Lang's solo exhibition from 2011 in East Ha~~ | ~~Make it hard~~ | ~~correct~~ |

| ~~60~~ | ~~G~~ | ~~What was the name of the episode in which Shai appeared on Family Matt~~ | ~~Good Cop, Bad Cop~~ | ~~correct~~ |

| 59 | R | Who was the 11th Prime Minister of India? | Shri H. D. Deve Gowda | wrong  answered-wrong |

| ~~63~~ | ~~G~~ | ~~What year was the municipality of Paya, Boyacá, Colombia, founded?~~ | ~~1600~~ | ~~correct~~ |

| ~~61~~ | ~~G~~ | ~~In what year was the pink donut with sprinkles sculpture first present~~ | ~~2007~~ | ~~correct~~ |

| ~~64~~ | ~~G~~ | ~~What was the name of the MP of Red Deer, Alberta, in 1987?~~ | ~~Gordon Towers~~ | ~~correct~~ |

| ~~62~~ | ~~G~~ | ~~Give the full name of Rana Ayyub's father (an Indian journalist).~~ | ~~Mohammad Ayyub Waqif~~ | ~~correct~~ |

| ~~65~~ | ~~G~~ | ~~In which month and year did WhatsApp start rolling out support for thi~~ | ~~March 2021~~ | ~~correct~~ |

| 66 | R | In Horizon Zero Dawn's Frozen Wilds DLC, what is CYAN an acronym? | Caldera of Yellowstone Analytic Nexus | ERROR HTTP 0 — re-run |

| 69 | R | The Persina Nature Park in Bulgaria was originally established on what | December 4, 2000. | ERROR HTTP 0 — re-run |

| 70 | R | Who was the recipient of the ISCB Accomplishment by a Senior Scientist | Michael Waterman | ERROR HTTP 401 — re-run |

| 67 | R | According to Hinduism, which planet is associated with Yamraj? | Pluto | ERROR HTTP 401 — re-run |

| 68 | R | What year did the Lego part with ID gal56 first release? | 2002 | ERROR HTTP 401 — re-run |

| 71 | R | What year were the guidelines outlining requirements for the inclusion | 2015 | ERROR HTTP 401 — re-run |

| 74 | R | On what day, month, and year did the 2nd ASEM Environment Ministers' M | October 12, 2003 | ERROR HTTP 401 — re-run |

| 73 | R | In which year was Prof. H. U. Hamidi appointed as Vice Chancellor of t | 1990 | ERROR HTTP 401 — re-run |

| 75 | R | Which lake in Kashmir is connected to the Khushal Sar and Gil Sar lake | Nigeen Lake | ERROR HTTP 401 — re-run |

| 72 | R | Give the name of the Kashmiri dish in which mutton intestines are flav | Methi Maaz. | ERROR HTTP 401 — re-run |

| 76 | R | In which U.S. state was painter Davyd Whaley born? | Tennessee | ERROR HTTP 401 — re-run |

| 78 | R | What is the name of the multituberculate mammal of early Paleocene (Pu | Taeniolabis taoensis | ERROR HTTP 401 — re-run |

| 77 | R | Which valley is known as the "Golden Crown of Kashmir"? | Breng Valley | ERROR HTTP 401 — re-run |

| 79 | R | In which country did Jean-Christophe Yoccoz do his military service? | Brazil | ERROR HTTP 401 — re-run |

| 80 | R | In what year was Peicho Peev the Bulgarian chess International Master? | 1973 | ERROR HTTP 401 — re-run |

| 81 | R | What was the original name of Forthton, Ontario, located north of Broc | Stone's Corner | ERROR HTTP 401 — re-run |

| 82 | R | On which day, month, and year was the RS-1 satellite launched from the | 18 July 1980 | ERROR HTTP 401 — re-run |

| 84 | R | What exhibit was displayed in the TD Gallery at the Toronto Reference  | Vice & Virtue | ERROR HTTP 401 — re-run |

| 85 | R | Specify the day, month, and year Canon introduced two new UHDgc 2/3-in | April 2, 2019 | ERROR HTTP 401 — re-run |

| 86 | R | Who played Sarah Robinson in "Felicity" Season 4, Episode 4? | Monica | ERROR HTTP 401 — re-run |

| 87 | R | What prize did De Broglie win in 1952? | Kalinga Prize. | ERROR HTTP 401 — re-run |

| 83 | R | What was Zero Bridge originally nicknamed in Srinagar, Kashmir? | Zorr Bridge | ERROR HTTP 401 — re-run |

| 89 | R | Which hotel was awarded World's Leading Adventure Hotel 2022? | Pikaia Lodge | ERROR HTTP 401 — re-run |

| 91 | R | What was the original name of the show that conductor David Randolph h | Music for the Connoisseur | ERROR HTTP 401 — re-run |

| 90 | R | What quote did Dr. Richard Trager say to Miles Upshur while opening th | I'm not giving up on you | ERROR HTTP 401 — re-run |

| 88 | R | Which glacier is known as the "Third Pole"? | The Siachen Glacier | ERROR HTTP 401 — re-run |

| 92 | R | What is the name of the Dutch businessman and convicted drug trafficke | Rudi Dekkers | ERROR HTTP 401 — re-run |

| 93 | R | What's the notion to which the lexical semantic map in Figure 4 of the | breathe | ERROR HTTP 401 — re-run |

| 95 | R | Who among the people who proposed the three-stage system in an article | Clarence van Riet Lowe | ERROR HTTP 401 — re-run |

| 94 | R | What language is represented in Figure 4 of the paper "Identifying Sem | Zenzontepec Chatino | ERROR HTTP 401 — re-run |

| 97 | R | Who was awarded the Oskar Kokoschka Prize in 1998? | Maria Lassnig | ERROR HTTP 401 — re-run |

| 98 | R | Which hill station is known as "The Gateway to Ladakh"? | Dras | ERROR HTTP 401 — re-run |

| 96 | R | In which Chechen village was journalist Anna Politkovskaya detained in | Khatuni. | ERROR HTTP 401 — re-run |

| 100 | R | Which president had a meeting with Kwame Nkrumah right before the Kulu | Maurice Yameogo | ERROR HTTP 401 — re-run |

| 102 | R | What day, month, and year did the singer and actress Vanessa Hudgens m |  2 December 2023 | ERROR HTTP 401 — re-run |

| 101 | R | What is the forest cover area of Uttarakhand in square kilometers acco |  24,303.04 | ERROR HTTP 401 — re-run |

| 99 | R | As of 2021, who is the host of The Doers Nepal podcast? | Anup Ghimire | ERROR HTTP 401 — re-run |

| 103 | R | In the show Severance, who is the eighth CEO of Lumon Industries? | James Eagan | ERROR HTTP 401 — re-run |

| 105 | R | On what day, month, and year did Olton Willem van Genderen, a Suriname | November 9, 1990 | ERROR HTTP 401 — re-run |

| 107 | R | What is the height of the Space Shuttle Atlantis in meters? | 17.2 meters | ERROR HTTP 401 — re-run |

| 104 | R | What is the surname of the individual who won the Polanyi Medal for ou | Casavecchia | ERROR HTTP 401 — re-run |

| 108 | R | On what day, month, and year did Bruno Kreisky (an Austrian social dem | April 23, 1942 | ERROR HTTP 401 — re-run |

| 106 | R | What patch for the original PS3 Dark Souls added 3 Humanities to the F | 1.06 | ERROR HTTP 401 — re-run |

| 109 | R | Which scientist received the Penrose Medal before the year Preston Erc | Francis J. Pettijohn | ERROR HTTP 401 — re-run |

| 110 | R | On what day, month, and year was John II of France coronated as King o | 26 September 1350 | ERROR HTTP 401 — re-run |

| 112 | R | In Table 2 in the Transformer paper (2017), which two languages did th | German and French | ERROR HTTP 401 — re-run |

| 111 | R | What is the name of the dedicated infrared flash used to project invis | Flood Illuminator | ERROR HTTP 401 — re-run |

| 113 | R | From what year to what year was David Lloyd Wolper, born in 1928, marr | 1953-1955 | ERROR HTTP 401 — re-run |

| 114 | R | As of the 2020 Census, what was the population of Grand Mound, Iowa? | 615 | ERROR HTTP 401 — re-run |

| 116 | R | What was the title of the journal that Charles Raymond Perrault served | Artificial Intelligence | ERROR HTTP 401 — re-run |

| 118 | R | What team finished with 38 points at the end of the 2021-2022 Premier  | Leeds United | ERROR HTTP 401 — re-run |

| 115 | R | How many busts of Pope Paul V did Gian Lorenzo Bernini make? | 2 | ERROR HTTP 401 — re-run |

| 117 | R | What is the rate of climb, in feet per minute, of the Agusta A.106 rot | 1,220 ft/min | ERROR HTTP 401 — re-run |

| 120 | R | In which year, month, and day was the Nokia 8110 announced? | 9 September 1996 | ERROR HTTP 401 — re-run |

| 119 | R | To which academic society was computer scientist Sarita Vikram Adve el | The American Academy of Arts and Sciences. | ERROR HTTP 401 — re-run |

| 121 | R | On what day, month, and year was Harbhajan Singh Rissam (an Indian int | 14 May 2011 | ERROR HTTP 401 — re-run |

| 122 | R | Who won the 2015 Maine State Pumpkin and Squash Weigh-Off, held at the | Edwin Pierpont | ERROR HTTP 401 — re-run |

| 124 | R | What is the forest cover area of Karnataka in square kilometers accord |  38,575.48 | ERROR HTTP 401 — re-run |

| 123 | R | What day, month, and year did Lisa Marie Presley die? | 12 January 2023  | ERROR HTTP 401 — re-run |

| 125 | R | What day, month, and year was Edward Ambrose Hug, the American Major L | July 14, 1880 | ERROR HTTP 401 — re-run |

| 126 | R | What watch company made the world's first computerized diver's watch? | Seiko | ERROR HTTP 401 — re-run |

| 127 | R | In which city in Pakistan did Bahria Town (Private) Limited establish  | Lahore | ERROR HTTP 401 — re-run |

| 129 | R | In which year was Arthur C. Wade, an American lawyer in the 1800s and  | 1877 | ERROR HTTP 401 — re-run |

| 130 | R | With whom did Ada Lovelace and her mother attend one of Charles Babbag | Mary Somerville | ERROR HTTP 401 — re-run |

| 131 | R | Who founded the municipality of Sora, Boyacá, Colombia? | Tomás Gualba Castellanos | ERROR HTTP 401 — re-run |

| 128 | R | Which year was Bil Keane's first syndicated strip, Channel Chuckles, l | 1954 | ERROR HTTP 401 — re-run |

| 133 | R | What candidate in Season 11 of The Bachelorette was an amateur sex coa | Shawn Evans | ERROR HTTP 401 — re-run |

| 132 | R | What is the surname of the individual who was awarded the Francis P. G | Pickett | ERROR HTTP 401 — re-run |

| 134 | R | Cornelia Parker curated the "Black and White Room" for which exhibitio | Royal Academy Summer Exhibition | ERROR HTTP 401 — re-run |

| 135 | R | During which years did Margaret Hamburg work as a clinical instructor  | 1986 to 1990 | ERROR HTTP 401 — re-run |

| 137 | R | What is the Edo name of the crown traditionally worn by the Iyoba (Que | ukpe-okhue | ERROR HTTP 401 — re-run |

| 138 | R | What is the name of the voice actor who voices Alvina in the game Dark | Ève Karpf | ERROR HTTP 401 — re-run |

| 139 | R | In what year were double-digit vehicle codes introduced in Japan for t | 1967 | ERROR HTTP 401 — re-run |

| 136 | R | What was the name of the journal that Gloria Niemeyer Francke was the  | American Journal of Hospital Pharmacy | ERROR HTTP 401 — re-run |

| 140 | R | Who was the voice of Colonel Drucker in the Medal of Honor (2010) vide | Adrian Holmes | ERROR HTTP 401 — re-run |

| 142 | R | What year was the municipality of Anorí, Antioquia, Colombia, founded? | 1808 | ERROR HTTP 401 — re-run |

| 141 | R | What is the name of the Brazilian entomologist who first described the | Ubirajara Martins | ERROR HTTP 401 — re-run |

| 144 | R | Which mathematician received the Chern Medal in 2022? | Barry Mazur | ERROR HTTP 401 — re-run |

| 146 | R | What was Janice Burgess's alma mater? | Brandeis University | ERROR HTTP 401 — re-run |

| 147 | R | What health crisis did Bob Barker experience on May 30, 2022? | Stroke | ERROR HTTP 401 — re-run |

| 145 | R | What day, month, and year was Aniello Formisano, an Italian politician | June 10, 1954. | ERROR HTTP 401 — re-run |

| 143 | R | In which month and year did Apollo 14 pilot Edgar Mitchell and Apollo  | March 2011 | ERROR HTTP 401 — re-run |

| 149 | R | In what year did the mathematician Joachim Neubüser graduate from the  | 1957 | ERROR HTTP 401 — re-run |

| 150 | R | To whom was R. C. Harvey married? | Linda Kubicek | ERROR HTTP 401 — re-run |

| 148 | R | How many days was Kaitlin Armstrong on the run from authorities for ki | 43 | ERROR HTTP 401 — re-run |

| 151 | R | Who finished 14th in the 2021–22 Premier League season? | Aston Villa | ERROR HTTP 401 — re-run |

| 154 | R | In 2015, in what exhibition was Henry Ossawa Tanner's work included? | We Speak: Black Artists in Philadelphia, 1920s-1970s | ERROR HTTP 401 — re-run |

| 152 | R | What is the MD5 checksum of the file named "ffrelay-debian-4.30.ggi.zi | 180caf23dd71383921e368128fb6db52 | ERROR HTTP 401 — re-run |

| 153 | R | What month and year was the "Bust of Charles I" by Gian Lorenzo Bernin | January 1698 | ERROR HTTP 401 — re-run |

| 155 | R | Domenico Lino Morichini first examined the fossilized tooth of what ty | Elephant | ERROR HTTP 401 — re-run |

| 156 | R | Who was the Brazilian Vice-President of the International Mathematical | Marcelo Viana | ERROR HTTP 401 — re-run |

| 157 | R | What is the half-life of radon-224 in hours? | 1.8 | ERROR HTTP 401 — re-run |

| 159 | R | In which year was the John Brophy Award first awarded? | 1989 | ERROR HTTP 401 — re-run |

| 158 | R | What is the full name of the singer who sang the song 'Angels' with Ro | Aida Emilevna Garifullina | ERROR HTTP 401 — re-run |

| 160 | R | What year did Rosemarie Trockel start to use industrial knitting machi | 1985 | ERROR HTTP 401 — re-run |

| 161 | R | Who was the first-ever personality to hoist the Indian National Flag i | Adil Hussain | ERROR HTTP 401 — re-run |

| 163 | R | How many chimpanzees were observed with cold-like symptoms when the re | 14 | ERROR HTTP 401 — re-run |

| 162 | R | What year did Ollie Johnston sell his locomotive named Marie E.? | 1993 | ERROR HTTP 401 — re-run |

| 164 | R | What is the surname of the individual who won the Bioinorganic Chemist | Cowan | ERROR HTTP 401 — re-run |

| 165 | R | In which school did Ghana's former minister Kwadwo Baah-Wiredu start h | Kumasi High School | ERROR HTTP 401 — re-run |

| 166 | R | In what year did Aftab Ghulam Nabi Kazi's (12th Deputy Chairman of the | 2009 | ERROR HTTP 401 — re-run |

| 167 | R | What month and year were the Opuke Thermal Pools & Spa opened in Methv | November 2021 | ERROR HTTP 401 — re-run |

| 168 | R | Where was the body of Stuart Leary, a South African sportsman who play | Table Mountain, South Africa | ERROR HTTP 401 — re-run |

| 170 | R | Which English singer was a film and television critic for The Observer | George Melly | ERROR HTTP 401 — re-run |

| 172 | R | How many minutes and seconds did it take Indian swimmer Vedaant Madhav | 16:01.73 seconds | ERROR HTTP 401 — re-run |

| 169 | R | Which contestant from Season 2 of The Bachelor was a former NBA cheerl | Lori Todd | ERROR HTTP 401 — re-run |

| 173 | R | In which month and year did "Flying" magazine publish "Battling the Bi | March 2001 | ERROR HTTP 401 — re-run |

| 171 | R | In what year did John Lennon and Yoko Ono donate their psychedelic Rol | 1977 | ERROR HTTP 401 — re-run |

| 174 | R | In which year was the municipality of La Pintada, Antioquia, Colombia, | 1815 | ERROR HTTP 401 — re-run |

| 175 | R | How many UN Volunteers served in 54 United Nations missions, agencies, |  8,282 | ERROR HTTP 401 — re-run |

| 177 | R | Which player character in Exandria Unlimited: Calamity was Sam Riegel' | Laerryn Coramar-Seelie, played by Aabria Iyengar | ERROR HTTP 401 — re-run |

| 178 | R | What is the name of the college from where Dr. Farooq Abdullah, a poli | SMS Medical College, Jaipur | ERROR HTTP 401 — re-run |

| 179 | R | At what age did Wiley Lee Griggs III, an American Negro league infield | 71 | ERROR HTTP 401 — re-run |

| 176 | R | Who was the first President of the Supreme Court of Bolivia? | Manuel María Urcullo. | ERROR HTTP 401 — re-run |

| 180 | R | In Season 3 of the American version of "The Circle," in which episode  | 7 | ERROR HTTP 401 — re-run |

| 181 | R | What is the third vampire number in recreational mathematics? | 1435 | ERROR HTTP 401 — re-run |

| 182 | R | What was the height, in meters, of Damian Lamonte Ollie Lillard Sr. (D | 1.65 | ERROR HTTP 401 — re-run |

| 183 | R | From 1855 to 1859, James Luke Prendergast (1800-1895) served as Libera | Harbour Grace | ERROR HTTP 401 — re-run |

| 184 | R | From what university did John P. Sall receive an honorary doctorate in |  North Carolina State University | ERROR HTTP 401 — re-run |

| 185 | R | What were the month and year when the Indonesian Food and Drug Authori | August 2022 | ERROR HTTP 401 — re-run |

| 186 | R | Who was the 14th Chief Justice of Kenya? | David Kenani Maraga | ERROR HTTP 401 — re-run |

| 187 | R | Which year was the non-profit organization Prayas Nepal established? | 2003 | ERROR HTTP 401 — re-run |

| 188 | R | In which year did Jacinda Kate Laurell Ardern receive a Harvard honora | 2022 | ERROR HTTP 401 — re-run |

| 189 | R | What was the economy rate of S. N. Thakur per over in the match betwee | 13.00	 | ERROR HTTP 401 — re-run |

| 190 | R | How many children did Gilbert Hani and Mary Hani have? | 6 | ERROR HTTP 401 — re-run |

| 192 | R | What year did Louis de Broglie become a professor of theoretical physi | 1928 | ERROR HTTP 401 — re-run |

| 193 | R | What are the season number, episode number, and title of the "Vikings" | Season 2, Episode 2 "Invasion" | ERROR HTTP 401 — re-run |

| 191 | R | What day, month, and year did the Türksat 1A satellite explode before  | 24 January 1994 | ERROR HTTP 401 — re-run |

| 195 | R | What month, day, and year did the Durban-based shack-dwellers' movemen | 14 May 2009 | ERROR HTTP 401 — re-run |

| 196 | R | How many inductees did the American Classical Hall of Fame have in 200 | One. | ERROR HTTP 401 — re-run |

| 197 | R | Who was the 2022 winner of "Best Just Chatting Streamer" at The Stream | Mizkif | ERROR HTTP 401 — re-run |

| 194 | R | Who adopted Jett Williams in 1954? | Lillie Williams Stone | ERROR HTTP 401 — re-run |

| 198 | R | In what year was Eugenius Aristides Nisbet elected to the Georgia Hous | 1827 | ERROR HTTP 401 — re-run |

| 199 | R | What is the name of the astronomer who discovered 216433 Milianleo in  | Erwin Schwab | ERROR HTTP 401 — re-run |



### FRAMES: 38/50 correct — 76.0% strict — 0 Y — 12 R — 50 error rows (re-run queued)

| # | G/Y/R | Prompt | Gold | Verdict / Fail |
|---|---|---|---|---|

| 3 | R | Regarding the award that the man who created the initial sketch for th | Eight | wrong  answered-wrong |

| ~~2~~ | ~~G~~ | ~~What primate species, known for its large population in China and pres~~ | ~~Rhesus Macaques~~ | ~~correct~~ |

| ~~4~~ | ~~G~~ | ~~Who was the youngest climber to podium at the first year climbing was ~~ | ~~Alberto Ginés López (18 at the time).~~ | ~~correct~~ |

| ~~1~~ | ~~G~~ | ~~How many letters were in the name of the first single by the artist wh~~ | ~~12~~ | ~~correct~~ |

| ~~0~~ | ~~G~~ | ~~Who was Prime Minister in Australia at the same time that Norman Gunst~~ | ~~Malcolm Fraser~~ | ~~correct~~ |

| ~~6~~ | ~~G~~ | ~~As of August 3rd 2024, what's the name of the university in the city r~~ | ~~Eastern Michigan University~~ | ~~correct~~ |

| 5 | R | If you were to combine two words, the first of which has a species cal | Russia | wrong  answered-wrong |

| 9 | R | I am thinking of a movie where Hans Zimmer won a Grammy Award for his  | Crimson Tide | wrong  answered-wrong |

| ~~11~~ | ~~G~~ | ~~Who was the successor of the Egyptian Pharaoh that was in power when t~~ | ~~Merneptah~~ | ~~correct~~ |

| 7 | R | What team scored the most points in an NBA finals game while Ronald Re | Game 1 of the Finals in 1985 the Boston Celtics scored 148 points. | wrong  answered-wrong |

| 8 | R | What was the military rank of the employer of the astronomer who disco | Major General was the rank of Thomas Brisbane. | wrong  answered-wrong |

| 10 | R | Which American high school can boast of an alumnus for whom the follow | Kathleen Senior High School in Lakeland, Florida | wrong  answered-wrong |

| ~~14~~ | ~~G~~ | ~~What was the age difference at their deaths (in years) between Edgar A~~ | ~~200~~ | ~~correct~~ |

| ~~12~~ | ~~G~~ | ~~What was the 2021 population of the birthplace of the leader of the pa~~ | ~~9,162 was the population of Shaftesbury (the birthplace of Charles Fox~~ | ~~correct~~ |

| ~~16~~ | ~~G~~ | ~~The Wisconsin Butter Fire led to dams being built to protect a lake th~~ | ~~Otis Redding~~ | ~~correct~~ |

| ~~17~~ | ~~G~~ | ~~As of 1st August 2024 Queens of the Stone Age, Them Crooked Vultures, ~~ | ~~Man~~ | ~~correct~~ |

| ~~15~~ | ~~G~~ | ~~How many years apart did a Kim Jong Un impersonator who was interviewe~~ | ~~60~~ | ~~correct~~ |

| ~~13~~ | ~~G~~ | ~~What teammates were inducted into the college football hall of fame wh~~ | ~~ Gus Welch, and William "Lone Star" Dietz.~~ | ~~correct~~ |

| 21 | R | What song was #1 on Billboard's Hot 100 for the most days during the C | Monster Mash' by Bobby 'Boris' Pickett & the Crypt-Kickers | wrong  answered-wrong |

| 19 | R | As of August 3rd 2024, how many countries are full members of the coun | 12 | wrong  answered-wrong |

| ~~20~~ | ~~G~~ | ~~Who was the winner of Tour de France the same year that a major catast~~ | ~~Louison Bobet~~ | ~~correct~~ |

| ~~23~~ | ~~G~~ | ~~Of the four main characters on Seinfeld, which actor is the oldest?~~ | ~~Michael Richards~~ | ~~correct~~ |

| ~~24~~ | ~~G~~ | ~~Concerning the 2007 book by Sofi Oksanen, the novel was described as "~~ | ~~1872~~ | ~~correct~~ |

| ~~22~~ | ~~G~~ | ~~What Volkswagen former car model has nearly the same name as a Bangkok~~ | ~~Scirocco (The Bangkok restaurant is called Sirocco)~~ | ~~correct~~ |

| ~~25~~ | ~~G~~ | ~~How old was the author of Dragon Ball when the manga was first release~~ | ~~29~~ | ~~correct~~ |

| ~~18~~ | ~~G~~ | ~~On the same day Roald Dahl first published a work, a famous guitar pla~~ | ~~Duane Allman~~ | ~~correct~~ |

| ~~28~~ | ~~G~~ | ~~Which of these series was published earliest? Wedding Peach, Tokyo Mew~~ | ~~Sailor Moon~~ | ~~correct~~ |

| ~~26~~ | ~~G~~ | ~~When Justin Trudeau was elected as Prime Minister of Canada, who was t~~ | ~~Manuel Valls~~ | ~~correct~~ |

| ~~30~~ | ~~G~~ | ~~When Metallica released its album "Master of Puppets," how old were fo~~ | ~~22~~ | ~~correct~~ |

| ~~31~~ | ~~G~~ | ~~Where did the daughter of the winner of the first US presidential elec~~ | ~~George Washington University~~ | ~~correct~~ |

| ~~29~~ | ~~G~~ | ~~As of August 5, 2024, what is the name of the federal law that was fou~~ | ~~The Sherman Antitrust Act~~ | ~~correct~~ |

| ~~33~~ | ~~G~~ | ~~How many Pokemon World Championships occurred in the contiguous United~~ | ~~- Five Pokemon World Championships took place in the contiguous United~~ | ~~correct~~ |

| ~~34~~ | ~~G~~ | ~~Out of all of the feature-length theatrical films that John Carpenter ~~ | ~~Starman (1984)~~ | ~~correct~~ |

| ~~27~~ | ~~G~~ | ~~Who was the building named after on South Forest Avenue, which was bui~~ | ~~Grady Gammage~~ | ~~correct~~ |

| ~~32~~ | ~~G~~ | ~~A Japanese aircraft carrier that was first built to become a luxury oc~~ | ~~The aircraft carrier Hiyō was sunk in the Battle of the Philippine Sea~~ | ~~correct~~ |

| ~~37~~ | ~~G~~ | ~~Which 2024 college/university president has a degree from Harvard Univ~~ | ~~Eli Capilouto~~ | ~~correct~~ |

| ~~38~~ | ~~G~~ | ~~What William Wyler movie debuted the same year that the chairman for t~~ | ~~Jezebel~~ | ~~correct~~ |

| ~~36~~ | ~~G~~ | ~~According to the population data in their respective Wikipedia article~~ | ~~84,512~~ | ~~correct~~ |

| ~~39~~ | ~~G~~ | ~~As of August 1, 2024, if you add together the age of Ana Ollo Hualde a~~ | ~~100 (59 + 76) - 35~~ | ~~correct~~ |

| ~~40~~ | ~~G~~ | ~~This founder of the Academy of Science, St. Louis became established a~~ | ~~Cuscuta~~ | ~~correct~~ |

| ~~41~~ | ~~G~~ | ~~In the same year that HMS Holland 1 was launched, a British monarch di~~ | ~~6 years, 11 months, 25 days.~~ | ~~correct~~ |

| 35 | R | Baldur's Gate 3 was released in 2023 and the game and its staff have r | 57 years old | wrong  answered-wrong |

| ~~42~~ | ~~G~~ | ~~How many Red Hot Chili Peppers albums were released while Nelson Mande~~ | ~~4~~ | ~~correct~~ |

| 43 | R | Fossils of the extinct sea snail, Alvania belgica, were originally fou | City of Brussels | wrong  answered-wrong |

| ~~44~~ | ~~G~~ | ~~How many countries were part of the commonwealth on the date Prince Ch~~ | ~~On 8 September 2022, there were 56 countries as part of the Commonweal~~ | ~~correct~~ |

| 45 | R | What is the difference in mean flow rate (in cubic feet per second) be | 75.5 cubic ft/s | wrong  answered-wrong |

| ~~49~~ | ~~G~~ | ~~Mary Gaulden Jagger worked in the Biology Division of the Oak Ridge Na~~ | ~~Frontier, 2022~~ | ~~correct~~ |

| ~~48~~ | ~~G~~ | ~~How many of Ron Hutchinson's teams won League Championships while he w~~ | ~~Of the six hockey teams that Hutchinson played on during his career, t~~ | ~~correct~~ |

| ~~47~~ | ~~G~~ | ~~In the year that the film 'Moana' was released, who was the hitting co~~ | ~~Ty Van Burkleo~~ | ~~correct~~ |

| 46 | R | Who was the Argentinian president who resigned from the position the s | Pedro Ramírez | wrong  answered-wrong |

| 52 | R | How many of Mark Calaway's consecutive Wrestlemania wins occurred in m | Five | ERROR HTTP 0 — re-run |

| 53 | R | What is the shortest possible abbreviation in the United States for th | R | ERROR HTTP 0 — re-run |

| 54 | R | If Anastasia Romanov had still been alive when the 90s cartoon movie b | Duchess Anastasia Romanov would have been 96 years old. | ERROR HTTP 401 — re-run |

| 51 | R | How old was Harvard University, when the person whom the longest river | 140 years old. | ERROR HTTP 401 — re-run |

| 55 | R | How many years had the station that preceded the Salthill and Monkstow | 143 years | ERROR HTTP 401 — re-run |

| 50 | R | What lasted longer: the reign of Queen Elizabeth II or the life of Jul | The reign of Queen Elizabeth II | ERROR HTTP 401 — re-run |

| 57 | R | What is the percentage increase of total deaths of Japanese during Wor | 66409.3% increase | ERROR HTTP 401 — re-run |

| 58 | R | Which Pope served the longest between the Battle of the Milvian Bridge | St. Sylvester I, whose Latin name was Silvester | ERROR HTTP 401 — re-run |

| 59 | R | I'm trying to show my daughter some of the movies I grew up with. Ther | *She's All That* | ERROR HTTP 401 — re-run |

| 56 | R | Which member of the Wu-Tang Clan was born on Staten Island? | Ghostface Killah | ERROR HTTP 401 — re-run |

| 60 | R | If the author of the philosophical magnum opus Being and Time were to  | Martin Gilbert Sartre | ERROR HTTP 401 — re-run |

| 61 | R | What geographical commonality do the person who first described Aprion | They were both born in Vienna. | ERROR HTTP 401 — re-run |

| 62 | R | Who was the Mayor of Quincy, Massachusetts when the Quincy Medical Cen | Henry O. Fairbanks and Thomas P. Koch | ERROR HTTP 401 — re-run |

| 63 | R | The female of the pair who have been called "the worst guests in 'Belo | Jake Pavelka | ERROR HTTP 401 — re-run |

| 67 | R | Mass Effect 2 once won the D.I.C.E. Award for Game of the Year. Who wa | Martin Hollis | ERROR HTTP 401 — re-run |

| 64 | R | I grew up in a village on Long Island in the Town of Oyster Bay. The n | Sea Cliff Elementary School | ERROR HTTP 401 — re-run |

| 65 | R | Which country did tennis' first Golden Slam winner represent when they | West Germany | ERROR HTTP 401 — re-run |

| 66 | R | Who is the Formula One driver who won their first Driver's Championshi | Nigel Mansell, Williams Grand Prix Engineering, 15 years | ERROR HTTP 401 — re-run |

| 68 | R | What are the first three letters of the capital city of the country wh | Cop | ERROR HTTP 401 — re-run |

| 70 | R | What's the star sign of the author of A Court of Thorns and Roses? | Pisces | ERROR HTTP 401 — re-run |

| 69 | R | The latest game, as of August 4, 2024, from the creator of Kirby won a | The Last of Us Part II | ERROR HTTP 401 — re-run |

| 73 | R | What is the scientific name of an amphibian that is listed as endanger | Ambystoma texanum | ERROR HTTP 401 — re-run |

| 71 | R | The Assistant to the Regional Manager on The Office TV show (US versio | Betanin | ERROR HTTP 401 — re-run |

| 72 | R | Who was the character in the roster of the Marvel vs. Capcom entry tha | Jill Valentine | ERROR HTTP 401 — re-run |

| 74 | R | How many years apart were the Canadian Museum of History and the Natio | 24 years | ERROR HTTP 401 — re-run |

| 75 | R | What is the the sum of the ages of the men who were executed by firing | 80 | ERROR HTTP 401 — re-run |

| 76 | R | The author of the book "A Good Woman"'s author was married to a man in | Breast and skin | ERROR HTTP 401 — re-run |

| 77 | R | Joel Oshiro Dyck played professional ice hockey for three teams. Which | Joel Oshiro Dyck played for the Chatham Wheels, the Wheeling Thunderbi | ERROR HTTP 401 — re-run |

| 78 | R | If an Ixodes scapularis tick in its nymph stage feeds on a host in the | Two seasons. | ERROR HTTP 401 — re-run |

| 79 | R | What movie won the Academy Award for Best Picture the same year that A | The Deer Hunter | ERROR HTTP 401 — re-run |

| 80 | R | What is an animal that is distantly related to the capybara and has th | Chinchilla | ERROR HTTP 401 — re-run |

| 81 | R | How many years apart was the founding of Snell & Wilmer from the birth | 16 years | ERROR HTTP 401 — re-run |

| 82 | R | How many of Hitler's three couriers of his last will and other politic | 1 | ERROR HTTP 401 — re-run |

| 85 | R | When Taylor Swift first released her studio album "1989," how many stu | 4 | ERROR HTTP 401 — re-run |

| 86 | R | In which year did the 4th Sheriff of Yorkshire to be part of the House | 1190 | ERROR HTTP 401 — re-run |

| 83 | R | Give me the difference in time, measured in hours not days, between th | 2128 hours | ERROR HTTP 401 — re-run |

| 84 | R | What was the word that featured the least in the longest recorded quot | You | ERROR HTTP 401 — re-run |

| 88 | R | What band had a male lead singer born on the day Mohammad Mosaddegh an | Kool & the Gang | ERROR HTTP 401 — re-run |

| 89 | R | As of 1 August 2024, How many more seasons did Outrageous Fortune have | 1 | ERROR HTTP 401 — re-run |

| 90 | R | What was the age difference between the inventor of Barbie and the inv | 6 months and 26 days. | ERROR HTTP 401 — re-run |

| 91 | R | Little River Canyon National Preserve has three waterfalls, one of whi | 2,452 ft | ERROR HTTP 401 — re-run |

| 87 | R | A disease that had millions of dollars raised for on April 20, 1992, w | 1981 | ERROR HTTP 401 — re-run |

| 92 | R | Two famous modernist writers were born and died on the same year. Who  | Virginia Woolf and James Joyce. Virginia Woolf lived 82 days longer. | ERROR HTTP 401 — re-run |

| 93 | R | Of all states within New England in the United States, which had a pop | Of the 6 states within New England, Maine, New Hampshire, and Rhode Is | ERROR HTTP 401 — re-run |

| 94 | R | What popular ice cream dessert shares its birthplace with Fred Rogers? | The Banana Split | ERROR HTTP 401 — re-run |

| 95 | R | What was the former name of the brand of sneakers worn by the Heaven's | Blue Ribbon Sports Inc. | ERROR HTTP 401 — re-run |

| 97 | R | What is the middle name of the U.S. president who died on the same day | David | ERROR HTTP 401 — re-run |

| 96 | R | In the Eurovision Song Contest 2024, one country scored a combined tot | Italy and Norway | ERROR HTTP 401 — re-run |

| 99 | R | I'm thinking of a painting. It was done by the same man who painted Th | Mock Election | ERROR HTTP 401 — re-run |

| 98 | R | What is the birth date of the person picked right after Lee Vaughn in  | August 24, 1974 | ERROR HTTP 401 — re-run |



### DSQA: 34/100 correct — 34.0% strict — 43 Y — 23 R — 0 error rows (re-run queued)

| # | G/Y/R | Prompt | Gold | Verdict / Fail |
|---|---|---|---|---|

| 3 | Y | Out of the states that had all of their electoral votes in the 2020 pr | Alabama, Arkansas, Indiana, Kansas, Kentucky, Louisiana, Mississippi,  | partial set 11/13 answered-wrong |

| 0 | Y | I want to start a farm and am trying to find the best state for it usi | Oklahoma, Kansas, Texas | partial set 2/3 answered-wrong |

| ~~4~~ | ~~G~~ | ~~According to NOAA's Billion-Dollar Weather and Climate Disasters repor~~ | ~~Northwest, Central, Eastern Winter Storm and Cold Wave February 2021~~ | ~~correct~~ |

| 5 | R | Using the year 2022, what are the capitals of the two states with the  | Baton Rouge, Columbia | wrong set 0/2 answered-wrong |

| 1 | Y | Out of the EU countries (as of 2024) that were in the "top 10 of overs | France, Germany, Netherlands | partial set 3/3 answered-wrong |

| ~~2~~ | ~~G~~ | ~~Assess the following counties in Tennessee: Anderson, Cheatham, and Da~~ | ~~Anderson County~~ | ~~correct~~ |

| ~~9~~ | ~~G~~ | ~~I'm travelling on the South Western Railway service from Shepperton to~~ | ~~Kingston~~ | ~~correct~~ |

| ~~7~~ | ~~G~~ | ~~I'm doing a comparison on African economies for my development studies~~ | ~~South Africa~~ | ~~correct~~ |

| 8 | R | Out of the countries with both an above-average homicide rate and an a | Haiti | wrong  answered-wrong |

| ~~6~~ | ~~G~~ | ~~For the year ended December 31, 2022, calculate Philip Morris Internat~~ | ~~1) Turning Point Brands, Inc. 2) Altria Group, Inc. 3) Philip Morris I~~ | ~~correct~~ |

| 11 | Y | Based on the "Immigrants to Japan: Where did they move from?" data fro | Brazil, Argentina, Bolivia, Peru, Nigeria | partial set 4/5 answered-wrong |

| 12 | R | Among the University of Tennessee at Knoxville, the University of Nort | ANTH 190 (Special Topics in Anthropology I) | wrong  answered-wrong |

| ~~10~~ | ~~G~~ | ~~According to global5050.org COVID-19 Sex-Disaggregated Data Tracker, a~~ | ~~ICU Admissions~~ | ~~correct~~ |

| 14 | Y | Which of the 6 winners of the Young Investigator Award for the Flux So | Damien Fair, Leah Somerville, Eva Telzer, Dylan Gee, Kate Mills | partial set 4/5 answered-wrong |

| 13 | R | Of the European countries which saw their greenhouse gas emissions (ex | Albania | wrong  answered-wrong |

| 15 | Y | According to Santa Cruz County Sanitation District's 2020 Audit (Calif | Transmission Systems, Construction in progress, Mobile equipment | partial set 2/3 answered-wrong |

| 16 | Y | Of the first-generation Water-type Pokémon used by the three main prot | Kingler, Starmie, Psyduck, Seel, Dewgong | partial set 4/5 answered-wrong |

| ~~20~~ | ~~G~~ | ~~In the diaries of Samuel Pepys, which naval figure is mentioned in eve~~ | ~~(Sir) William Batten~~ | ~~correct~~ |

| 19 | Y | Which authors contributed articles to the NAWE's Writing in Education  | Bryan Podmore, Sarah Wardle, Martin Goodman, Fred Sedgwick, Paul Munde | partial set 8/8 answered-wrong |

| 22 | Y | Which countries that had a record high average temperature for 2023 ac | South Korea, Austria, Germany, China, Japan, Hungary | partial set 6/6 answered-wrong |

| 21 | Y | List the names of the MPs which won their first election to the House  | Giles Watling, Jack Brereton, Ben Bradley, Eddie Hughes, Stephanie Pea | partial set 1/5 answered-wrong |

| 17 | R | List the railroad accidents investigated by the NTSB with incident dat | RIR-24-02, RIR-24-03, RIR-23-09, HZIR-23-01, RIR-23-16 | wrong set 0/5 answered-wrong |

| 23 | Y | Using butterfly-conservation.org, which butterfly species had at least | Red Admiral, Comma, Painted Lady, Large White, Ringlet, Green-veined W | partial set 9/9 answered-wrong |

| ~~18~~ | ~~G~~ | ~~According to Our World in Data, which countries ranked in the top ten ~~ | ~~Norway, Switzerland~~ | ~~correct~~ |

| 25 | Y | Between 2014 and 2020, which years did Doctors Without Borders USA inc | 2014, 2016, 2017, 2020 | partial set 4/4 answered-wrong |

| 24 | Y | List all the years from 2015 to 2021 that the St Kilda Soay Sheep Proj | 2015, 2016, 2018, 2020, 2021 | partial set 5/5 answered-wrong |

| ~~27~~ | ~~G~~ | ~~Using the cia world factbook factsheets for each country, which of the~~ | ~~Bhutan~~ | ~~correct~~ |

| ~~26~~ | ~~G~~ | ~~Use protein sequences from https://www.uniprot.org/. I am interested i~~ | ~~T. maritima, A. baumannii~~ | ~~correct~~ |

| ~~29~~ | ~~G~~ | ~~What year between 2020 and 2023 inclusive had the smallest difference ~~ | ~~2020~~ | ~~correct~~ |

| 31 | Y | Of all the US states that were labeled as battleground states in the 2 | Ohio, North Carolina, Florida | partial set 3/3 answered-wrong |

| 28 | R | I remember reading an article a while back, but the only thing I solid | Hacking CTFs with Plain Agents  | wrong set 0/1 truncated |

| 34 | Y | Give me the New England and states bordering the Great Lakes that proh | Connecticut, Maine, New Hampshire, Rhode Island | partial set 4/4 answered-wrong |

| 32 | R | Find the votes that passed in the US House of Representatives between  | Roll Call 695 (118th Congress), Roll Call 696 (118th Congress) | wrong set 0/2 answered-wrong |

| 30 | Y | In the 2023 General Election in NZ, of the electoral candidates that w | Vanessa Weenink, Chris Bishop, Carlos Cheung, Paulo Garcia, Ingrid Lea | partial set 6/6 answered-wrong |

| 37 | R | In the year 2023, which ward was the councillor from in canterbury cit | West Bay | wrong  answered-wrong |

| ~~33~~ | ~~G~~ | ~~Which country is not a member of BRICS, NATO, Five Eyes, the Community~~ | ~~Zimbabwe~~ | ~~correct~~ |

| 35 | Y | which years from 2017 to 2023 had at least 10 deaths as a result of ai | 2017 and 2023 | partial set 1/1 answered-wrong |

| ~~36~~ | ~~G~~ | ~~Who is the Associate Editor of the SBL Study Bible who is a graduate o~~ | ~~Matthew Goff~~ | ~~correct~~ |

| ~~40~~ | ~~G~~ | ~~Of the creatures, not plants, that became listed as threatened or enda~~ | ~~Sacramento Mountains Checkerspot Butterfly~~ | ~~correct~~ |

| 39 | R | According to Data NYC's MTA Subway Trains Delayed: 2020-2024 and Subwa | Times Sq-42 St/Port Authority Bus Terminal, 34 St-Herald Sq, and 14 St | wrong set 0/3 answered-wrong |

| ~~41~~ | ~~G~~ | ~~Of all the botanists who have papers in the “papers of individual bota~~ | ~~Robert Morison, Jacob Bobart the Younger, William Sherard, George Clar~~ | ~~correct~~ |

| 38 | R | According to the paper "Combining phylogenomic and supermatrix approac | Lialis | wrong  answered-wrong |

| ~~44~~ | ~~G~~ | ~~According to the Government of New Brunswick's website, identify the r~~ | ~~Capital Region rural district~~ | ~~correct~~ |

| 42 | Y | Between the 2010-11 and 2014-15 regular seasons, which team for each s | 2010-11: Calgary Flames/Minnesota Wild, 2011-12: Anaheim Ducks, 2012-1 | partial set 2/5 answered-wrong |

| 45 | R | According to the IMF, which of the following countries saw the highest | Switzerland | wrong  answered-wrong |

| 46 | Y | List the lipids that were used to make lipid nanoparticles for mRNA in | DLin-MC3-DMA, 18:0 PC (DSPC), Cholesterol, DMG-PEG2000 | partial set 3/4 answered-wrong |

| 43 | R | Between the top 5 countries on the Heritage Foundation's Index of Econ | Haiti | wrong  answered-wrong |

| 50 | Y | In the Airbnb quarterly SEC filings for 2022, according to the “Conden | Q1, Q2, Q3 | partial set 3/3 answered-wrong |

| ~~48~~ | ~~G~~ | ~~From the Space Shuttle program, for the space shuttle with the most nu~~ | ~~5~~ | ~~correct~~ |

| ~~52~~ | ~~G~~ | ~~Of the authors in the first article of the 65th edition of the Journal~~ | ~~Joelle Pineau~~ | ~~correct~~ |

| 49 | R | For cameras in Fujifilm's X-T line (single digits only, i.e. not the X | SanDisk - 16G - SDSDXPB-016G Toshiba - 16G - SDXU-B016G  SanDisk - 32G | wrong set 0/6 answered-wrong |

| ~~51~~ | ~~G~~ | ~~Give me a list of all of the fish that Albacore form mixed schools wit~~ | ~~Skipjack Tuna, Yellowfin Tuna~~ | ~~correct~~ |

| ~~47~~ | ~~G~~ | ~~Of the years between 2000 and 2019 (inclusive) during which the percen~~ | ~~2005~~ | ~~correct~~ |

| 56 | R | I'm interested in the aquaculture industry, particularly the research  | Khor Waiho | wrong  answered-wrong |

| 55 | R | Identify the liquor license account with the most report entries in th | 12 entries - WINEGUYS L.L.C; DBA(s) - ID: 223939, CITY PARK GRILL ID:  | wrong set 0/9 answered-wrong |

| 54 | Y | According to the NHTSA, which US states had a fatality rate per 100 mi | Connecticut (2003, 2004, 2005), Massachusetts (2000, 2001, 2002, 2003, | partial set 9/11 answered-wrong |

| ~~57~~ | ~~G~~ | ~~Of the three constituencies at the 2010 General Election with the larg~~ | ~~East Ham~~ | ~~correct~~ |

| 59 | Y | Of the states with a premature birth rate of over 11, which also had a | Mississippi, Arkansas, Louisiana, West Virginia, Georgia | partial set 4/5 answered-wrong |

| 58 | Y | Can you look up the paper, "Proteins and polysaccharides from vegetati | Nikita Navolokin, Alexander Shirokov | partial set 2/2 answered-wrong |

| 53 | Y | I am doing a study on the performance of rail operators in the UK. Ide | East Midlands Railway, TransPennine Express | partial set 2/2 answered-wrong |

| 60 | Y | I am performing a comparative study on the quality of life in G20 coun | Canada, France, Australia | partial set 3/3 truncated |

| ~~63~~ | ~~G~~ | ~~I am doing a presentation on demography for my politics class. Using U~~ | ~~France~~ | ~~correct~~ |

| ~~64~~ | ~~G~~ | ~~According to Fashionphile's 2023 Ultra Luxury Resale Report, find whic~~ | ~~Europe~~ | ~~correct~~ |

| ~~61~~ | ~~G~~ | ~~Across the 2020, 2021, and 2022 “Water and Sewerage Companies Environm~~ | ~~Southern Water~~ | ~~correct~~ |

| 66 | R | According to Statistics Canada, when comparing the years 2017 and 2023 | Alberta | wrong  answered-wrong |

| 65 | R | I’m interested in how ripening affects the sugar composition of banana | Sucrose: - 2.08 grams | wrong  answered-wrong |

| 62 | Y | Of the states that have an more than 50 tornadoes annually on average  | Oklahoma, Missouri, Iowa | partial set 1/3 answered-wrong |

| ~~70~~ | ~~G~~ | ~~Out of the movies produced by the director of Transformers, when was t~~ | ~~July 7, 1972~~ | ~~correct~~ |

| 67 | Y | According to Worldometer, which countries that have a world share of t | Ethiopia, Egypt, Vietnam, Bangladesh, China | partial set 2/5 answered-wrong |

| 68 | Y | According to the ACT, for 2023 identify of all the states to have an e | Kentucky, Wyoming, Montana, Arkansas, Nebraska, Wisconsin, Utah | partial set 3/7 answered-wrong |

| 69 | Y | Using https://results.aec.gov.au/, of the parties that received more t | Liberal Party of Australia  Australian Labor Party   Australian Greens | partial set 5/5 answered-wrong |

| 73 | Y | In the first duel between Mako and Yugi, list all of Yugi's monster's  | Curse of Dragon, Giant Soldier of Stone, Feral Imp, Horn Imp, Silver F | partial set 5/5 answered-wrong |

| 71 | Y | Create a list of scottish westminster constituencies which voted for t | Na h-Eileanan an Iar, East Renfrewshire | partial set 2/2 answered-wrong |

| ~~74~~ | ~~G~~ | ~~By comparing the results from all the exam periods between March 2022 ~~ | ~~March 2022~~ | ~~correct~~ |

| 72 | Y | Referencing Statistics Canada (table 23-10-0253-01), which Canadian ai | Halifax Stanfield Airport, Edmonton Airport, Winnipeg James Armstrong  | partial set 5/8 answered-wrong |

| 77 | Y | I'm looking at the late sockeye run for the years 2018 to 2023, accord | 2019, 2021, 2023 | partial set 3/3 answered-wrong |

| 75 | Y | Who are the people that have received more votes than Winston Peters i | Bob Clarkson, Simon Bridges, Matt King | partial set 3/3 answered-wrong |

| 76 | Y | I'd like a list of repeat Booker Prize/Man Booker Prize judges and the | Rebecca West (1969, 1970), Antonia Fraser (1970, 1971), Susan Hill (19 | partial set 22/28 answered-wrong |

| ~~79~~ | ~~G~~ | ~~According to Clemson University variety evaluations, which farm produc~~ | ~~Musser Fruit Research Farm~~ | ~~correct~~ |

| 80 | R | By using the NHS website for “Shoulder Pain”, which of the possible ca | Hypermobility | wrong  answered-wrong |

| 78 | Y | According to estimated data tables from the Library of Congress Archiv | Russia, Austria-Hungary, Germany | partial set 3/3 answered-wrong |

| 81 | Y | List the regions within England that were within the 5 highest abortio | London, East | partial set 2/2 answered-wrong |

| 84 | Y | According to BiggestUSCities.com's "Top 100 Biggest US Cities" lists,  | Phoenix (Arizona) and San Antonio (Texas) | partial set 1/1 answered-wrong |

| 83 | R | Which of the 50 US states had fewer than 300 traffic fatalities in eac | Hawaii, Idaho, Maine, Montana, Nebraska, New Hampshire, Rhode Island,  | wrong set 0/8 answered-wrong |

| 85 | Y | According to the Social Security Administration, what are the identica | Michael, Christopher, Jason | partial set 3/3 answered-wrong |

| 86 | Y | Name the three types of parakeets or parrots that can be seen in a sta | Green Parakeet, Monk Parakeet (feral), Red-crowned Parrot | partial set 2/3 answered-wrong |

| 82 | R | I’m interested in how firearm mortality rates impact the votes of Cong | New Mexico | wrong  answered-wrong |

| 89 | R | Look at the Smithsonian Libraries and Archives official blog titled “U | Chocolate Rabbits and…Elephants! | wrong  answered-wrong |

| ~~91~~ | ~~G~~ | ~~According to the NTD Transit Agency Profiles for "Big Bend Transit" on~~ | ~~Other Funds~~ | ~~correct~~ |

| 88 | Y | Among all countries led by a female head of state as of June 2024, ide | Trinidad & Tobago, Malta, Barbados, Dominica | partial set 3/4 answered-wrong |

| ~~90~~ | ~~G~~ | ~~Of the three railroad commissioners of Texas, Christi Craddick, Wayne ~~ | ~~Wayne Christian~~ | ~~correct~~ |

| 93 | Y | In the year 2020 which 5 states had the capability to produce the most | Texas, Indiana, West Virginia, Missouri, Ohio | partial set 4/5 answered-wrong |

| ~~92~~ | ~~G~~ | ~~Between Belgium, Dominican Republic, Croatia, Belize, Austria, and Cos~~ | ~~Dominican Republic and Costa Rica~~ | ~~correct~~ |

| 96 | Y | From the Scottish Mountain Rescue Statistics Report 2023 list the year | 2009, 2012, 2015, 2018, 2019, 2021, 2022, 2023 | partial set 8/8 answered-wrong |

| 87 | R | What was the country with the latest year of independence from Europea | Burundi | wrong  answered-wrong |

| ~~94~~ | ~~G~~ | ~~Hello, I'm researching the link between climate and numbers of shark a~~ | ~~The Maldives~~ | ~~correct~~ |

| ~~97~~ | ~~G~~ | ~~Which individual school in the top 5 endowments of 2023 (according to ~~ | ~~Yale University~~ | ~~correct~~ |

| ~~99~~ | ~~G~~ | ~~According to data from the Australian Curriculum, Assessment and Repor~~ | ~~Writing~~ | ~~correct~~ |

| 98 | R | Of the two people awarded the Nobel Prize for their discovery of neutr | Study of phenylxylylethane (PXE) as scintillator for low energy neutri | wrong  answered-wrong |

| ~~95~~ | ~~G~~ | ~~Which country according to Eurostat's available data transported the m~~ | ~~Belgium~~ | ~~correct~~ |



### BROWSECOMP: 23/90 correct — 25.6% strict — 0 Y — 67 R — 10 error rows (re-run queued)

| # | G/Y/R | Prompt | Gold | Verdict / Fail |
|---|---|---|---|---|

| 3 | R | A person who, in a specific year between 2010 and 2020, both years inc | Phoenix New Times | wrong  no-sources |

| 0 | R | There is a dissertation written before 2020 that analyzes the Gothic w |  Michael Reed Holzer | wrong  answered-wrong |

| ~~1~~ | ~~G~~ | ~~Can you tell me the first and last birth name of this person based on ~~ | ~~Aaradhya Bachchan~~ | ~~correct~~ |

| 2 | R | An artwork was created by someone born in the 1900s and raised catholi | Verity | wrong  truncated |

| 4 | R | I am seeking the full name of an actor based on the following details: | Rishi Kapoor | wrong  no-sources |

| ~~5~~ | ~~G~~ | ~~In a 2020 interview, a certain individual stated that they started a c~~ | ~~Ihuoma Sonia Uche~~ | ~~correct~~ |

| 6 | R | Between 2010 and 2020 inclusive, less than 10 people were killed, and  | March 19 | wrong  answered-wrong |

| 7 | R | Three people wrote an article published between 2020 and 2023 listing  | Rain | wrong  answered-wrong |

| ~~10~~ | ~~G~~ | ~~A certain individual who is an entrepreneur that resides in the US as ~~ | ~~Wale Adebayo~~ | ~~correct~~ |

| ~~8~~ | ~~G~~ | ~~Sometime between 2015 and 2020 (inclusive), an exhibition was held fea~~ | ~~Collecting Ladies: Ferdinand von Mueller and Women Botanical Artists~~ | ~~correct~~ |

| 9 | R | I want to know the name of a novel, published before 2023, whose autho | Loving Frank | wrong  answered-wrong |

| 11 | R | An individual whose eldest child was born when they were between 22 an | Michael Caine | ERROR HTTP 504 — re-run |

| 12 | R | In a cricket match played between 1980 and 1990 (exclusive), a player  | 34 | wrong  truncated |

| 13 | R | A US federal agency created in the 1940s researched a scientific proce | Secret Oral Teachings in Tibetan Buddhist Sects | wrong  truncated |

| 14 | R | A person is from a country that's been an EU member since 1995. They w | Million Voices | wrong  truncated |

| ~~17~~ | ~~G~~ | ~~There is an author who has had their work appear in more than thirty l~~ | ~~United Kingdom, Germany~~ | ~~correct~~ |

| 16 | R | An alliance of more than three universities in the same country formed | multiple-membership, multiple-classification | wrong  answered-wrong |

| 15 | R | In their book published between 1950 and 1970, Writer A claimed that W | Reasons of a Hindu for rejecting the Doctrines of Christianity | wrong  answered-wrong |

| 18 | R | This research publication, published before July 2021, was co-authored | Development of waffle with fat filling using unconventional vegetable  | wrong  answered-wrong |

| 19 | R | An Emmy award winner wrote an article published in 2018 about the orig | Magic Mommy Stories | wrong  truncated |

| 20 | R | In an article posted sometime between 2016 and 2019 (inclusive), one o | 13 June 1852 | wrong  answered-wrong |

| 21 | R | A paper authored by six people was published in November 2022. It has  | DMREF-1922234 | wrong  answered-wrong |

| 22 | R | A company co-founder was born in the year their country won the World  | $1.05 billion | wrong  answered-wrong |

| 23 | R | As of December 2023, I am seeking the name of a historic site construc | The Gingras Trading Post State Historic Site | wrong  answered-wrong |

| 25 | R | I am looking for the full name of a series in which:  - The first few  | Stranger Things | wrong  answered-wrong |

| 26 | R | An author (1) published short fiction pieces in two online literary ma | The Inconsequential Codes on Lipsticks | wrong  truncated |

| 27 | R | Identify the company that underwent a name change prior to 2020, succe | Auxly | wrong  answered-wrong |

| 24 | R | The actor was born in May between 1996 and 1999 and graduated with a d | Ahmed Ghozzi | wrong  answered-wrong |

| ~~29~~ | ~~G~~ | ~~In 2023, an article was published online about a school welcoming a ne~~ | ~~27~~ | ~~correct~~ |

| ~~28~~ | ~~G~~ | ~~In a FIFA World Cup match held between 2018 and 2023, there were a tot~~ | ~~Sergio Costa ~~ | ~~correct~~ |

| 31 | R | There is a certain drug that I am interested in that was described in  | Vanderbilt clinical oncology research career development award | wrong  answered-wrong |

| 30 | R | As of December 31, 2023, I am seeking the name of the sibling who was  | Adam Horne | wrong  answered-wrong |

| ~~33~~ | ~~G~~ | ~~Given the following hints that are all true as of 2023, there was an i~~ | ~~2015, Album of The Year ~~ | ~~correct~~ |

| 32 | R | A specific person, who will be referred to as person 1 from now on, pa | Joan Alta Iwan | wrong  truncated |

| ~~35~~ | ~~G~~ | ~~There is a TV show episode in which one of the main characters undergo~~ | ~~Legion; Season 1; Chapter 5~~ | ~~correct~~ |

| 37 | R | How much did tourist arrivals in accommodations increase in November 2 | 5.4% | wrong  answered-wrong |

| 34 | R | A video game from the 2010s was released to negative reviews. Three re | Javier Rodriguez | ERROR HTTP 504 — re-run |

| 36 | R | A person started in programming at a university founded between 1940 a | Smilegate Foundation | wrong  answered-wrong |

| 40 | R | A new school was founded in the '90s by combining a girls' and boys' s | Convent of Our Lady of Mercy | wrong  answered-wrong |

| 38 | R | What is the real-life first and last name of the entertainer who;   Fi | Georgia Hirst | wrong  answered-wrong |

| 41 | R | On the second Saturday of a month between 2011 and 2021 (inclusive), P | 11/01/2021 | wrong  answered-wrong |

| 39 | R | There is a national team coach who was a football pioneer in the count | Kai Tomety | ERROR HTTP 504 — re-run |

| 42 | R | A final was held between 1995 and 2005 inclusive, and two teams partic | Martin Devaney | wrong  truncated |

| 45 | R | A society founded in the 1960s published an article 60 years later. Th | Hannah Belcher | wrong  answered-wrong |

| 44 | R | After 2010 but before 2023, a bank discovered that when converted, bet | Sukhumvit Soi 23 | wrong  answered-wrong |

| 43 | R | I need you to name the first and last name of the production controlle | Shafeer Sait | wrong  truncated |

| 46 | R | An actor who grew up in an Asian country for more than ten years of th | Cole Zanetti | wrong  answered-wrong |

| 49 | R | Person X was born in the first half of the 1900s and passed away after | Zius Galit | ERROR HTTP 546 — re-run |

| 47 | R | A country whose flag was a result of correct prediction has a governme | $26.1 billion | ERROR HTTP 546 — re-run |

| 50 | R | Please tell me the name of the learning institution that fits the foll | Queen Arwa University | wrong  answered-wrong |

| ~~52~~ | ~~G~~ | ~~According to the company's annual report in 1997, it recorded an amoun~~ | ~~7%~~ | ~~correct~~ |

| 53 | R | A slave in Africa and, later, a merchant who died en route to their de | Jaja of Opobo: The slave who became a king | wrong  answered-wrong |

| ~~55~~ | ~~G~~ | ~~In a capital city in the South American continent, there's a building ~~ | ~~La Estrella; Argentina~~ | ~~correct~~ |

| 48 | R | An individual hails from a nation where their grandfather immigrated f | Jaroslav Stetkevych | wrong  truncated |

| 51 | R | There’s an actress who made her debut on stage at the age of 13 and pl | Pirouette | wrong  answered-wrong |

| ~~54~~ | ~~G~~ | ~~A company was acquired between 2013 and 2023. The CEO of that company,~~ | ~~Volkswagen Jetta~~ | ~~correct~~ |

| 56 | R | Can you tell me the name of a movie which was released in year 2000's. | Dosti: Friends Forever | wrong  answered-wrong |

| 57 | R | Hey Chat, I'm trying to remember someone's popular name. This person w | Peter King | wrong  no-sources |

| 58 | R | The band was formed in June between 2013 and 2016, inclusive. One of t | COUNTERFEIT. | wrong  answered-wrong |

| 60 | R | As of December 2022, I am seeking the name of the author's then-wife,  | Seulah | wrong  answered-wrong |

| 59 | R | A video game development studio based in a state founded in the early  | Turbett, Sweet, Carriero, Wolfe | ERROR HTTP 504 — re-run |

| ~~61~~ | ~~G~~ | ~~An actor with a catholic upbringing born to a middle-class family star~~ | ~~1979~~ | ~~correct~~ |

| 62 | R | Name the band based on the following information as of December 2023:  | Death SS | wrong  answered-wrong |

| 64 | R | There is a competition for a certain trading card game that took place | Denko Sekka | wrong  truncated |

| 63 | R | Provide the name of the city as of 2021 a certain actor is from based  | New Orleans | ERROR HTTP 504 — re-run |

| ~~67~~ | ~~G~~ | ~~There is a religious building, that was first constructed during medie~~ | ~~SK 34979 36323~~ | ~~correct~~ |

| ~~65~~ | ~~G~~ | ~~A drawing from the 1700s shows a townlet featuring around 15 - 20 hous~~ | ~~Rodenburg~~ | ~~correct~~ |

| ~~68~~ | ~~G~~ | ~~The band was formed between 2001 and 2004 by a composer, music produce~~ | ~~Jadal~~ | ~~correct~~ |

| 66 | R | Please provide the name of this particular movie:  This movie was rele | Two Living, One Dead | wrong  truncated |

| 69 | R | Can you name the landmark based on the following details as of 31 Dece | Ballysaggartmore Towers | wrong  answered-wrong |

| 70 | R | Help me identify the individual that matches the below criteria: As of | Oliver Mtukudzi | ERROR HTTP 504 — re-run |

| ~~71~~ | ~~G~~ | ~~In a drama series with a central theme of music that streamed in the e~~ | ~~Bandish Bandits~~ | ~~correct~~ |

| 72 | R | There is an Indian author who got promoted from associate professor to | Finding the mathematical overlaps of the axiom of choice in Vipassana  | wrong  answered-wrong |

| 73 | R | A specific article published between 2019 and 2021, both years inclusi | Intersemiotic Convergence | wrong  truncated |

| 75 | R | A Harvard award-winning author wrote an article less than 5 years befo | Daniel Goleman | wrong  answered-wrong |

| 74 | R | I’m looking for the name of a U.S. newspaper which was only in publica | Iditarod Nugget | wrong  answered-wrong |

| ~~78~~ | ~~G~~ | ~~A pack of downloadable content was released for a strategy video game ~~ | ~~Mathilda Bjarnehed~~ | ~~correct~~ |

| 77 | R | There is an article about a tribe's drug conviction rate. One of its a | Tamlin S. Conner | wrong  answered-wrong |

| 76 | R | Provide the name of the month and country a certain individual was bor | December, Nigeria | wrong  answered-wrong |

| 79 | R | A particular cricket match played before 2022, in which the following  | Pragyan Ojha | wrong  answered-wrong |

| 80 | R | The following information is verifiable as of 31 December 2023:  - An  | Jess | wrong  answered-wrong |

| 83 | R | There is a true life story about a janitor who also teaches salsa danc | 2006: 66% | wrong  answered-wrong |

| ~~84~~ | ~~G~~ | ~~There are two different blog posts, both written between 2015 and Dece~~ | ~~Ralph Bronner ~~ | ~~correct~~ |

| 81 | R | A paper was submitted between 2015 and 2020, analyzes tax incentives a | Nasarawa State University | ERROR HTTP 504 — re-run |

| 82 | R | Which company meets the following criteria?  Launched six e-learning c | Ascendia | wrong  answered-wrong |

| 86 | R | Provide the full name of a certain director born between 1970 and 1980 | Uche Jombo Rodriguez | wrong  answered-wrong |

| ~~87~~ | ~~G~~ | ~~She holds an MBA and a Master’s degree, and as of 2023, she was a PhD ~~ | ~~Eno Ebele Jerry ~~ | ~~correct~~ |

| 85 | R | Rescue operations for finding a person somewhere between 2010 and 2023 | Hilal Ahmad Dar | wrong  no-sources |

| 88 | R | The artist released their debut album in October between 2012 and 2015 | Dina El Wedidi | wrong  truncated |

| 91 | R | As of December 31, 2023, I am searching for the first name of the thes | Ian | wrong  answered-wrong |

| ~~90~~ | ~~G~~ | ~~A former head of state of a country that has a creole as one of its of~~ | ~~30/07/1980~~ | ~~correct~~ |

| 89 | R | In a family drama movie produced between 1999 - 2009 (inclusive), the  | Baghban | ERROR HTTP 504 — re-run |

| 93 | R | I’m looking for a paper that was submitted to a university before 2020 | Stephen D. Boyles | wrong  answered-wrong |

| 95 | R | Please identify the fictional character who occasionally breaks the fo | Plastic Man | wrong  answered-wrong |

| ~~97~~ | ~~G~~ | ~~What is the full name name of the author who, prior to December 2023, ~~ | ~~Ian Solomon~~ | ~~correct~~ |

| 92 | R | Give me this person's full birth name. - This person was born in the 1 | Jacqueline Georgette Cantrelle | wrong  answered-wrong |

| 94 | R | The player I'm looking for was named the man of the match in an intern | Sam Curran | wrong  answered-wrong |

| ~~99~~ | ~~G~~ | ~~I was going through the website of one of the prestigious awards of th~~ | ~~Avatar, 2010~~ | ~~correct~~ |

| 96 | R | - A source, published sometime between January 1, 2008, and December 3 | Amherst College | wrong  answered-wrong |

| 98 | R | There's this popular figure with multiple Grammy awards in the enterta | St. John’s Health Center | wrong  answered-wrong |



### Fixes shipped this batch

1. **Gateway v251 fast-path (deployed, platform 253)**: simple AND medium data lookups with a solid live-research set now deterministically skip the tool loop with `skipped=research_sufficient` (the v121 in-block check never fired live; the skip now lives in the gate). Verified 4/4 live, 17-22s (was 34.5s). The intent analyst flakily classifies the same lookup simple OR medium — both covered; complex (multi-hop) still runs the loop.
2. **Deep-link survival (site fix, this deploy)**: the server sync re-slugs local-only threads on push (the server assigns its own deduped slug), which orphaned /t/<old-slug> deep links mid-boot — the boot render fell through to the landing page (pre-launch "thread renders" failed 3 runs straight once the eval account accumulated 90+ duplicate-title threads). Threads now remember every slug they ever had (`oldSlugs`), and routing matches them.
3. **Benchmark harness (qa/ruthless-bench.py)**: 401 re-mint + retry, work-log preamble strip before grading.

### The path to 98-100%

1. **Re-run all four suites to full n** (launched with the fixed harness; error rows retry automatically).
2. **FINAL ANSWER compliance** (writer honors explicit output-format instructions) — flips the DSQA set-partials that are formatting-only.
3. **Set-aggregation pass** for DSQA (constraint-by-constraint planner sub-queries + final enumeration).
4. **BrowseComp decomposition** (extend the FRAMES multi-hop predicate to long chains) + truncation budget for long answers.
5. SimpleQA's 2 remaining wrongs are gold/source conflicts (documented in v249 §29cs).

### Batch checklist
- [x] DSQA/BrowseComp miss rows root-caused with counts
- [x] Granular G/Y/R row-by-row board for all 4 benchmarks (above)
- [x] Harness truth fixes (401 re-mint, preamble strip)
- [x] Gateway v251 fast-path fix deployed + live-verified (4/4 research_sufficient)
- [x] Deep-link survival fix + CSP re-hash (check PASS)
- [x] Build marker v249 -> v250
- [x] Doc written; headline unchanged 90.4% (no parity items closed this batch)
- [ ] Full 4-suite re-run with the fixed harness (in flight)
- [ ] Live verify of v250 marker + thread render (post-deploy)

### Owner-only parking lot
- SHMT PR #3889: approve + merge as rentspire-bspain-2, then redeploy the runner machine.
- Passkey enrollment e2e; .edu student-verify e2e; OpenRouter auto-top-up.
- The Vercel bypass secret stays env-only (VERCEL_PROTECTION_BYPASS).
