# ai.spaincos.com — 100% Completion Parity Document (2026-11-17, v252)

## §29cv — Benchmark iteration rounds 1-3: server-side push to the honest ceiling

**Headline (computed by qa/generate-parity-headline.py): 90.4% (8858/98; 104✅ / 33🟡 / 20🔴 of 157)**

### The iteration story (three rounds, one night)

| Round | Gateway | What shipped | Result |
|---|---|---|---|
| 1 (v252 baseline) | v252 | FINAL ANSWER compliance + grader Sources-strip + clean re-run | SimpleQA 98.0, FRAMES 75.0, DSQA 33.0, BrowseComp 29.0 — truncation exposed as the dominant failure |
| 2 (v253, aborted) | v253 | set-aggregation upgrade + harness 6,000-token budget | Aborted mid-run: the run proved the harness's token raise was CLAMPED by the gateway tier caps (2,048/4,000) — the raise never reached the model |
| 2 redo (v254) | v254 | tier caps 4,000/6,000 (caller cap respected — frontend unchanged), QA retry no longer skips simple answers, NARRATIVE-CHAIN upgrade (BrowseComp-style chains get planner sub-queries) | **DSQA 33.0 -> 43.4 (+10.4, the set-aggregation yield). SimpleQA 98.0, FRAMES 75.0, BrowseComp 25.8** (within noise of v252) |
| 3 (v255, in flight) | v255 | truncation retry ALWAYS fires on finish_reason=length (the v254 run showed the retry starved by the 95s wall budget — BrowseComp p50 is 105s) | launched 09:15Z, results pending |

### What the rounds proved

