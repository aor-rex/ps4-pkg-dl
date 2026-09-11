# WEBSITE.md — ps4-pkg-dl landing page

## Sitemap

Single landing page. Sections in order: hero (H1 + one-liner + stakes +
dual CTA + app screenshot) → features as outcomes → screenshots (proof) →
install as 3-step plan (command + copy) → FAQ (objection killers) →
footer (disclaimer + links).

## Page Briefs

- **Hero:** H1 keeps the product name (navigational + SEO). Lede = the
  one-liner. One quiet stakes line beneath. Dual CTA: installer command
  button + View on GitHub. App screenshot below, borderless.
- **Features:** each card leads with the visitor's outcome, keeps the
  factual scope from the README. No invented feature names.
- **Screenshots:** two shots with plain descriptive captions. Proof, not
  decoration.
- **Install (the Plan):** 3 steps — paste the command, add your catalog,
  pick a game. Command bar with copy button. Agreement line: free, no
  account, your files stay yours.
- **FAQ:** keep all four; they answer the real pre-install objections
  (catalog source, RAWG key, archive.org cookie, config location).
- **Footer:** disclaimer + GitHub + license + releases. Unchanged.
- **Cut (no SB7 job):** eyebrow pills, section subs, keyword marquee,
  stats band, changelog excerpt. To Phase 10 cut list for the final
  verdict.

## Conversion Elements

Big-5 Objection | Counter | Placement (all evidence-backed, nothing invented):

- Trust ("pipe-to-bash? piracy tool?") → the script is a plain readable
  `.sh`, source is MIT and inspectable, no account, no telemetry; honest
  disclaimer in the footer. Placed at install + footer.
- Price ("what's the catch?") → free, MIT-licensed. Placed as the
  agreement line under the install steps.
- Fit ("works with my catalog?") → FPKGi `games.json` URL or local file.
  Placed in plan step 2 + first FAQ answer.
- Timing ("later") → one command, about a minute. Placed in the install
  heading.
- Effort ("enrichment sounds complex") → optional; free key plus one
  button. Placed in features + second FAQ answer.

## Audit Findings

Cold review (Phase 10 GATE): the One Thing is one pasted command;
steps-to-value is three. Old page verdict: NOT DONE — pill, marquee,
eyebrows, subs, stats, changelog, and invented feature names serve no
SB7 job. Cut list applied in full (see index.html rewrite, 2026-09-11).
Back of the fence: single page (no 404 surface), copy-button fallback
kept, mobile stacks at 768px, marquee gone so reduced-motion has less
to gate. Verdict after cut: SHIP — final sign-off belongs to the user
on the live page.
