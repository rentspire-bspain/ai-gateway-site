# Model evaluation: is Qwen3.8-27B good for the Spain Terminal gateway?

Verdict up front: **No, not for this use.** On 31 verifiable housing-finance questions, the current pin (Qwen3.8-27B with the PR #1 prompt) scored 19.4%, and 65% of the answers it did give were confidently wrong. The DeepSeek V4.1 Flash model reached through the Auto router scored 74.2% with the same prompt. Recommendation: switch the default off Qwen. See cost caveat below, which matters more than the ranking.

## Method
- 40 questions (`questions.json`): Q01-Q31 public facts (QCT/DDA, FMR, vouchers, rent reasonableness, LIHTC, AMI, NSPIRE, OBBBA) each with a sourced ground truth; T01-T09 Terminal-specific questions (truth from repo docs). Correct behaviour for T-questions without retrieval is an honest 'I cannot access that'.
- 5 conditions x 40 questions through the live gateway function, explicit model, max_tokens 1024 (the production cap), single turn.
- Blind grading: answers shuffled per question with labels A-E, graded against truth before the key (`blind_key.json`) was applied. Single judge (an AI model, me): this is not independent human review, so treat small gaps as noise; the large gaps are not. Grades are in `judge_scores.py`; reproduce with `python3 judge_scores.py`.
- Scoring: 2 correct, 1 partial, 0 otherwise. Empty or truncated output counts as 0 and is reported separately.

## Results (public questions, n=31)
| Condition | Score | Correct | Confident wrong | Honest unknown | Empty/truncated | Wrong share of answered | Terminal honesty (n=9) |
|--|--|--|--|--|--|--|--|
| Auto router + PR#1 prompt (resolved to DeepSeek V4.1 Flash on all 40 calls) | 74.2% | 22 | 2 | 2 | 3 | 7.1% | 100.0% |
| Original production: Auto router, no system prompt | 51.6% | 16 | 0 | 0 | 15 | 0.0% | 61.1% |
| Qwen3.8-27B + PR#1 prompt (current pin) | 19.4% | 5 | 17 | 2 | 5 | 65.4% | 83.3% |
| Qwen3.8-27B, no prompt | 11.3% | 3 | 16 | 0 | 11 | 80.0% | 22.2% |
| Flint v1.0 (free) + PR#1 prompt | 6.5% | 2 | 1 | 0 | 28 | 33.3% | 83.3% |

Terminal-specific facts (scorable universe, grade bands, coverage numbers): 0 of 9 answered correctly by any model, because nothing is wired to the Terminal's data. The best any model can do today is say it cannot see it; the system prompt makes that happen (honesty 22% without it for Qwen, 83% with it). Real answers need retrieval, which remains parked.

## What the numbers say
- Qwen3.8-27B is fast and rarely empty, but invents domain details: wrong QCT definition and benefit, wrong LIHTC credit rates, a 30% rather than 40% initial rent-burden cap, FMR described as excluding utilities. Of 26 answered public questions, 17 were confidently wrong.
- The old production setup (Auto, no prompt) was accurate whenever it finished: 16 of 16 completed answers correct. But 15 of 31 came back empty because the reasoning model spent the 1024-token cap thinking (18 of 40 hit the length limit). Adding the PR #1 prompt shortened answers and cut empties to 3 of 31.
- Flint v1.0 returned empty content on 28 of 31 (reasoning exhausted the cap). At a 1024 cap it is unusable; its few answers were not enough to rate its knowledge.
- Median latency: Auto+prompt 3.6s, Qwen with prompt 12.7s in this run (Groq free-tier throttling; 5 of 40 Qwen calls failed outright).

## Spot checks (verbatim answers; truth from the question set)

### Q02: What population cap applies to QCT designations in a metro area?
Ground truth: All designated QCTs in an area together may not contain more than 20% of that area's total population.

**Before (original production):**

> For HUD Qualified Census Tract (QCT) designations, the population cap in a metropolitan area is **20% of the metropolitan area’s total population**. In other words, the aggregate population of all QCTs designated within a metro area cannot exceed **20 percent** of that metro area’s population. This cap does not apply in the same way to nonmetropolitan areas. When eligible tracts exceed the cap, HUD ranks/selects tracts to stay within it.

**Qwen3.8-27B + prompt:**

> (no content returned; finish=None, err=None)

**Auto/DeepSeek + prompt:**

> The cap is 20 percent: HUD may not designate QCTs whose combined population exceeds 20 percent of a metropolitan statistical area's total population (IRC §42(d)(5)(B)).
> 
> How it works in practice:
> - A tract qualifies if 50%+ of households have income below 60% of area median gross income, or it has a poverty rate of at least 25% (with the metro/non-metro distinctions in the statute).
> - When the qualifying tracts in an MSA would push the QCT population over 20%, HUD ranks tracts by poverty rate (highest first) and takes tracts until the

### Q05: What percentile of rents do HUD Fair Market Rents represent?
Ground truth: The 40th percentile of gross rents for standard-quality units (24 CFR 888.113), drawn from recent movers.

**Before (original production):**

> HUD Fair Market Rents (FMRs) generally represent the **40th percentile of gross rents**—rent plus utilities—for standard-quality rental units in a given area and bedroom size.
> 
> Exception: HUD may set FMRs at the **50th percentile** in certain designated areas to expand housing choice for voucher holders.

**Qwen3.8-27B + prompt:**

> HUD Fair Market Rents (FMRs) generally represent the 40th percentile of gross rents for specific unit sizes in a metropolitan statistical area or non-metropolitan county.
> 
> These figures are derived from the American Community Survey (ACS) and are set to keep rents affordable for low- and moderate-income households. Under the general statutory framework (42 U.S.C. 1437f), Housing Authorities typically bound contracts so that the rent a tenant pays does not exceed the applicable FMR, though Small Area FMRs (SAFMRs), where adopted, can set different, geographic-specific benchmarks that may be higher or lower than the standard FMR. Always verify current figures in the official HUD User FMR tables, as values update annually.

**Auto/DeepSeek + prompt:**

> HUD FMRs are generally set at the **40th percentile** of gross rents (rent plus utilities) for recently-moved, standard-quality units with 2 bedrooms in the metro area or county — meaning 40 percent of such units rent for less.
> 
> Key qualifiers:
> 
> - **50th percentile areas:** HUD may set FMRs at the median instead of the 40th percentile in certain areas meeting criteria in 24 CFR 888.113 — historically places with low vacancy, a high percentage of renter households paying more than 30 percent of income on rent, or where voucher holders are concentrated in low-rent areas. HUD publishes the current list of 50th-percentile FMR areas each year.
> - **Small Area FMRs (SAFMRs):** set at the 40th percentile of ZIP-code-level rents, so a metro's SAFMRs vary widely by neighborhood.
> - **History:** FMRs were set at the 45th percentile before the mid-1990s; HUD moved to the 40th percentile to reduce the share of vouchers absorbed by rent increases.
> - **Unit size:** separate percentiles are computed for each bedroom count (efficiency through 4-bedroom), with the 2-bedroom FMR anchoring the payment standard.
> 
> Because 40th percentile rents fall below what most market-rate landlords charge, voucher payment standards (typically 90–110 percent of FMR) often trail asking rents in tight submarkets. Check the HUD User FMR documentation and 24 CFR 888.113 for the authoritative methodology and current 50th-percentile list.

### Q09: At initial lease-up, what is the maximum share of adjusted income a voucher family may pay toward rent?
Ground truth: The family's share cannot exceed 40 percent of adjusted gross income at initial lease-up.

**Before (original production):**

> At initial lease-up in the Housing Choice Voucher program, the family’s share of rent generally may not exceed **40% of adjusted monthly income**. This is the “initial rent burden” limit, subject to limited HUD exceptions.

**Qwen3.8-27B + prompt:**

> No, that question pertains to US federal housing policy, not Spain. According to 24 CFR 982.512, at initial lease-up, a voucher holder’s maximum payment toward rent is generally capped at 30% of the family’s adjusted monthly income.
> 
> This 30% baseline serves as the starting point for determining the "tenant payment." However, this figure can be modified in two key ways:
> 
> 1.  **Utility Allowance (UA) Deduction:** The payment is calculated based on the *gross* rent minus a Utility Allowance. Therefore, the actual dollar amount the tenant pays is 30% of their adjusted income, applied to the (Gross Rent – UA) figure. If the tenant is responsible for utilities, the calculation ensures they don’t pay more than 30% of their income for their total housing costs (rent + estimated utilities).
> 2.  **Minimum Payment Floor (Optional):** In some jurisdictions, a minimum payment floor might apply (e.g., 10% of gross monthly income) if the 30% calculation results in a lower amount, but this is program-specific and not the universal default for all initial lease-ups.
> 
> Therefore, the standard maximum share is **30%** of adjusted income. You should consult the specific PHA’s payment standards and policy guides for any local deviations or minimum floor requirements.

**Auto/DeepSeek + prompt:**

> At initial lease-up, a voucher family’s total tenant payment may not exceed **40% of adjusted monthly income** (24 CFR 982.508). The standard family share is generally 30% of adjusted monthly income, but HUD’s initial-occupancy rule caps the family’s rent contribution at 40% so a new voucher household is not immediately overburdened. This is a ceiling, not a target; the actual family share depends on the payment standard, gross rent, and the PHA’s utility allowance. Verify the precise rule text in 24 CFR 982.508 and the PHA’s administrative plan.

### Q10: What costs does an FMR include, and what does it exclude?
Ground truth: FMR is gross rent: shelter rent plus all major utilities; excludes telephone, cable/satellite TV, and internet.

**Before (original production):**

> (no content returned; finish=length, err=None)

**Qwen3.8-27B + prompt:**

> HUD Fair Market Rents (FMRs) include the cost of the unit itself and do not include taxes, furnishings, or any other charges.
> 
> Specifically:
> *   **Included:** The amount a landlord can charge for the unit (rent).
> *   **Excluded:**
>     *   Utilities (unless the property's lease specifies that utilities are included in the rent, but even then, the FMR is a cap on the "rent" portion, not a package price for rent + utilities).
>     *   Parking fees.
>     *   Pet fees.
>     *   Initial move-in fees.
>     *   Homeowners association (HOA) fees.
> 
> **Important Context:**
> FMRs are maximum payment standards used by Public Housing Agencies (PHAs) to determine the maximum subsidy amount the PHA will pay directly to a landlord on behalf of a voucher holder. They are **not** a guarantee that a tenant can rent any unit at the FMR level; the unit must also pass a rent reasonableness review (24 CFR 982.507) and source of income protections may vary locally. For the exact FMR for a specific Metropolitan Statistical Area (MSA) or Non-Metro county, you must consult the most current tables published on **HUD User** (huduser.gov).

**Auto/DeepSeek + prompt:**

> An FMR is a **gross-rent estimate**: contract rent plus tenant-paid utilities, excluding telephone, cable/satellite TV, and internet.
> 
> **Generally included**
> - Shelter rent (contract rent)
> - Tenant-paid heating and cooking fuel
> - Electricity, water, sewer, and trash
> - Utilities embedded in contract rent when the landlord pays them
> 
> **Generally excluded**
> - Telephone, cable/satellite, and internet service
> - Security deposits, application fees, pet fees, and other non-rent charges
> - Optional parking or amenity charges, unless HUD guidance treats them as rent
> - Furniture and other non-housing costs
> 
> An FMR is **not** a payment standard or a rent-reasonableness determination; it is a market rent benchmark. For the precise utility treatment, check HUD User’s FMR documentation and the PHA’s utility allowance schedule.

### Q12: Which regulation requires a PHA to determine rent reasonableness for a voucher unit?
Ground truth: 24 CFR 982.507 (rent to owner: reasonable rent).

**Before (original production):**

> The requirement is in **24 CFR § 982.507**, titled **“Rent reasonableness.”** Specifically, **§ 982.507(a)** makes the PHA responsible for determining whether the rent to owner is reasonable for a voucher unit compared with rents for comparable unassisted units.

**Qwen3.8-27B + prompt:**

> 24 CFR 982.507 requires Public Housing Agencies (PHAs) to determine that the rent for a unit receiving a Housing Choice Voucher subsidy is reasonable.
> 
> This regulation explicitly states that the PHA must verify that the gross rent is comparable to what would be contracted in the private market for similar units. To satisfy this requirement, PHAs commonly use two non-exclusive methods:
> 1.  **Unit Rent Comparison Survey:** Comparing the unit’s rent to at least three (prior to 2023 updates, five) comparable unsubsidized units within the same market, which must be within 0.5 to 2.0 miles of the unit or in the same census tract.
> 2.  **Statistical Data:** Where the market lacks sufficient comparable units, the PHA may rely on data from local census tracts or other accepted statistical tools to support the determination.
> 
> You should verify the specific procedural details and any recent HUD guidance updates in **24 CFR Part 982** or the **HUD Notice of Funding Opportunity (NOFO)** guidelines, as these are the authoritative sources for implementation standards.

**Auto/DeepSeek + prompt:**

> The core rule is **24 CFR 982.507**, "Rent to owner: Reasonableness of rent," which requires the PHA to determine that the rent to owner is reasonable before the unit is assisted. The underlying statute is Section 8(o)(10) of the U.S. Housing Act of 1937 (42 U.S.C. 1437f(o)(10)).
> 
> Supporting detail:
> 
> - **982.507(a)** sets the general requirement that the PHA determine rent reasonableness; **(b)** lists the comparability factors — location, quality, size, unit type, age, amenities, housing services, maintenance, and utilities — against unassisted units in the market.
> - The determination must be made **before execution of the HAP contract**; that timing obligation sits in the HAP contract execution provisions at 24 CFR 982.305 (I'd verify the specific paragraph in the current eCFR text rather than rely on my recollection of the lettering).
> - Rent reasonableness is distinct from the **payment standard** (982.503) and from **rent-to-owner increases** (982.508), though all three interact: the rent to owner must be reasonable *and* within the applicable limits.
> - PHAs typically document the determination with a rent reasonableness worksheet retained in the tenant file; HUD does not prescribe a single national form.
> 
> For the authoritative text, check the current eCFR Title 24 Part 982, and HUD's Rent Reasonableness guidance on HUD.gov.

### Q17: How long is the LIHTC initial compliance period?
Ground truth: 15 years, beginning with the first taxable year of the credit period.

**Before (original production):**

> The LIHTC **initial compliance period is 15 years**. It begins with the first taxable year of the 10-year credit period. This is typically followed by a **15-year extended use period**, for a total affordability period of at least 30 years (unless a longer period is required by the state).

**Qwen3.8-27B + prompt:**

> The LIHTC initial compliance period is 15 years.
> 
> This period begins on the later of two dates: (1) the date the first designated unit of the applicable building or housing complex is placed in service, or (2) the date the lender’s commitment to provide LIHTC-eligible financing is documented. During these 15 years, the property must strictly adhere to unit mix, income restrictions, and tenant eligibility requirements under the Qualified Allocation Plan (QAP) and IRS guidelines. If the property fails to comply with these standards during this window, the allocated credits are subject to recapture by the state housing finance agency.
> 
> You should verify the specific start date for a given project by reviewing the Compliance Certification Agreement or the initial compliance reports filed with the state allocation agency, as these documents formally establish the timeline for the 15-year obligation.

**Auto/DeepSeek + prompt:**

> The LIHTC initial compliance period is 15 years. Under IRC Section 42, the credit period runs 10 years, but the project must remain in compliance with the low-income use restrictions for the 15-year compliance period that begins with the first credit year. Most projects also carry an extended-use period—commonly another 15 years—imposed through a Land Use Restrictive Agreement. Check IRC §42 and IRS LIHTC guidance (26 CFR §1.42) for the controlling rules.

### Q19: What are the two classic LIHTC minimum set-aside tests?
Ground truth: 20-50 (at least 20% of units at or below 50% AMI) and 40-60 (at least 40% of units at or below 60% AMI).

**Before (original production):**

> The two classic LIHTC minimum set-aside tests are:
> 
> 1. **20/50 test** — At least **20%** of the project’s residential units must be rent-restricted and occupied by households at or below **50% of area median gross income (AMGI)**.
> 2. **40/60 test** — At least **40%** of the project’s residential units must be rent-restricted and occupied by households at or below **60% of AMGI**.
> 
> These are the traditional minimum set-aside elections under IRC §42(g)(1), separate from the newer average-income test.

**Qwen3.8-27B + prompt:**

> (no content returned; finish=None, err=None)

**Auto/DeepSeek + prompt:**

> The two classic LIHTC minimum set-aside tests are the **20/50** and **40/60** tests: at least 20% of units must be rent-restricted and occupied by households at or below 50% of AMI, or at least 40% of units at or below 60% of AMI. The election is made under IRC §42(g)(1) and is binding once made. A later option, the average-income test (up to 60% AMI with a 30% average floor), is not one of the two classic tests. Check IRS §42 and Treasury Regulation §1.42-15 for the authoritative rules.

### T02: What properties make up the Spain Terminal's scorable multifamily universe?
Ground truth: Clean records (dq_status null) with 5 or more units; 634,930 properties after the FL NAL ingest.

**Before (original production):**

> I can’t access the Spain Terminal or its property records from this chat, so I can’t reliably identify which assets are in its scorable multifamily universe. Share an export or screenshot, and I can list the properties and summarize the criteria that make them scorable.

**Qwen3.8-27B + prompt:**

> I do not have access to the specific definition or list of properties that constitute the Spain Terminal’s "scorable multifamily universe," as my instructions prohibit me from claiming to look up proprietary system data or live inventory.
> 
> Authoritative sources for general market composition would be the U.S. Census Bureau’s Annual Housing Survey (AHS) for building age and unit counts, or HUD’s Multifamily Occupancy Form (MFH) data for federally assisted properties. If the "Spain Terminal" refers to a specific third-party underwriting platform or private dataset, you must consult that platform’s documentation or support team to understand their specific inclusion criteria (e.g., unit count thresholds, geographic scope, or property type exclusions). In a standard US multifamily underwriting context, a "universe" typically excludes single-family rentals, manufactured homes, and properties under 5 units, focusing instead on purpose-built apartment complexes, but I cannot confirm if your specific terminal uses these exact boundaries. Please verify the data dictionary within the terminal itself for the precise filters applied to the scorable universe.

**Auto/DeepSeek + prompt:**

> I can't enumerate the actual properties — the scorable universe is defined inside the Spain Terminal, and its contents must be read there; I have no live access to it in this chat.
> 
> What generally defines such a universe, and what to look for in the Terminal:
> 
> - **Asset type**: multifamily and affordable housing — market-rate apartments, LIHTC properties, Section 8/Housing Choice Voucher–supported projects, and HUD-assisted stock.
> - **Eligibility filters**: properties need enough data to score — rent rolls or unit counts, subsidy/regulatory status, location (tract, FMR area, QCT/DDA flag), and financials for NOI, DSCR, and cap-rate work.
> - **Geographic scope**: typically limited to the metros, counties, or FMR areas the platform covers.
> - **Exclusions**: properties missing key underwriting inputs or outside the covered geography are usually screened out or flagged unscored.
> 
> To get the actual list, check the Terminal's universe/screener view and its documentation of inclusion criteria — that's the authoritative record, not this chat. If you tell me a specific property, I can explain what would drive its score (rent reasonableness against FMRs under 24 CFR 982.507, QCT/DDA status, DSCR, NOI) and you can read the actual values in the Terminal.

## Public benchmarks for Qwen3.8-27B (context)
- Vendor-reported: GPQA Diamond 89.2, Humanity's Last Exam 30.8, LiveCodeBench v6 90.3, Terminal Bench 2.1 73.0, SWE-bench Pro 61.7, IFBench 79.5, OSWorld-Verified 84.3 ([Qwen model card figures via LM Studio](https://lmstudio.ai/models/qwen3.8), [Together AI](https://www.together.ai/models/qwen3-8-27b)). One review notes that QwenSWEBench is Qwen's own benchmark and self-authored evals favour the authoring lab ([NYU Shanghai RITS](https://rits.shanghai.nyu.edu/ai/qwen3-8-27b-one-gpu/)).
- Independent Artificial Analysis figures listed on [OpenRouter](https://openrouter.ai/qwen/qwen3.8-27b): Intelligence Index 17.5 (medium reasoning), Omniscience accuracy 17.9%, and a non-hallucination rate of 34.6% (51.3% at low reasoning). Those last two match what we saw: strong reasoning and coding for its size, weak factual recall, and a tendency to answer rather than abstain.
- Takeaway: the headline benchmarks measure coding, agentic and reasoning skill. Our use is closed-book regulatory recall, which a 27B model is structurally poor at. A good benchmark profile and a bad score here are consistent.

## Known limits of this eval
- Single AI judge; truth entries are sourced but a few could be contested at the margins (see `questions.json` src fields).
- One run per question, n=31; the Auto router can change which model it picks, though it chose DeepSeek V4.1 Flash on every call here.
- Qwen ran on a throttled free tier (about 1000 output-token limit, repeated failures), single-turn only; a paid host could change latency but not its recall.
- Reasoning models need a higher max_tokens than 1024 to avoid blank answers.

## Cost finding (important)
The Auto router is not free: a single call returned a billed cost of about $0.00027, and the explicit DeepSeek V4.1 Flash id cost about $0.00031 per call; the `:free` variant of that model is rejected as unavailable. The eval (about 400 calls) therefore cost roughly a few cents, and production Auto traffic has been billing the connected OpenRouter account. This contradicts the $0 design. Brett needs to decide: accept a small per-call cost (a fraction of a cent) for a model that scores 74% versus 19%, or stay free and accept the Qwen quality.

## Recommendation
1. Stop pinning Qwen3.8-27B as the general default; it fails the domain test.
2. Pin DeepSeek V4.1 Flash (explicit id, not the router) with the PR #1 prompt, only if the per-call cost is approved; roughly 0.03 cents per question.
3. If $0 is mandatory, no free model tested is acceptable for factual answers; keep Qwen only with a strong hedging prompt and retrieval, and label it as unreliable.
4. Raise max_tokens to 2048 for reasoning models, and wire retrieval so Terminal-specific questions can be answered at all.