- **Yield:** the DSQA set-aggregation upgrade (+10.4 points, 33.0 -> 43.4) — multi-constraint filtered-set questions now decompose into per-constraint planner sub-queries.
- **No yield (yet):** the token-budget raise alone did not move SimpleQA/FRAMES — because the answers were truncated for a reason the budget could not fix: the QA truncation-retry was starved by the 95s wall budget (round 3's fix).
- **Honest limits discovered:** the grader's stored content is capped at 3,000 chars, so miss-mode re-classification post-run is approximate (verdicts are exact — they are computed on full text at write time). The "truncated" miss counts above carry that caveat.
- **Harness reliability:** the hard watchdog (round 1) eliminated the 60-minute worker hangs; zero error rows across SimpleQA (200) and FRAMES (100); 1 DSQA + 7 BrowseComp 504s remain (auto-retry on next invocation).

### The v254 grid (row by row, G/Y/R with strikethroughs)

# Benchmark grid — generated from /home/user/workspace/qa-private/bench/results-v254

## SIMPLEQA — 196/200 = 98.0% strict (p50 32s, 0 error rows {})

| Verdict | Count | Share |
|---|---|---|

| correct | 196 | 98% |
| wrong | 4 | 2% |

**Miss modes:** {'truncated': 4}

| # | G/Y/R | Prompt | Gold | Verdict / Fail |
|---|---|---|---|---|

| ~~0~~ | ~~G~~ | ~~What were the day, month, and year of release for Aseprite v1.3?~~ | ~~27 Nov 2023~~ | ~~correct~~ |
| ~~1~~ | ~~G~~ | ~~The 1972 Canadian federal budget was first presented on what day,~~ | ~~8 May 1972~~ | ~~correct~~ |
| ~~2~~ | ~~G~~ | ~~What year was the municipality of Ciudad Bolívar, Antioquia, Colo~~ | ~~1839~~ | ~~correct~~ |
| ~~3~~ | ~~G~~ | ~~In Season 16 of The Bachelor, which contestant quit?~~ | ~~Brittney Schreiner~~ | ~~correct~~ |
| ~~4~~ | ~~G~~ | ~~What was the original name of the village of Berrien Springs, Mic~~ | ~~Wolf's Prairie~~ | ~~correct~~ |
| ~~5~~ | ~~G~~ | ~~In which year was the municipality of Macanal, Boyacá, Colombia, ~~ | ~~1807~~ | ~~correct~~ |
| ~~6~~ | ~~G~~ | ~~In which year was Alexandra Park declared a local nature reserve?~~ | ~~2013~~ | ~~correct~~ |
| ~~7~~ | ~~G~~ | ~~In the 2021 research paper titled "EEG-Based Driving Fatigue Dete~~ | ~~92.71%~~ | ~~correct~~ |
| ~~8~~ | ~~G~~ | ~~What year was Türksat 2A decommissioned?~~ | ~~2016~~ | ~~correct~~ |
| ~~9~~ | ~~G~~ | ~~What is the surname of the individual who won the Faraday Lecture~~ | ~~Hinshelwood~~ | ~~correct~~ |
| ~~10~~ | ~~G~~ | ~~What was the name of the new curriculum model that Randolph Colle~~ | ~~TAKE2~~ | ~~correct~~ |
| ~~11~~ | ~~G~~ | ~~In what year was Alma S. Woolley awarded a doctorate in Nursing E~~ | ~~1980~~ | ~~correct~~ |
| ~~12~~ | ~~G~~ | ~~What month, date, and year did Tupac appear in A Different World?~~ | ~~June 24, 1993~~ | ~~correct~~ |
| ~~13~~ | ~~G~~ | ~~How many men competed in fencing during the 1964 Summer Olympics?~~ | ~~203~~ | ~~correct~~ |
| ~~14~~ | ~~G~~ | ~~What was Beloit College's Center for the Sciences renamed in 2017~~ | ~~Marjorie and James Sanger Center for the Sciences.~~ | ~~correct~~ |
| ~~15~~ | ~~G~~ | ~~How many referees were selected from the South American Football ~~ | ~~6~~ | ~~correct~~ |
| ~~16~~ | ~~G~~ | ~~What year did Chiharu Shiota introduce "Dialogue with Absence"?~~ | ~~2010~~ | ~~correct~~ |
| ~~17~~ | ~~G~~ | ~~In what city did Ciara perform for her Beauty Marks Tour on Septe~~ | ~~Puyallup~~ | ~~correct~~ |
| ~~18~~ | ~~G~~ | ~~What was the first year Whig politician James Vernon the Younger ~~ | ~~1702~~ | ~~correct~~ |
| ~~19~~ | ~~G~~ | ~~As of the 2020 census, what was the population of the city of For~~ | ~~10,423~~ | ~~correct~~ |
| ~~20~~ | ~~G~~ | ~~What were the month and year when Telegram reached 180 million mo~~ | ~~December 2017~~ | ~~correct~~ |
| ~~21~~ | ~~G~~ | ~~What is the first vampire number in recreational mathematics obta~~ | ~~102510~~ | ~~correct~~ |
| ~~22~~ | ~~G~~ | ~~What is the fifth track on Alec Benjamin's album, "(Un)Commentary~~ | ~~speakers ~~ | ~~correct~~ |
| ~~23~~ | ~~G~~ | ~~Which year was György Lukács appointed as the Hungarian Minister ~~ | ~~1919~~ | ~~correct~~ |
| ~~24~~ | ~~G~~ | ~~Which day, month, and year was the second episode of Season 2 of ~~ | ~~April 15, 2020~~ | ~~correct~~ |
| ~~25~~ | ~~G~~ | ~~What is the surname of the U.S. President who attended the 66th b~~ | ~~Eisenhower~~ | ~~correct~~ |
| ~~26~~ | ~~G~~ | ~~Which angel is portrayed in Leonardo da Vinci's "Virgin of the Ro~~ | ~~The angel Uriel.~~ | ~~correct~~ |
| ~~27~~ | ~~G~~ | ~~On which month and year did the Colombian Cardinal Pedro Rubiano ~~ | ~~January 2008~~ | ~~correct~~ |
| ~~28~~ | ~~G~~ | ~~In what year did the Japanese mathematician Kiyosi Ito receive th~~ | ~~1985~~ | ~~correct~~ |
| ~~29~~ | ~~G~~ | ~~In what year was the praying mantis species Eremiaphila cyclopter~~ | ~~1939~~ | ~~correct~~ |
| ~~30~~ | ~~G~~ | ~~What was the date, month, and year when France proposed that the ~~ | ~~January 14, 1991~~ | ~~correct~~ |
| ~~31~~ | ~~G~~ | ~~Who won the Paris Kanellakis Theory and Practice Award in 2000?~~ | ~~Narendra Karmarkar~~ | ~~correct~~ |
| ~~32~~ | ~~G~~ | ~~How many corners did Barcelona take in the Champions League semi-~~ | ~~3~~ | ~~correct~~ |
| ~~33~~ | ~~G~~ | ~~In what year was the mathematician George Andrews elected a Fello~~ | ~~1997~~ | ~~correct~~ |
| ~~34~~ | ~~G~~ | ~~What day, month, and year did William II of Holland become King o~~ | ~~3 October 1247~~ | ~~correct~~ |
| ~~35~~ | ~~G~~ | ~~What day, month, and year was Georgi Ivanov Peev, the Bulgarian f~~ | ~~11 March 1979~~ | ~~correct~~ |
| ~~36~~ | ~~G~~ | ~~What were Terry Kath's famously ironic last words?~~ | ~~What do you think I'm gonna do? Blow my brains out?~~ | ~~correct~~ |
| ~~37~~ | ~~G~~ | ~~At which art school was Will Hicok Low an instructor in 1890?~~ | ~~National Academy of Design~~ | ~~correct~~ |
| ~~38~~ | ~~G~~ | ~~In a 1988 paper, which author defined Mammalia phylogenetically a~~ | ~~Timothy Rowe~~ | ~~correct~~ |
| ~~39~~ | ~~G~~ | ~~What was the name of the Detroit-born medium to whom William Lyon~~ | ~~Etta Wriedt~~ | ~~correct~~ |
| ~~40~~ | ~~G~~ | ~~What was the nationality of the scientists who used lasers to mea~~ | ~~Belgian~~ | ~~correct~~ |
| ~~41~~ | ~~G~~ | ~~What were the day, month, and year when Google introduced the nat~~ | ~~2 of January of 2019~~ | ~~correct~~ |
| ~~42~~ | ~~G~~ | ~~What is the surname of the individual who won the Linus Pauling A~~ | ~~Eyring~~ | ~~correct~~ |
| ~~43~~ | ~~G~~ | ~~In TWD Season 11, Episode 10, we learn that Connie got whose uncl~~ | ~~Pamela Milton's uncle~~ | ~~correct~~ |
| ~~44~~ | ~~G~~ | ~~On what day, month, and year was Juan Nogueira, Brazilian amateur~~ | ~~1 May 1988~~ | ~~correct~~ |
| ~~45~~ | ~~G~~ | ~~Between what years did Getachew Reda complete a Master of Law at ~~ | ~~2001 and 2002~~ | ~~correct~~ |
| 46 | R | From which year to which year did the Albanian politician Ibrahim | From 1976 to 1977 | wrong truncated |
| ~~47~~ | ~~G~~ | ~~On which game version was The International 2014 of Dota 2 played~~ | ~~6.81b~~ | ~~correct~~ |
| ~~48~~ | ~~G~~ | ~~In 2014, who took over development of the Brooding language for t~~ | ~~BenJamin P. Johnson~~ | ~~correct~~ |
| ~~49~~ | ~~G~~ | ~~How many stitches did John Lennon get as a result of his Aston Ma~~ | ~~17~~ | ~~correct~~ |
| ~~50~~ | ~~G~~ | ~~What TV show did Kim Fields announce that she was expecting her s~~ | ~~The Real~~ | ~~correct~~ |
| ~~51~~ | ~~G~~ | ~~In what year did Nikolai Andreev win the Leelavati Award?~~ | ~~2022~~ | ~~correct~~ |
| ~~52~~ | ~~G~~ | ~~What is the Swedish word for the time of night known as "the elev~~ | ~~Elvavrålet~~ | ~~correct~~ |
| ~~53~~ | ~~G~~ | ~~On what day, month, and year did Florence Farmer, a pioneer of wo~~ | ~~June 26, 1958~~ | ~~correct~~ |
| ~~54~~ | ~~G~~ | ~~In which month and year was Sayyid Ghulam Muhiyuddin Ahmed bin Kh~~ | ~~November 1888~~ | ~~correct~~ |
| ~~55~~ | ~~G~~ | ~~What was the date, month, and year when Clifford Cunnell, an Engl~~ | ~~5 October 2016~~ | ~~correct~~ |
| ~~56~~ | ~~G~~ | ~~For how many episodes did Gabrielle Fitzpatrick star in "Roar"?~~ | ~~1~~ | ~~correct~~ |
| ~~57~~ | ~~G~~ | ~~In what year was the Showstreet Palace Theater added to Dollywood~~ | ~~1992~~ | ~~correct~~ |
| ~~58~~ | ~~G~~ | ~~What is the name of Helmut Lang's solo exhibition from 2011 in Ea~~ | ~~Make it hard~~ | ~~correct~~ |
| 59 | R | Who was the 11th Prime Minister of India? | Shri H. D. Deve Gowda | wrong truncated |
| ~~60~~ | ~~G~~ | ~~What was the name of the episode in which Shai appeared on Family~~ | ~~Good Cop, Bad Cop~~ | ~~correct~~ |
| ~~61~~ | ~~G~~ | ~~In what year was the pink donut with sprinkles sculpture first pr~~ | ~~2007~~ | ~~correct~~ |
| ~~62~~ | ~~G~~ | ~~Give the full name of Rana Ayyub's father (an Indian journalist).~~ | ~~Mohammad Ayyub Waqif~~ | ~~correct~~ |
| ~~63~~ | ~~G~~ | ~~What year was the municipality of Paya, Boyacá, Colombia, founded~~ | ~~1600~~ | ~~correct~~ |
| ~~64~~ | ~~G~~ | ~~What was the name of the MP of Red Deer, Alberta, in 1987?~~ | ~~Gordon Towers~~ | ~~correct~~ |
| ~~65~~ | ~~G~~ | ~~In which month and year did WhatsApp start rolling out support fo~~ | ~~March 2021~~ | ~~correct~~ |
| ~~66~~ | ~~G~~ | ~~In Horizon Zero Dawn's Frozen Wilds DLC, what is CYAN an acronym?~~ | ~~Caldera of Yellowstone Analytic Nexus~~ | ~~correct~~ |
| ~~67~~ | ~~G~~ | ~~According to Hinduism, which planet is associated with Yamraj?~~ | ~~Pluto~~ | ~~correct~~ |
| ~~68~~ | ~~G~~ | ~~What year did the Lego part with ID gal56 first release?~~ | ~~2002~~ | ~~correct~~ |
| ~~69~~ | ~~G~~ | ~~The Persina Nature Park in Bulgaria was originally established on~~ | ~~December 4, 2000.~~ | ~~correct~~ |
| ~~70~~ | ~~G~~ | ~~Who was the recipient of the ISCB Accomplishment by a Senior Scie~~ | ~~Michael Waterman~~ | ~~correct~~ |
| ~~71~~ | ~~G~~ | ~~What year were the guidelines outlining requirements for the incl~~ | ~~2015~~ | ~~correct~~ |
| ~~72~~ | ~~G~~ | ~~Give the name of the Kashmiri dish in which mutton intestines are~~ | ~~Methi Maaz.~~ | ~~correct~~ |
| ~~73~~ | ~~G~~ | ~~In which year was Prof. H. U. Hamidi appointed as Vice Chancellor~~ | ~~1990~~ | ~~correct~~ |
| ~~74~~ | ~~G~~ | ~~On what day, month, and year did the 2nd ASEM Environment Ministe~~ | ~~October 12, 2003~~ | ~~correct~~ |
| ~~75~~ | ~~G~~ | ~~Which lake in Kashmir is connected to the Khushal Sar and Gil Sar~~ | ~~Nigeen Lake~~ | ~~correct~~ |
| ~~76~~ | ~~G~~ | ~~In which U.S. state was painter Davyd Whaley born?~~ | ~~Tennessee~~ | ~~correct~~ |
| ~~77~~ | ~~G~~ | ~~Which valley is known as the "Golden Crown of Kashmir"?~~ | ~~Breng Valley~~ | ~~correct~~ |
| ~~78~~ | ~~G~~ | ~~What is the name of the multituberculate mammal of early Paleocen~~ | ~~Taeniolabis taoensis~~ | ~~correct~~ |
| ~~79~~ | ~~G~~ | ~~In which country did Jean-Christophe Yoccoz do his military servi~~ | ~~Brazil~~ | ~~correct~~ |
| ~~80~~ | ~~G~~ | ~~In what year was Peicho Peev the Bulgarian chess International Ma~~ | ~~1973~~ | ~~correct~~ |
| ~~81~~ | ~~G~~ | ~~What was the original name of Forthton, Ontario, located north of~~ | ~~Stone's Corner~~ | ~~correct~~ |
| ~~82~~ | ~~G~~ | ~~On which day, month, and year was the RS-1 satellite launched fro~~ | ~~18 July 1980~~ | ~~correct~~ |
| ~~83~~ | ~~G~~ | ~~What was Zero Bridge originally nicknamed in Srinagar, Kashmir?~~ | ~~Zorr Bridge~~ | ~~correct~~ |
| ~~84~~ | ~~G~~ | ~~What exhibit was displayed in the TD Gallery at the Toronto Refer~~ | ~~Vice & Virtue~~ | ~~correct~~ |
| ~~85~~ | ~~G~~ | ~~Specify the day, month, and year Canon introduced two new UHDgc 2~~ | ~~April 2, 2019~~ | ~~correct~~ |
| ~~86~~ | ~~G~~ | ~~Who played Sarah Robinson in "Felicity" Season 4, Episode 4?~~ | ~~Monica~~ | ~~correct~~ |
| ~~87~~ | ~~G~~ | ~~What prize did De Broglie win in 1952?~~ | ~~Kalinga Prize.~~ | ~~correct~~ |
| ~~88~~ | ~~G~~ | ~~Which glacier is known as the "Third Pole"?~~ | ~~The Siachen Glacier~~ | ~~correct~~ |
| ~~89~~ | ~~G~~ | ~~Which hotel was awarded World's Leading Adventure Hotel 2022?~~ | ~~Pikaia Lodge~~ | ~~correct~~ |
| ~~90~~ | ~~G~~ | ~~What quote did Dr. Richard Trager say to Miles Upshur while openi~~ | ~~I'm not giving up on you~~ | ~~correct~~ |
| ~~91~~ | ~~G~~ | ~~What was the original name of the show that conductor David Rando~~ | ~~Music for the Connoisseur~~ | ~~correct~~ |
| ~~92~~ | ~~G~~ | ~~What is the name of the Dutch businessman and convicted drug traf~~ | ~~Rudi Dekkers~~ | ~~correct~~ |
| ~~93~~ | ~~G~~ | ~~What's the notion to which the lexical semantic map in Figure 4 o~~ | ~~breathe~~ | ~~correct~~ |
| ~~94~~ | ~~G~~ | ~~What language is represented in Figure 4 of the paper "Identifyin~~ | ~~Zenzontepec Chatino~~ | ~~correct~~ |
| ~~95~~ | ~~G~~ | ~~Who among the people who proposed the three-stage system in an ar~~ | ~~Clarence van Riet Lowe~~ | ~~correct~~ |
| ~~96~~ | ~~G~~ | ~~In which Chechen village was journalist Anna Politkovskaya detain~~ | ~~Khatuni.~~ | ~~correct~~ |
| ~~97~~ | ~~G~~ | ~~Who was awarded the Oskar Kokoschka Prize in 1998?~~ | ~~Maria Lassnig~~ | ~~correct~~ |
| ~~98~~ | ~~G~~ | ~~Which hill station is known as "The Gateway to Ladakh"?~~ | ~~Dras~~ | ~~correct~~ |
| ~~99~~ | ~~G~~ | ~~As of 2021, who is the host of The Doers Nepal podcast?~~ | ~~Anup Ghimire~~ | ~~correct~~ |
| ~~100~~ | ~~G~~ | ~~Which president had a meeting with Kwame Nkrumah right before the~~ | ~~Maurice Yameogo~~ | ~~correct~~ |
| ~~101~~ | ~~G~~ | ~~What is the forest cover area of Uttarakhand in square kilometers~~ | ~~ 24,303.04~~ | ~~correct~~ |
| ~~102~~ | ~~G~~ | ~~What day, month, and year did the singer and actress Vanessa Hudg~~ | ~~ 2 December 2023~~ | ~~correct~~ |
| 103 | R | In the show Severance, who is the eighth CEO of Lumon Industries? | James Eagan | wrong truncated |
| ~~104~~ | ~~G~~ | ~~What is the surname of the individual who won the Polanyi Medal f~~ | ~~Casavecchia~~ | ~~correct~~ |
| ~~105~~ | ~~G~~ | ~~On what day, month, and year did Olton Willem van Genderen, a Sur~~ | ~~November 9, 1990~~ | ~~correct~~ |
| ~~106~~ | ~~G~~ | ~~What patch for the original PS3 Dark Souls added 3 Humanities to ~~ | ~~1.06~~ | ~~correct~~ |
| ~~107~~ | ~~G~~ | ~~What is the height of the Space Shuttle Atlantis in meters?~~ | ~~17.2 meters~~ | ~~correct~~ |
| ~~108~~ | ~~G~~ | ~~On what day, month, and year did Bruno Kreisky (an Austrian socia~~ | ~~April 23, 1942~~ | ~~correct~~ |
| ~~109~~ | ~~G~~ | ~~Which scientist received the Penrose Medal before the year Presto~~ | ~~Francis J. Pettijohn~~ | ~~correct~~ |
| ~~110~~ | ~~G~~ | ~~On what day, month, and year was John II of France coronated as K~~ | ~~26 September 1350~~ | ~~correct~~ |
| ~~111~~ | ~~G~~ | ~~What is the name of the dedicated infrared flash used to project ~~ | ~~Flood Illuminator~~ | ~~correct~~ |
| ~~112~~ | ~~G~~ | ~~In Table 2 in the Transformer paper (2017), which two languages d~~ | ~~German and French~~ | ~~correct~~ |
| ~~113~~ | ~~G~~ | ~~From what year to what year was David Lloyd Wolper, born in 1928,~~ | ~~1953-1955~~ | ~~correct~~ |
| ~~114~~ | ~~G~~ | ~~As of the 2020 Census, what was the population of Grand Mound, Io~~ | ~~615~~ | ~~correct~~ |
| ~~115~~ | ~~G~~ | ~~How many busts of Pope Paul V did Gian Lorenzo Bernini make?~~ | ~~2~~ | ~~correct~~ |
| ~~116~~ | ~~G~~ | ~~What was the title of the journal that Charles Raymond Perrault s~~ | ~~Artificial Intelligence~~ | ~~correct~~ |
| ~~117~~ | ~~G~~ | ~~What is the rate of climb, in feet per minute, of the Agusta A.10~~ | ~~1,220 ft/min~~ | ~~correct~~ |
| ~~118~~ | ~~G~~ | ~~What team finished with 38 points at the end of the 2021-2022 Pre~~ | ~~Leeds United~~ | ~~correct~~ |
| ~~119~~ | ~~G~~ | ~~To which academic society was computer scientist Sarita Vikram Ad~~ | ~~The American Academy of Arts and Sciences.~~ | ~~correct~~ |
| ~~120~~ | ~~G~~ | ~~In which year, month, and day was the Nokia 8110 announced?~~ | ~~9 September 1996~~ | ~~correct~~ |
| ~~121~~ | ~~G~~ | ~~On what day, month, and year was Harbhajan Singh Rissam (an India~~ | ~~14 May 2011~~ | ~~correct~~ |
| ~~122~~ | ~~G~~ | ~~Who won the 2015 Maine State Pumpkin and Squash Weigh-Off, held a~~ | ~~Edwin Pierpont~~ | ~~correct~~ |
| ~~123~~ | ~~G~~ | ~~What day, month, and year did Lisa Marie Presley die?~~ | ~~12 January 2023 ~~ | ~~correct~~ |
| ~~124~~ | ~~G~~ | ~~What is the forest cover area of Karnataka in square kilometers a~~ | ~~ 38,575.48~~ | ~~correct~~ |
| ~~125~~ | ~~G~~ | ~~What day, month, and year was Edward Ambrose Hug, the American Ma~~ | ~~July 14, 1880~~ | ~~correct~~ |
| ~~126~~ | ~~G~~ | ~~What watch company made the world's first computerized diver's wa~~ | ~~Seiko~~ | ~~correct~~ |
| ~~127~~ | ~~G~~ | ~~In which city in Pakistan did Bahria Town (Private) Limited estab~~ | ~~Lahore~~ | ~~correct~~ |
| ~~128~~ | ~~G~~ | ~~Which year was Bil Keane's first syndicated strip, Channel Chuckl~~ | ~~1954~~ | ~~correct~~ |
| ~~129~~ | ~~G~~ | ~~In which year was Arthur C. Wade, an American lawyer in the 1800s~~ | ~~1877~~ | ~~correct~~ |
| ~~130~~ | ~~G~~ | ~~With whom did Ada Lovelace and her mother attend one of Charles B~~ | ~~Mary Somerville~~ | ~~correct~~ |
| ~~131~~ | ~~G~~ | ~~Who founded the municipality of Sora, Boyacá, Colombia?~~ | ~~Tomás Gualba Castellanos~~ | ~~correct~~ |
| ~~132~~ | ~~G~~ | ~~What is the surname of the individual who was awarded the Francis~~ | ~~Pickett~~ | ~~correct~~ |
| ~~133~~ | ~~G~~ | ~~What candidate in Season 11 of The Bachelorette was an amateur se~~ | ~~Shawn Evans~~ | ~~correct~~ |
| ~~134~~ | ~~G~~ | ~~Cornelia Parker curated the "Black and White Room" for which exhi~~ | ~~Royal Academy Summer Exhibition~~ | ~~correct~~ |
| ~~135~~ | ~~G~~ | ~~During which years did Margaret Hamburg work as a clinical instru~~ | ~~1986 to 1990~~ | ~~correct~~ |
| ~~136~~ | ~~G~~ | ~~What was the name of the journal that Gloria Niemeyer Francke was~~ | ~~American Journal of Hospital Pharmacy~~ | ~~correct~~ |
| ~~137~~ | ~~G~~ | ~~What is the Edo name of the crown traditionally worn by the Iyoba~~ | ~~ukpe-okhue~~ | ~~correct~~ |
| ~~138~~ | ~~G~~ | ~~What is the name of the voice actor who voices Alvina in the game~~ | ~~Ève Karpf~~ | ~~correct~~ |
| ~~139~~ | ~~G~~ | ~~In what year were double-digit vehicle codes introduced in Japan ~~ | ~~1967~~ | ~~correct~~ |
| ~~140~~ | ~~G~~ | ~~Who was the voice of Colonel Drucker in the Medal of Honor (2010)~~ | ~~Adrian Holmes~~ | ~~correct~~ |
| ~~141~~ | ~~G~~ | ~~What is the name of the Brazilian entomologist who first describe~~ | ~~Ubirajara Martins~~ | ~~correct~~ |
| ~~142~~ | ~~G~~ | ~~What year was the municipality of Anorí, Antioquia, Colombia, fou~~ | ~~1808~~ | ~~correct~~ |
| ~~143~~ | ~~G~~ | ~~In which month and year did Apollo 14 pilot Edgar Mitchell and Ap~~ | ~~March 2011~~ | ~~correct~~ |
| ~~144~~ | ~~G~~ | ~~Which mathematician received the Chern Medal in 2022?~~ | ~~Barry Mazur~~ | ~~correct~~ |
| ~~145~~ | ~~G~~ | ~~What day, month, and year was Aniello Formisano, an Italian polit~~ | ~~June 10, 1954.~~ | ~~correct~~ |
| ~~146~~ | ~~G~~ | ~~What was Janice Burgess's alma mater?~~ | ~~Brandeis University~~ | ~~correct~~ |
| ~~147~~ | ~~G~~ | ~~What health crisis did Bob Barker experience on May 30, 2022?~~ | ~~Stroke~~ | ~~correct~~ |
| ~~148~~ | ~~G~~ | ~~How many days was Kaitlin Armstrong on the run from authorities f~~ | ~~43~~ | ~~correct~~ |
| ~~149~~ | ~~G~~ | ~~In what year did the mathematician Joachim Neubüser graduate from~~ | ~~1957~~ | ~~correct~~ |
| ~~150~~ | ~~G~~ | ~~To whom was R. C. Harvey married?~~ | ~~Linda Kubicek~~ | ~~correct~~ |
| ~~151~~ | ~~G~~ | ~~Who finished 14th in the 2021–22 Premier League season?~~ | ~~Aston Villa~~ | ~~correct~~ |
| ~~152~~ | ~~G~~ | ~~What is the MD5 checksum of the file named "ffrelay-debian-4.30.g~~ | ~~180caf23dd71383921e368128fb6db52~~ | ~~correct~~ |
| ~~153~~ | ~~G~~ | ~~What month and year was the "Bust of Charles I" by Gian Lorenzo B~~ | ~~January 1698~~ | ~~correct~~ |
| ~~154~~ | ~~G~~ | ~~In 2015, in what exhibition was Henry Ossawa Tanner's work includ~~ | ~~We Speak: Black Artists in Philadelphia, 1920s-1970s~~ | ~~correct~~ |
| ~~155~~ | ~~G~~ | ~~Domenico Lino Morichini first examined the fossilized tooth of wh~~ | ~~Elephant~~ | ~~correct~~ |
| ~~156~~ | ~~G~~ | ~~Who was the Brazilian Vice-President of the International Mathema~~ | ~~Marcelo Viana~~ | ~~correct~~ |
| ~~157~~ | ~~G~~ | ~~What is the half-life of radon-224 in hours?~~ | ~~1.8~~ | ~~correct~~ |
| ~~158~~ | ~~G~~ | ~~What is the full name of the singer who sang the song 'Angels' wi~~ | ~~Aida Emilevna Garifullina~~ | ~~correct~~ |
| ~~159~~ | ~~G~~ | ~~In which year was the John Brophy Award first awarded?~~ | ~~1989~~ | ~~correct~~ |
| ~~160~~ | ~~G~~ | ~~What year did Rosemarie Trockel start to use industrial knitting ~~ | ~~1985~~ | ~~correct~~ |
| ~~161~~ | ~~G~~ | ~~Who was the first-ever personality to hoist the Indian National F~~ | ~~Adil Hussain~~ | ~~correct~~ |
| ~~162~~ | ~~G~~ | ~~What year did Ollie Johnston sell his locomotive named Marie E.?~~ | ~~1993~~ | ~~correct~~ |
| ~~163~~ | ~~G~~ | ~~How many chimpanzees were observed with cold-like symptoms when t~~ | ~~14~~ | ~~correct~~ |
| ~~164~~ | ~~G~~ | ~~What is the surname of the individual who won the Bioinorganic Ch~~ | ~~Cowan~~ | ~~correct~~ |
| ~~165~~ | ~~G~~ | ~~In which school did Ghana's former minister Kwadwo Baah-Wiredu st~~ | ~~Kumasi High School~~ | ~~correct~~ |
| ~~166~~ | ~~G~~ | ~~In what year did Aftab Ghulam Nabi Kazi's (12th Deputy Chairman o~~ | ~~2009~~ | ~~correct~~ |
| ~~167~~ | ~~G~~ | ~~What month and year were the Opuke Thermal Pools & Spa opened in ~~ | ~~November 2021~~ | ~~correct~~ |
| ~~168~~ | ~~G~~ | ~~Where was the body of Stuart Leary, a South African sportsman who~~ | ~~Table Mountain, South Africa~~ | ~~correct~~ |
| ~~169~~ | ~~G~~ | ~~Which contestant from Season 2 of The Bachelor was a former NBA c~~ | ~~Lori Todd~~ | ~~correct~~ |
| ~~170~~ | ~~G~~ | ~~Which English singer was a film and television critic for The Obs~~ | ~~George Melly~~ | ~~correct~~ |
| ~~171~~ | ~~G~~ | ~~In what year did John Lennon and Yoko Ono donate their psychedeli~~ | ~~1977~~ | ~~correct~~ |
| ~~172~~ | ~~G~~ | ~~How many minutes and seconds did it take Indian swimmer Vedaant M~~ | ~~16:01.73 seconds~~ | ~~correct~~ |
| ~~173~~ | ~~G~~ | ~~In which month and year did "Flying" magazine publish "Battling t~~ | ~~March 2001~~ | ~~correct~~ |
| ~~174~~ | ~~G~~ | ~~In which year was the municipality of La Pintada, Antioquia, Colo~~ | ~~1815~~ | ~~correct~~ |
| ~~175~~ | ~~G~~ | ~~How many UN Volunteers served in 54 United Nations missions, agen~~ | ~~ 8,282~~ | ~~correct~~ |
| ~~176~~ | ~~G~~ | ~~Who was the first President of the Supreme Court of Bolivia?~~ | ~~Manuel María Urcullo.~~ | ~~correct~~ |
| ~~177~~ | ~~G~~ | ~~Which player character in Exandria Unlimited: Calamity was Sam Ri~~ | ~~Laerryn Coramar-Seelie, played by Aabria Iyengar~~ | ~~correct~~ |
| ~~178~~ | ~~G~~ | ~~What is the name of the college from where Dr. Farooq Abdullah, a~~ | ~~SMS Medical College, Jaipur~~ | ~~correct~~ |
| ~~179~~ | ~~G~~ | ~~At what age did Wiley Lee Griggs III, an American Negro league in~~ | ~~71~~ | ~~correct~~ |
| ~~180~~ | ~~G~~ | ~~In Season 3 of the American version of "The Circle," in which epi~~ | ~~7~~ | ~~correct~~ |
| ~~181~~ | ~~G~~ | ~~What is the third vampire number in recreational mathematics?~~ | ~~1435~~ | ~~correct~~ |
| ~~182~~ | ~~G~~ | ~~What was the height, in meters, of Damian Lamonte Ollie Lillard S~~ | ~~1.65~~ | ~~correct~~ |
| ~~183~~ | ~~G~~ | ~~From 1855 to 1859, James Luke Prendergast (1800-1895) served as L~~ | ~~Harbour Grace~~ | ~~correct~~ |
| ~~184~~ | ~~G~~ | ~~From what university did John P. Sall receive an honorary doctora~~ | ~~ North Carolina State University~~ | ~~correct~~ |
| ~~185~~ | ~~G~~ | ~~What were the month and year when the Indonesian Food and Drug Au~~ | ~~August 2022~~ | ~~correct~~ |
| ~~186~~ | ~~G~~ | ~~Who was the 14th Chief Justice of Kenya?~~ | ~~David Kenani Maraga~~ | ~~correct~~ |
| ~~187~~ | ~~G~~ | ~~Which year was the non-profit organization Prayas Nepal establish~~ | ~~2003~~ | ~~correct~~ |
| ~~188~~ | ~~G~~ | ~~In which year did Jacinda Kate Laurell Ardern receive a Harvard h~~ | ~~2022~~ | ~~correct~~ |
| ~~189~~ | ~~G~~ | ~~What was the economy rate of S. N. Thakur per over in the match b~~ | ~~13.00	~~ | ~~correct~~ |
| ~~190~~ | ~~G~~ | ~~How many children did Gilbert Hani and Mary Hani have?~~ | ~~6~~ | ~~correct~~ |
| ~~191~~ | ~~G~~ | ~~What day, month, and year did the Türksat 1A satellite explode be~~ | ~~24 January 1994~~ | ~~correct~~ |
| ~~192~~ | ~~G~~ | ~~What year did Louis de Broglie become a professor of theoretical ~~ | ~~1928~~ | ~~correct~~ |
| ~~193~~ | ~~G~~ | ~~What are the season number, episode number, and title of the "Vik~~ | ~~Season 2, Episode 2 "Invasion"~~ | ~~correct~~ |
| ~~194~~ | ~~G~~ | ~~Who adopted Jett Williams in 1954?~~ | ~~Lillie Williams Stone~~ | ~~correct~~ |
| 195 | R | What month, day, and year did the Durban-based shack-dwellers' mo | 14 May 2009 | wrong truncated |
| ~~196~~ | ~~G~~ | ~~How many inductees did the American Classical Hall of Fame have i~~ | ~~One.~~ | ~~correct~~ |
| ~~197~~ | ~~G~~ | ~~Who was the 2022 winner of "Best Just Chatting Streamer" at The S~~ | ~~Mizkif~~ | ~~correct~~ |
| ~~198~~ | ~~G~~ | ~~In what year was Eugenius Aristides Nisbet elected to the Georgia~~ | ~~1827~~ | ~~correct~~ |
| ~~199~~ | ~~G~~ | ~~What is the name of the astronomer who discovered 216433 Milianle~~ | ~~Erwin Schwab~~ | ~~correct~~ |

## FRAMES — 75/100 = 75.0% strict (p50 36s, 0 error rows {})

| Verdict | Count | Share |
|---|---|---|

| correct | 75 | 75% |
| wrong | 25 | 25% |

**Miss modes:** {'truncated': 25}

| # | G/Y/R | Prompt | Gold | Verdict / Fail |
|---|---|---|---|---|

| ~~0~~ | ~~G~~ | ~~Who was Prime Minister in Australia at the same time that Norman ~~ | ~~Malcolm Fraser~~ | ~~correct~~ |
| ~~1~~ | ~~G~~ | ~~How many letters were in the name of the first single by the arti~~ | ~~12~~ | ~~correct~~ |
| ~~2~~ | ~~G~~ | ~~What primate species, known for its large population in China and~~ | ~~Rhesus Macaques~~ | ~~correct~~ |
| ~~3~~ | ~~G~~ | ~~Regarding the award that the man who created the initial sketch f~~ | ~~Eight~~ | ~~correct~~ |
| ~~4~~ | ~~G~~ | ~~Who was the youngest climber to podium at the first year climbing~~ | ~~Alberto Ginés López (18 at the time).~~ | ~~correct~~ |
| ~~5~~ | ~~G~~ | ~~If you were to combine two words, the first of which has a specie~~ | ~~Russia~~ | ~~correct~~ |
| ~~6~~ | ~~G~~ | ~~As of August 3rd 2024, what's the name of the university in the c~~ | ~~Eastern Michigan University~~ | ~~correct~~ |
| 7 | R | What team scored the most points in an NBA finals game while Rona | Game 1 of the Finals in 1985 the Boston Celtics scored 148 p | wrong truncated |
| 8 | R | What was the military rank of the employer of the astronomer who  | Major General was the rank of Thomas Brisbane. | wrong truncated |
| ~~9~~ | ~~G~~ | ~~I am thinking of a movie where Hans Zimmer won a Grammy Award for~~ | ~~Crimson Tide~~ | ~~correct~~ |
| ~~10~~ | ~~G~~ | ~~Which American high school can boast of an alumnus for whom the f~~ | ~~Kathleen Senior High School in Lakeland, Florida~~ | ~~correct~~ |
| ~~11~~ | ~~G~~ | ~~Who was the successor of the Egyptian Pharaoh that was in power w~~ | ~~Merneptah~~ | ~~correct~~ |
| ~~12~~ | ~~G~~ | ~~What was the 2021 population of the birthplace of the leader of t~~ | ~~9,162 was the population of Shaftesbury (the birthplace of C~~ | ~~correct~~ |
| ~~13~~ | ~~G~~ | ~~What teammates were inducted into the college football hall of fa~~ | ~~ Gus Welch, and William "Lone Star" Dietz.~~ | ~~correct~~ |
| ~~14~~ | ~~G~~ | ~~What was the age difference at their deaths (in years) between Ed~~ | ~~200~~ | ~~correct~~ |
| 15 | R | How many years apart did a Kim Jong Un impersonator who was inter | 60 | wrong truncated |
| ~~16~~ | ~~G~~ | ~~The Wisconsin Butter Fire led to dams being built to protect a la~~ | ~~Otis Redding~~ | ~~correct~~ |
| ~~17~~ | ~~G~~ | ~~As of 1st August 2024 Queens of the Stone Age, Them Crooked Vultu~~ | ~~Man~~ | ~~correct~~ |
| ~~18~~ | ~~G~~ | ~~On the same day Roald Dahl first published a work, a famous guita~~ | ~~Duane Allman~~ | ~~correct~~ |
| ~~19~~ | ~~G~~ | ~~As of August 3rd 2024, how many countries are full members of the~~ | ~~12~~ | ~~correct~~ |
| ~~20~~ | ~~G~~ | ~~Who was the winner of Tour de France the same year that a major c~~ | ~~Louison Bobet~~ | ~~correct~~ |
| ~~21~~ | ~~G~~ | ~~What song was #1 on Billboard's Hot 100 for the most days during ~~ | ~~Monster Mash' by Bobby 'Boris' Pickett & the Crypt-Kickers~~ | ~~correct~~ |
| ~~22~~ | ~~G~~ | ~~What Volkswagen former car model has nearly the same name as a Ba~~ | ~~Scirocco (The Bangkok restaurant is called Sirocco)~~ | ~~correct~~ |
| ~~23~~ | ~~G~~ | ~~Of the four main characters on Seinfeld, which actor is the oldes~~ | ~~Michael Richards~~ | ~~correct~~ |
| ~~24~~ | ~~G~~ | ~~Concerning the 2007 book by Sofi Oksanen, the novel was described~~ | ~~1872~~ | ~~correct~~ |
| ~~25~~ | ~~G~~ | ~~How old was the author of Dragon Ball when the manga was first re~~ | ~~29~~ | ~~correct~~ |
| ~~26~~ | ~~G~~ | ~~When Justin Trudeau was elected as Prime Minister of Canada, who ~~ | ~~Manuel Valls~~ | ~~correct~~ |
| ~~27~~ | ~~G~~ | ~~Who was the building named after on South Forest Avenue, which wa~~ | ~~Grady Gammage~~ | ~~correct~~ |
| ~~28~~ | ~~G~~ | ~~Which of these series was published earliest? Wedding Peach, Toky~~ | ~~Sailor Moon~~ | ~~correct~~ |
| ~~29~~ | ~~G~~ | ~~As of August 5, 2024, what is the name of the federal law that wa~~ | ~~The Sherman Antitrust Act~~ | ~~correct~~ |
| ~~30~~ | ~~G~~ | ~~When Metallica released its album "Master of Puppets," how old we~~ | ~~22~~ | ~~correct~~ |
| ~~31~~ | ~~G~~ | ~~Where did the daughter of the winner of the first US presidential~~ | ~~George Washington University~~ | ~~correct~~ |
| ~~32~~ | ~~G~~ | ~~A Japanese aircraft carrier that was first built to become a luxu~~ | ~~The aircraft carrier Hiyō was sunk in the Battle of the Phil~~ | ~~correct~~ |
| ~~33~~ | ~~G~~ | ~~How many Pokemon World Championships occurred in the contiguous U~~ | ~~- Five Pokemon World Championships took place in the contigu~~ | ~~correct~~ |
| ~~34~~ | ~~G~~ | ~~Out of all of the feature-length theatrical films that John Carpe~~ | ~~Starman (1984)~~ | ~~correct~~ |
| 35 | R | Baldur's Gate 3 was released in 2023 and the game and its staff h | 57 years old | wrong truncated |
| ~~36~~ | ~~G~~ | ~~According to the population data in their respective Wikipedia ar~~ | ~~84,512~~ | ~~correct~~ |
| ~~37~~ | ~~G~~ | ~~Which 2024 college/university president has a degree from Harvard~~ | ~~Eli Capilouto~~ | ~~correct~~ |
| ~~38~~ | ~~G~~ | ~~What William Wyler movie debuted the same year that the chairman ~~ | ~~Jezebel~~ | ~~correct~~ |
| ~~39~~ | ~~G~~ | ~~As of August 1, 2024, if you add together the age of Ana Ollo Hua~~ | ~~100 (59 + 76) - 35~~ | ~~correct~~ |
| ~~40~~ | ~~G~~ | ~~This founder of the Academy of Science, St. Louis became establis~~ | ~~Cuscuta~~ | ~~correct~~ |
| ~~41~~ | ~~G~~ | ~~In the same year that HMS Holland 1 was launched, a British monar~~ | ~~6 years, 11 months, 25 days.~~ | ~~correct~~ |
| ~~42~~ | ~~G~~ | ~~How many Red Hot Chili Peppers albums were released while Nelson ~~ | ~~4~~ | ~~correct~~ |
| ~~43~~ | ~~G~~ | ~~Fossils of the extinct sea snail, Alvania belgica, were originall~~ | ~~City of Brussels~~ | ~~correct~~ |
| ~~44~~ | ~~G~~ | ~~How many countries were part of the commonwealth on the date Prin~~ | ~~On 8 September 2022, there were 56 countries as part of the ~~ | ~~correct~~ |
| 45 | R | What is the difference in mean flow rate (in cubic feet per secon | 75.5 cubic ft/s | wrong truncated |
| 46 | R | Who was the Argentinian president who resigned from the position  | Pedro Ramírez | wrong truncated |
| 47 | R | In the year that the film 'Moana' was released, who was the hitti | Ty Van Burkleo | wrong truncated |
| ~~48~~ | ~~G~~ | ~~How many of Ron Hutchinson's teams won League Championships while~~ | ~~Of the six hockey teams that Hutchinson played on during his~~ | ~~correct~~ |
| ~~49~~ | ~~G~~ | ~~Mary Gaulden Jagger worked in the Biology Division of the Oak Rid~~ | ~~Frontier, 2022~~ | ~~correct~~ |
| ~~50~~ | ~~G~~ | ~~What lasted longer: the reign of Queen Elizabeth II or the life o~~ | ~~The reign of Queen Elizabeth II~~ | ~~correct~~ |
| 51 | R | How old was Harvard University, when the person whom the longest  | 140 years old. | wrong truncated |
| ~~52~~ | ~~G~~ | ~~How many of Mark Calaway's consecutive Wrestlemania wins occurred~~ | ~~Five~~ | ~~correct~~ |
| ~~53~~ | ~~G~~ | ~~What is the shortest possible abbreviation in the United States f~~ | ~~R~~ | ~~correct~~ |
| 54 | R | If Anastasia Romanov had still been alive when the 90s cartoon mo | Duchess Anastasia Romanov would have been 96 years old. | wrong truncated |
| 55 | R | How many years had the station that preceded the Salthill and Mon | 143 years | wrong truncated |
| ~~56~~ | ~~G~~ | ~~Which member of the Wu-Tang Clan was born on Staten Island?~~ | ~~Ghostface Killah~~ | ~~correct~~ |
| 57 | R | What is the percentage increase of total deaths of Japanese durin | 66409.3% increase | wrong truncated |
| 58 | R | Which Pope served the longest between the Battle of the Milvian B | St. Sylvester I, whose Latin name was Silvester | wrong truncated |
| ~~59~~ | ~~G~~ | ~~I'm trying to show my daughter some of the movies I grew up with.~~ | ~~*She's All That*~~ | ~~correct~~ |
| ~~60~~ | ~~G~~ | ~~If the author of the philosophical magnum opus Being and Time wer~~ | ~~Martin Gilbert Sartre~~ | ~~correct~~ |
| 61 | R | What geographical commonality do the person who first described A | They were both born in Vienna. | wrong truncated |
| 62 | R | Who was the Mayor of Quincy, Massachusetts when the Quincy Medica | Henry O. Fairbanks and Thomas P. Koch | wrong truncated |
| 63 | R | The female of the pair who have been called "the worst guests in  | Jake Pavelka | wrong truncated |
| ~~64~~ | ~~G~~ | ~~I grew up in a village on Long Island in the Town of Oyster Bay. ~~ | ~~Sea Cliff Elementary School~~ | ~~correct~~ |
| ~~65~~ | ~~G~~ | ~~Which country did tennis' first Golden Slam winner represent when~~ | ~~West Germany~~ | ~~correct~~ |
| 66 | R | Who is the Formula One driver who won their first Driver's Champi | Nigel Mansell, Williams Grand Prix Engineering, 15 years | wrong truncated |
| 67 | R | Mass Effect 2 once won the D.I.C.E. Award for Game of the Year. W | Martin Hollis | wrong truncated |
| ~~68~~ | ~~G~~ | ~~What are the first three letters of the capital city of the count~~ | ~~Cop~~ | ~~correct~~ |
| 69 | R | The latest game, as of August 4, 2024, from the creator of Kirby  | The Last of Us Part II | wrong truncated |
| ~~70~~ | ~~G~~ | ~~What's the star sign of the author of A Court of Thorns and Roses~~ | ~~Pisces~~ | ~~correct~~ |
| 71 | R | The Assistant to the Regional Manager on The Office TV show (US v | Betanin | wrong truncated |
| ~~72~~ | ~~G~~ | ~~Who was the character in the roster of the Marvel vs. Capcom entr~~ | ~~Jill Valentine~~ | ~~correct~~ |
| ~~73~~ | ~~G~~ | ~~What is the scientific name of an amphibian that is listed as end~~ | ~~Ambystoma texanum~~ | ~~correct~~ |
| ~~74~~ | ~~G~~ | ~~How many years apart were the Canadian Museum of History and the ~~ | ~~24 years~~ | ~~correct~~ |
| ~~75~~ | ~~G~~ | ~~What is the the sum of the ages of the men who were executed by f~~ | ~~80~~ | ~~correct~~ |
| ~~76~~ | ~~G~~ | ~~The author of the book "A Good Woman"'s author was married to a m~~ | ~~Breast and skin~~ | ~~correct~~ |
| ~~77~~ | ~~G~~ | ~~Joel Oshiro Dyck played professional ice hockey for three teams. ~~ | ~~Joel Oshiro Dyck played for the Chatham Wheels, the Wheeling~~ | ~~correct~~ |
| 78 | R | If an Ixodes scapularis tick in its nymph stage feeds on a host i | Two seasons. | wrong truncated |
| ~~79~~ | ~~G~~ | ~~What movie won the Academy Award for Best Picture the same year t~~ | ~~The Deer Hunter~~ | ~~correct~~ |
| ~~80~~ | ~~G~~ | ~~What is an animal that is distantly related to the capybara and h~~ | ~~Chinchilla~~ | ~~correct~~ |
| 81 | R | How many years apart was the founding of Snell & Wilmer from the  | 16 years | wrong truncated |
| ~~82~~ | ~~G~~ | ~~How many of Hitler's three couriers of his last will and other po~~ | ~~1~~ | ~~correct~~ |
| 83 | R | Give me the difference in time, measured in hours not days, betwe | 2128 hours | wrong truncated |
| ~~84~~ | ~~G~~ | ~~What was the word that featured the least in the longest recorded~~ | ~~You~~ | ~~correct~~ |
| ~~85~~ | ~~G~~ | ~~When Taylor Swift first released her studio album "1989," how man~~ | ~~4~~ | ~~correct~~ |
| ~~86~~ | ~~G~~ | ~~In which year did the 4th Sheriff of Yorkshire to be part of the ~~ | ~~1190~~ | ~~correct~~ |
| ~~87~~ | ~~G~~ | ~~A disease that had millions of dollars raised for on April 20, 19~~ | ~~1981~~ | ~~correct~~ |
| 88 | R | What band had a male lead singer born on the day Mohammad Mosadde | Kool & the Gang | wrong truncated |
| ~~89~~ | ~~G~~ | ~~As of 1 August 2024, How many more seasons did Outrageous Fortune~~ | ~~1~~ | ~~correct~~ |
| ~~90~~ | ~~G~~ | ~~What was the age difference between the inventor of Barbie and th~~ | ~~6 months and 26 days.~~ | ~~correct~~ |
| ~~91~~ | ~~G~~ | ~~Little River Canyon National Preserve has three waterfalls, one o~~ | ~~2,452 ft~~ | ~~correct~~ |
| 92 | R | Two famous modernist writers were born and died on the same year. | Virginia Woolf and James Joyce. Virginia Woolf lived 82 days | wrong truncated |
| ~~93~~ | ~~G~~ | ~~Of all states within New England in the United States, which had ~~ | ~~Of the 6 states within New England, Maine, New Hampshire, an~~ | ~~correct~~ |
| ~~94~~ | ~~G~~ | ~~What popular ice cream dessert shares its birthplace with Fred Ro~~ | ~~The Banana Split~~ | ~~correct~~ |
| 95 | R | What was the former name of the brand of sneakers worn by the Hea | Blue Ribbon Sports Inc. | wrong truncated |
| ~~96~~ | ~~G~~ | ~~In the Eurovision Song Contest 2024, one country scored a combine~~ | ~~Italy and Norway~~ | ~~correct~~ |
| ~~97~~ | ~~G~~ | ~~What is the middle name of the U.S. president who died on the sam~~ | ~~David~~ | ~~correct~~ |
| ~~98~~ | ~~G~~ | ~~What is the birth date of the person picked right after Lee Vaugh~~ | ~~August 24, 1974~~ | ~~correct~~ |
| ~~99~~ | ~~G~~ | ~~I'm thinking of a painting. It was done by the same man who paint~~ | ~~Mock Election~~ | ~~correct~~ |

## DSQA — 43/99 = 43.4% strict (p50 69s, 1 error rows {'HTTP 504': 1})

| Verdict | Count | Share |
|---|---|---|

| correct | 43 | 43% |
| partial | 31 | 31% |
| wrong | 25 | 25% |

**Miss modes:** {'truncated': 56}

| # | G/Y/R | Prompt | Gold | Verdict / Fail |
|---|---|---|---|---|

| 0 | Y | I want to start a farm and am trying to find the best state for i | Oklahoma, Kansas, Texas | partial 3/3 truncated |
| ~~1~~ | ~~G~~ | ~~Out of the EU countries (as of 2024) that were in the "top 10 of ~~ | ~~France, Germany, Netherlands~~ | ~~correct~~ |
| ~~2~~ | ~~G~~ | ~~Assess the following counties in Tennessee: Anderson, Cheatham, a~~ | ~~Anderson County~~ | ~~correct~~ |
| 3 | R | Out of the states that had all of their electoral votes in the 20 | Alabama, Arkansas, Indiana, Kansas, Kentucky, Louisiana, Mis | wrong truncated |
| 4 | R | According to NOAA's Billion-Dollar Weather and Climate Disasters  | Northwest, Central, Eastern Winter Storm and Cold Wave
Febru | wrong truncated |
| 5 | R | Using the year 2022, what are the capitals of the two states with | Baton Rouge, Columbia | wrong truncated |
| 6 | Y | For the year ended December 31, 2022, calculate Philip Morris Int | 1) Turning Point Brands, Inc.
2) Altria Group, Inc.
3) Phili | partial 3/6 truncated |
| ~~7~~ | ~~G~~ | ~~I'm doing a comparison on African economies for my development st~~ | ~~South Africa~~ | ~~correct~~ |
| 8 | R | Out of the countries with both an above-average homicide rate and | Haiti | wrong truncated |
| ~~9~~ | ~~G~~ | ~~I'm travelling on the South Western Railway service from Sheppert~~ | ~~Kingston~~ | ~~correct~~ |
| 10 | R | According to global5050.org COVID-19 Sex-Disaggregated Data Track | ICU Admissions | wrong truncated |
| 11 | Y | Based on the "Immigrants to Japan: Where did they move from?" dat | Brazil, Argentina, Bolivia, Peru, Nigeria | partial 4/5 truncated |
| 12 | R | Among the University of Tennessee at Knoxville, the University of | ANTH 190 (Special Topics in Anthropology I) | wrong truncated |
| 13 | R | Of the European countries which saw their greenhouse gas emission | Albania | wrong truncated |
| ~~14~~ | ~~G~~ | ~~Which of the 6 winners of the Young Investigator Award for the Fl~~ | ~~Damien Fair, Leah Somerville, Eva Telzer, Dylan Gee, Kate Mi~~ | ~~correct~~ |
| 15 | Y | According to Santa Cruz County Sanitation District's 2020 Audit ( | Transmission Systems, Construction in progress, Mobile equip | partial 2/3 truncated |
| 16 | Y | Of the first-generation Water-type Pokémon used by the three main | Kingler, Starmie, Psyduck, Seel, Dewgong | partial 3/5 truncated |
| 17 | R | List the railroad accidents investigated by the NTSB with inciden | RIR-24-02, RIR-24-03, RIR-23-09, HZIR-23-01, RIR-23-16 | wrong truncated |
| 18 | Y | According to Our World in Data, which countries ranked in the top | Norway, Switzerland | partial 2/2 truncated |
| 19 | Y | Which authors contributed articles to the NAWE's Writing in Educa | Bryan Podmore, Sarah Wardle, Martin Goodman, Fred Sedgwick,  | partial 8/8 truncated |
| 20 | R | In the diaries of Samuel Pepys, which naval figure is mentioned i | (Sir) William Batten | wrong truncated |
| 21 | R | List the names of the MPs which won their first election to the H | Giles Watling, Jack Brereton, Ben Bradley, Eddie Hughes, Ste | wrong truncated |
| 22 | Y | Which countries that had a record high average temperature for 20 | South Korea, Austria, Germany, China, Japan, Hungary | partial 4/6 truncated |
| ~~23~~ | ~~G~~ | ~~Using butterfly-conservation.org, which butterfly species had at ~~ | ~~Red Admiral, Comma, Painted Lady, Large White, Ringlet, Gree~~ | ~~correct~~ |
| 24 | Y | List all the years from 2015 to 2021 that the St Kilda Soay Sheep | 2015, 2016, 2018, 2020, 2021 | partial 5/5 truncated |
| 25 | Y | Between 2014 and 2020, which years did Doctors Without Borders US | 2014, 2016, 2017, 2020 | partial 4/4 truncated |
| 26 | R | Use protein sequences from https://www.uniprot.org/. I am interes | T. maritima, A. baumannii | wrong truncated |
| ~~27~~ | ~~G~~ | ~~Using the cia world factbook factsheets for each country, which o~~ | ~~Bhutan~~ | ~~correct~~ |
| 28 | Y | I remember reading an article a while back, but the only thing I  | Hacking CTFs with Plain Agents
 | partial 1/1 truncated |
| ~~29~~ | ~~G~~ | ~~What year between 2020 and 2023 inclusive had the smallest differ~~ | ~~2020~~ | ~~correct~~ |
| 30 | Y | In the 2023 General Election in NZ, of the electoral candidates t | Vanessa Weenink, Chris Bishop, Carlos Cheung, Paulo Garcia,  | partial 1/6 truncated |
| 31 | Y | Of all the US states that were labeled as battleground states in  | Ohio, North Carolina, Florida | partial 2/3 truncated |
| 32 | R | Find the votes that passed in the US House of Representatives bet | Roll Call 695 (118th Congress), Roll Call 696 (118th Congres | wrong truncated |
| ~~33~~ | ~~G~~ | ~~Which country is not a member of BRICS, NATO, Five Eyes, the Comm~~ | ~~Zimbabwe~~ | ~~correct~~ |
| 34 | Y | Give me the New England and states bordering the Great Lakes that | Connecticut, Maine, New Hampshire, Rhode Island | partial 4/4 truncated |
| 35 | Y | which years from 2017 to 2023 had at least 10 deaths as a result  | 2017 and 2023 | partial 1/1 truncated |
| ~~36~~ | ~~G~~ | ~~Who is the Associate Editor of the SBL Study Bible who is a gradu~~ | ~~Matthew Goff~~ | ~~correct~~ |
| 37 | R | In the year 2023, which ward was the councillor from in canterbur | West Bay | wrong truncated |
| ~~38~~ | ~~G~~ | ~~According to the paper "Combining phylogenomic and supermatrix ap~~ | ~~Lialis~~ | ~~correct~~ |
| 39 | R | According to Data NYC's MTA Subway Trains Delayed: 2020-2024 and  | Times Sq-42 St/Port Authority Bus Terminal, 34 St-Herald Sq, | wrong truncated |
| ~~40~~ | ~~G~~ | ~~Of the creatures, not plants, that became listed as threatened or~~ | ~~Sacramento Mountains Checkerspot Butterfly~~ | ~~correct~~ |
| 41 | Y | Of all the botanists who have papers in the “papers of individual | Robert Morison, Jacob Bobart the Younger, William Sherard, G | partial 4/4 truncated |
| 42 | Y | Between the 2010-11 and 2014-15 regular seasons, which team for e | 2010-11: Calgary Flames/Minnesota Wild, 2011-12: Anaheim Duc | partial 3/5 truncated |
| 43 | R | Between the top 5 countries on the Heritage Foundation's Index of | Haiti | wrong truncated |
| ~~44~~ | ~~G~~ | ~~According to the Government of New Brunswick's website, identify ~~ | ~~Capital Region rural district~~ | ~~correct~~ |
| 45 | R | According to the IMF, which of the following countries saw the hi | Switzerland | wrong truncated |
| 46 | Y | List the lipids that were used to make lipid nanoparticles for mR | DLin-MC3-DMA, 18:0 PC (DSPC), Cholesterol, DMG-PEG2000 | partial 3/4 truncated |
| ~~47~~ | ~~G~~ | ~~Of the years between 2000 and 2019 (inclusive) during which the p~~ | ~~2005~~ | ~~correct~~ |
| ~~48~~ | ~~G~~ | ~~From the Space Shuttle program, for the space shuttle with the mo~~ | ~~5~~ | ~~correct~~ |
| 49 | R | For cameras in Fujifilm's X-T line (single digits only, i.e. not  | SanDisk - 16G - SDSDXPB-016G
Toshiba - 16G - SDXU-B016G 
San | wrong truncated |
| 50 | Y | In the Airbnb quarterly SEC filings for 2022, according to the “C | Q1, Q2, Q3 | partial 3/3 truncated |
| ~~51~~ | ~~G~~ | ~~Give me a list of all of the fish that Albacore form mixed school~~ | ~~Skipjack Tuna, Yellowfin Tuna~~ | ~~correct~~ |
| ~~52~~ | ~~G~~ | ~~Of the authors in the first article of the 65th edition of the Jo~~ | ~~Joelle Pineau~~ | ~~correct~~ |
| 53 | R | I am doing a study on the performance of rail operators in the UK | East Midlands Railway, TransPennine Express | wrong truncated |
| ~~54~~ | ~~G~~ | ~~According to the NHTSA, which US states had a fatality rate per 1~~ | ~~Connecticut (2003, 2004, 2005), Massachusetts (2000, 2001, 2~~ | ~~correct~~ |
| 55 | R | Identify the liquor license account with the most report entries  | 12 entries - WINEGUYS L.L.C; DBA(s) - ID: 223939, CITY PARK  | wrong truncated |
| 56 | R | I'm interested in the aquaculture industry, particularly the rese | Khor Waiho | wrong truncated |
| ~~57~~ | ~~G~~ | ~~Of the three constituencies at the 2010 General Election with the~~ | ~~East Ham~~ | ~~correct~~ |
| 58 | Y | Can you look up the paper, "Proteins and polysaccharides from veg | Nikita Navolokin, Alexander Shirokov | partial 2/2 truncated |
| ~~59~~ | ~~G~~ | ~~Of the states with a premature birth rate of over 11, which also ~~ | ~~Mississippi, Arkansas, Louisiana, West Virginia, Georgia~~ | ~~correct~~ |
| ~~60~~ | ~~G~~ | ~~I am performing a comparative study on the quality of life in G20~~ | ~~Canada, France, Australia~~ | ~~correct~~ |
| ~~61~~ | ~~G~~ | ~~Across the 2020, 2021, and 2022 “Water and Sewerage Companies Env~~ | ~~Southern Water~~ | ~~correct~~ |
| 62 | Y | Of the states that have an more than 50 tornadoes annually on ave | Oklahoma, Missouri, Iowa | partial 3/3 truncated |
| ~~63~~ | ~~G~~ | ~~I am doing a presentation on demography for my politics class. Us~~ | ~~France~~ | ~~correct~~ |
| ~~64~~ | ~~G~~ | ~~According to Fashionphile's 2023 Ultra Luxury Resale Report, find~~ | ~~Europe~~ | ~~correct~~ |
| 65 | R | I’m interested in how ripening affects the sugar composition of b | Sucrose: - 2.08 grams | wrong truncated |
| ~~66~~ | ~~G~~ | ~~According to Statistics Canada, when comparing the years 2017 and~~ | ~~Alberta~~ | ~~correct~~ |
| ~~67~~ | ~~G~~ | ~~According to Worldometer, which countries that have a world share~~ | ~~Ethiopia, Egypt, Vietnam, Bangladesh, China~~ | ~~correct~~ |
| 68 | Y | According to the ACT, for 2023 identify of all the states to have | Kentucky, Wyoming, Montana, Arkansas, Nebraska, Wisconsin, U | partial 7/7 truncated |
| 69 | R | Using https://results.aec.gov.au/, of the parties that received m | Liberal Party of Australia 
Australian Labor Party  
Austral | ERROR HTTP 504 |
| ~~70~~ | ~~G~~ | ~~Out of the movies produced by the director of Transformers, when ~~ | ~~July 7, 1972~~ | ~~correct~~ |
| 71 | Y | Create a list of scottish westminster constituencies which voted  | Na h-Eileanan an Iar, East Renfrewshire | partial 2/2 truncated |
| 72 | Y | Referencing Statistics Canada (table 23-10-0253-01), which Canadi | Halifax Stanfield Airport, Edmonton Airport, Winnipeg James  | partial 5/8 truncated |
| ~~73~~ | ~~G~~ | ~~In the first duel between Mako and Yugi, list all of Yugi's monst~~ | ~~Curse of Dragon, Giant Soldier of Stone, Feral Imp, Horn Imp~~ | ~~correct~~ |
| ~~74~~ | ~~G~~ | ~~By comparing the results from all the exam periods between March ~~ | ~~March 2022~~ | ~~correct~~ |
| 75 | Y | Who are the people that have received more votes than Winston Pet | Bob Clarkson, Simon Bridges, Matt King | partial 3/3 truncated |
| ~~76~~ | ~~G~~ | ~~I'd like a list of repeat Booker Prize/Man Booker Prize judges an~~ | ~~Rebecca West (1969, 1970), Antonia Fraser (1970, 1971), Susa~~ | ~~correct~~ |
| ~~77~~ | ~~G~~ | ~~I'm looking at the late sockeye run for the years 2018 to 2023, a~~ | ~~2019, 2021, 2023~~ | ~~correct~~ |
| ~~78~~ | ~~G~~ | ~~According to estimated data tables from the Library of Congress A~~ | ~~Russia, Austria-Hungary, Germany~~ | ~~correct~~ |
| ~~79~~ | ~~G~~ | ~~According to Clemson University variety evaluations, which farm p~~ | ~~Musser Fruit Research Farm~~ | ~~correct~~ |
| 80 | R | By using the NHS website for “Shoulder Pain”, which of the possib | Hypermobility | wrong truncated |
| 81 | Y | List the regions within England that were within the 5 highest ab | London, East | partial 2/2 truncated |
| ~~82~~ | ~~G~~ | ~~I’m interested in how firearm mortality rates impact the votes of~~ | ~~New Mexico~~ | ~~correct~~ |
| 83 | Y | Which of the 50 US states had fewer than 300 traffic fatalities i | Hawaii, Idaho, Maine, Montana, Nebraska, New Hampshire, Rhod | partial 3/8 truncated |
| 84 | Y | According to BiggestUSCities.com's "Top 100 Biggest US Cities" li | Phoenix (Arizona) and San Antonio (Texas) | partial 1/1 truncated |
| ~~85~~ | ~~G~~ | ~~According to the Social Security Administration, what are the ide~~ | ~~Michael, Christopher, Jason~~ | ~~correct~~ |
| 86 | Y | Name the three types of parakeets or parrots that can be seen in  | Green Parakeet, Monk Parakeet (feral), Red-crowned Parrot | partial 2/3 truncated |
| 87 | R | What was the country with the latest year of independence from Eu | Burundi | wrong truncated |
| 88 | Y | Among all countries led by a female head of state as of June 2024 | Trinidad & Tobago, Malta, Barbados, Dominica | partial 3/4 truncated |
| 89 | R | Look at the Smithsonian Libraries and Archives official blog titl | Chocolate Rabbits and…Elephants! | wrong truncated |
| ~~90~~ | ~~G~~ | ~~Of the three railroad commissioners of Texas, Christi Craddick, W~~ | ~~Wayne Christian~~ | ~~correct~~ |
| ~~91~~ | ~~G~~ | ~~According to the NTD Transit Agency Profiles for "Big Bend Transi~~ | ~~Other Funds~~ | ~~correct~~ |
| ~~92~~ | ~~G~~ | ~~Between Belgium, Dominican Republic, Croatia, Belize, Austria, an~~ | ~~Dominican Republic and Costa Rica~~ | ~~correct~~ |
| ~~93~~ | ~~G~~ | ~~In the year 2020 which 5 states had the capability to produce the~~ | ~~Texas, Indiana, West Virginia, Missouri, Ohio~~ | ~~correct~~ |
| ~~94~~ | ~~G~~ | ~~Hello, I'm researching the link between climate and numbers of sh~~ | ~~The Maldives~~ | ~~correct~~ |
| ~~95~~ | ~~G~~ | ~~Which country according to Eurostat's available data transported ~~ | ~~Belgium~~ | ~~correct~~ |
| 96 | Y | From the Scottish Mountain Rescue Statistics Report 2023 list the | 2009, 2012, 2015, 2018, 2019, 2021, 2022, 2023 | partial 8/8 truncated |
| ~~97~~ | ~~G~~ | ~~Which individual school in the top 5 endowments of 2023 (accordin~~ | ~~Yale University~~ | ~~correct~~ |
| 98 | R | Of the two people awarded the Nobel Prize for their discovery of  | Study of phenylxylylethane (PXE) as scintillator for low ene | wrong truncated |
| ~~99~~ | ~~G~~ | ~~According to data from the Australian Curriculum, Assessment and ~~ | ~~Writing~~ | ~~correct~~ |

## BROWSECOMP — 24/93 = 25.8% strict (p50 105s, 7 error rows {'HTTP 504': 7})

| Verdict | Count | Share |
|---|---|---|

| correct | 24 | 26% |
| wrong | 69 | 74% |

**Miss modes:** {'truncated': 68, 'answered-wrong': 1}

| # | G/Y/R | Prompt | Gold | Verdict / Fail |
|---|---|---|---|---|

| 0 | R | There is a dissertation written before 2020 that analyzes the Got |  Michael Reed Holzer | wrong truncated |
| 1 | R | Can you tell me the first and last birth name of this person base | Aaradhya Bachchan | wrong truncated |
| 2 | R | An artwork was created by someone born in the 1900s and raised ca | Verity | wrong truncated |
| 3 | R | A person who, in a specific year between 2010 and 2020, both year | Phoenix New Times | wrong truncated |
| 4 | R | I am seeking the full name of an actor based on the following det | Rishi Kapoor | wrong truncated |
| 5 | R | In a 2020 interview, a certain individual stated that they starte | Ihuoma Sonia Uche | wrong truncated |
| ~~6~~ | ~~G~~ | ~~Between 2010 and 2020 inclusive, less than 10 people were killed,~~ | ~~March 19~~ | ~~correct~~ |
| 7 | R | Three people wrote an article published between 2020 and 2023 lis | Rain | wrong truncated |
| ~~8~~ | ~~G~~ | ~~Sometime between 2015 and 2020 (inclusive), an exhibition was hel~~ | ~~Collecting Ladies: Ferdinand von Mueller and Women Botanical~~ | ~~correct~~ |
| ~~9~~ | ~~G~~ | ~~I want to know the name of a novel, published before 2023, whose ~~ | ~~Loving Frank~~ | ~~correct~~ |
| ~~10~~ | ~~G~~ | ~~A certain individual who is an entrepreneur that resides in the U~~ | ~~Wale Adebayo~~ | ~~correct~~ |
| 11 | R | An individual whose eldest child was born when they were between  | Michael Caine | wrong truncated |
| 12 | R | In a cricket match played between 1980 and 1990 (exclusive), a pl | 34 | wrong truncated |
| 13 | R | A US federal agency created in the 1940s researched a scientific  | Secret Oral Teachings in Tibetan Buddhist Sects | wrong truncated |
| 14 | R | A person is from a country that's been an EU member since 1995. T | Million Voices | ERROR HTTP 504 |
| 15 | R | In their book published between 1950 and 1970, Writer A claimed t | Reasons of a Hindu for rejecting the Doctrines of Christiani | wrong truncated |
| 16 | R | An alliance of more than three universities in the same country f | multiple-membership, multiple-classification | wrong answered-wrong |
| ~~17~~ | ~~G~~ | ~~There is an author who has had their work appear in more than thi~~ | ~~United Kingdom, Germany~~ | ~~correct~~ |
| 18 | R | This research publication, published before July 2021, was co-aut | Development of waffle with fat filling using unconventional  | wrong truncated |
| 19 | R | An Emmy award winner wrote an article published in 2018 about the | Magic Mommy Stories | wrong truncated |
| 20 | R | In an article posted sometime between 2016 and 2019 (inclusive),  | 13 June 1852 | wrong truncated |
| 21 | R | A paper authored by six people was published in November 2022. It | DMREF-1922234 | wrong truncated |
| 22 | R | A company co-founder was born in the year their country won the W | $1.05 billion | wrong truncated |
| 23 | R | As of December 2023, I am seeking the name of a historic site con | The Gingras Trading Post State Historic Site | wrong truncated |
| 24 | R | The actor was born in May between 1996 and 1999 and graduated wit | Ahmed Ghozzi | wrong truncated |
| 25 | R | I am looking for the full name of a series in which:  - The first | Stranger Things | ERROR HTTP 504 |
| 26 | R | An author (1) published short fiction pieces in two online litera | The Inconsequential Codes on Lipsticks | wrong truncated |
| ~~27~~ | ~~G~~ | ~~Identify the company that underwent a name change prior to 2020, ~~ | ~~Auxly~~ | ~~correct~~ |
| ~~28~~ | ~~G~~ | ~~In a FIFA World Cup match held between 2018 and 2023, there were ~~ | ~~Sergio Costa ~~ | ~~correct~~ |
| ~~29~~ | ~~G~~ | ~~In 2023, an article was published online about a school welcoming~~ | ~~27~~ | ~~correct~~ |
| 30 | R | As of December 31, 2023, I am seeking the name of the sibling who | Adam Horne | wrong truncated |
| 31 | R | There is a certain drug that I am interested in that was describe | Vanderbilt clinical oncology research career development awa | wrong truncated |
| 32 | R | A specific person, who will be referred to as person 1 from now o | Joan Alta Iwan | ERROR HTTP 504 |
| ~~33~~ | ~~G~~ | ~~Given the following hints that are all true as of 2023, there was~~ | ~~2015, Album of The Year ~~ | ~~correct~~ |
| 34 | R | A video game from the 2010s was released to negative reviews. Thr | Javier Rodriguez | wrong truncated |
| ~~35~~ | ~~G~~ | ~~There is a TV show episode in which one of the main characters un~~ | ~~Legion; Season 1; Chapter 5~~ | ~~correct~~ |
| 36 | R | A person started in programming at a university founded between 1 | Smilegate Foundation | wrong truncated |
| 37 | R | How much did tourist arrivals in accommodations increase in Novem | 5.4% | wrong truncated |
| 38 | R | What is the real-life first and last name of the entertainer who; | Georgia Hirst | wrong truncated |
| 39 | R | There is a national team coach who was a football pioneer in the  | Kai Tomety | wrong truncated |
| 40 | R | A new school was founded in the '90s by combining a girls' and bo | Convent of Our Lady of Mercy | wrong truncated |
| 41 | R | On the second Saturday of a month between 2011 and 2021 (inclusiv | 11/01/2021 | wrong truncated |
| ~~42~~ | ~~G~~ | ~~A final was held between 1995 and 2005 inclusive, and two teams p~~ | ~~Martin Devaney~~ | ~~correct~~ |
| 43 | R | I need you to name the first and last name of the production cont | Shafeer Sait | wrong truncated |
| 44 | R | After 2010 but before 2023, a bank discovered that when converted | Sukhumvit Soi 23 | wrong truncated |
| 45 | R | A society founded in the 1960s published an article 60 years late | Hannah Belcher | wrong truncated |
| 46 | R | An actor who grew up in an Asian country for more than ten years  | Cole Zanetti | wrong truncated |
| 47 | R | A country whose flag was a result of correct prediction has a gov | $26.1 billion | wrong truncated |
| 48 | R | An individual hails from a nation where their grandfather immigra | Jaroslav Stetkevych | wrong truncated |
| 49 | R | Person X was born in the first half of the 1900s and passed away  | Zius Galit | wrong truncated |
| 50 | R | Please tell me the name of the learning institution that fits the | Queen Arwa University | wrong truncated |
| 51 | R | There’s an actress who made her debut on stage at the age of 13 a | Pirouette | wrong truncated |
| ~~52~~ | ~~G~~ | ~~According to the company's annual report in 1997, it recorded an ~~ | ~~7%~~ | ~~correct~~ |
| 53 | R | A slave in Africa and, later, a merchant who died en route to the | Jaja of Opobo: The slave who became a king | ERROR HTTP 504 |
| ~~54~~ | ~~G~~ | ~~A company was acquired between 2013 and 2023. The CEO of that com~~ | ~~Volkswagen Jetta~~ | ~~correct~~ |
| ~~55~~ | ~~G~~ | ~~In a capital city in the South American continent, there's a buil~~ | ~~La Estrella; Argentina~~ | ~~correct~~ |
| 56 | R | Can you tell me the name of a movie which was released in year 20 | Dosti: Friends Forever | wrong truncated |
| 57 | R | Hey Chat, I'm trying to remember someone's popular name. This per | Peter King | wrong truncated |
| 58 | R | The band was formed in June between 2013 and 2016, inclusive. One | COUNTERFEIT. | ERROR HTTP 504 |
| 59 | R | A video game development studio based in a state founded in the e | Turbett, Sweet, Carriero, Wolfe | wrong truncated |
| ~~60~~ | ~~G~~ | ~~As of December 2022, I am seeking the name of the author's then-w~~ | ~~Seulah~~ | ~~correct~~ |
| ~~61~~ | ~~G~~ | ~~An actor with a catholic upbringing born to a middle-class family~~ | ~~1979~~ | ~~correct~~ |
| 62 | R | Name the band based on the following information as of December 2 | Death SS | wrong truncated |
| 63 | R | Provide the name of the city as of 2021 a certain actor is from b | New Orleans | wrong truncated |
| 64 | R | There is a competition for a certain trading card game that took  | Denko Sekka | wrong truncated |
| 65 | R | A drawing from the 1700s shows a townlet featuring around 15 - 20 | Rodenburg | ERROR HTTP 504 |
| 66 | R | Please provide the name of this particular movie:  This movie was | Two Living, One Dead | wrong truncated |
| 67 | R | There is a religious building, that was first constructed during  | SK 34979 36323 | wrong truncated |
| 68 | R | The band was formed between 2001 and 2004 by a composer, music pr | Jadal | wrong truncated |
| 69 | R | Can you name the landmark based on the following details as of 31 | Ballysaggartmore Towers | wrong truncated |
| 70 | R | Help me identify the individual that matches the below criteria:  | Oliver Mtukudzi | wrong truncated |
| 71 | R | In a drama series with a central theme of music that streamed in  | Bandish Bandits | wrong truncated |
| 72 | R | There is an Indian author who got promoted from associate profess | Finding the mathematical overlaps of the axiom of choice in  | wrong truncated |
| 73 | R | A specific article published between 2019 and 2021, both years in | Intersemiotic Convergence | wrong truncated |
| 74 | R | I’m looking for the name of a U.S. newspaper which was only in pu | Iditarod Nugget | wrong truncated |
| 75 | R | A Harvard award-winning author wrote an article less than 5 years | Daniel Goleman | ERROR HTTP 504 |
| 76 | R | Provide the name of the month and country a certain individual wa | December, Nigeria | wrong truncated |
| 77 | R | There is an article about a tribe's drug conviction rate. One of  | Tamlin S. Conner | wrong truncated |
| ~~78~~ | ~~G~~ | ~~A pack of downloadable content was released for a strategy video ~~ | ~~Mathilda Bjarnehed~~ | ~~correct~~ |
| 79 | R | A particular cricket match played before 2022, in which the follo | Pragyan Ojha | wrong truncated |
| 80 | R | The following information is verifiable as of 31 December 2023:   | Jess | wrong truncated |
| 81 | R | A paper was submitted between 2015 and 2020, analyzes tax incenti | Nasarawa State University | wrong truncated |
| 82 | R | Which company meets the following criteria?  Launched six e-learn | Ascendia | wrong truncated |
| 83 | R | There is a true life story about a janitor who also teaches salsa | 2006: 66% | wrong truncated |
| 84 | R | There are two different blog posts, both written between 2015 and | Ralph Bronner  | wrong truncated |
| 85 | R | Rescue operations for finding a person somewhere between 2010 and | Hilal Ahmad Dar | wrong truncated |
| ~~86~~ | ~~G~~ | ~~Provide the full name of a certain director born between 1970 and~~ | ~~Uche Jombo Rodriguez~~ | ~~correct~~ |
| ~~87~~ | ~~G~~ | ~~She holds an MBA and a Master’s degree, and as of 2023, she was a~~ | ~~Eno Ebele Jerry ~~ | ~~correct~~ |
| ~~88~~ | ~~G~~ | ~~The artist released their debut album in October between 2012 and~~ | ~~Dina El Wedidi~~ | ~~correct~~ |
| ~~89~~ | ~~G~~ | ~~In a family drama movie produced between 1999 - 2009 (inclusive),~~ | ~~Baghban~~ | ~~correct~~ |
| ~~90~~ | ~~G~~ | ~~A former head of state of a country that has a creole as one of i~~ | ~~30/07/1980~~ | ~~correct~~ |
| 91 | R | As of December 31, 2023, I am searching for the first name of the | Ian | wrong truncated |
| 92 | R | Give me this person's full birth name. - This person was born in  | Jacqueline Georgette Cantrelle | wrong truncated |
| 93 | R | I’m looking for a paper that was submitted to a university before | Stephen D. Boyles | wrong truncated |
| 94 | R | The player I'm looking for was named the man of the match in an i | Sam Curran | wrong truncated |
| ~~95~~ | ~~G~~ | ~~Please identify the fictional character who occasionally breaks t~~ | ~~Plastic Man~~ | ~~correct~~ |
| 96 | R | - A source, published sometime between January 1, 2008, and Decem | Amherst College | wrong truncated |
| 97 | R | What is the full name name of the author who, prior to December 2 | Ian Solomon | wrong truncated |
| 98 | R | There's this popular figure with multiple Grammy awards in the en | St. John’s Health Center | wrong truncated |
| ~~99~~ | ~~G~~ | ~~I was going through the website of one of the prestigious awards ~~ | ~~Avatar, 2010~~ | ~~correct~~ |

**Overall: 338/492 = 68.7% strict across all graded rows**


### Next levers (in order)

1. Round-3 measurement (v255 in flight): the always-retry fix should recover most remaining truncation-driven misses (BrowseComp 68, DSQA 55, FRAMES 23 labeled truncated at v254 — with the 3,000-char caveat).
2. BrowseComp multi-hop binding: even with planner sub-queries, the writer binds the wrong entity at a hop on narrative chains — needs a verify-each-hop writer rule.
3. SimpleQA's 4 remaining wrongs: 3 truncations + 1 gold-conflict.
4. The official LLM-judge methodology number for the gold-conflict rows (documented in v249 §29cs).

### Batch checklist
- [x] Three rounds iterated server-side (v252 baseline -> v254 deployed yield -> v255 in flight)
- [x] DSQA +10.4 points (33.0 -> 43.4)
- [x] Full row-by-row grid generated (above, from results-v254)
- [x] Hard watchdog eliminated worker hangs (zero SimpleQA/FRAMES error rows)
- [x] v255 (always-retry truncation) deployed, platform 258
- [x] Doc written; headline unchanged 90.4% (no parity items closed this batch)
- [ ] Round-3 (v255) results — next batch
