# RC154 — Reverse Bidding / Professional Services Baseline

Implemented web runtime for:
- MantiGO / Reverse Bidding
- Professional Services entry point

The module uses the existing indrive_requests and indrive_bids contracts. Request creation is owner-bound by existing RLS. Bid visibility and submission remain governed by the existing private.can_read_indrive_bid / private.can_submit_indrive_bid checks; no broad bid policy was added.

Source:
- web/reverse-bidding-module.js
- web/index.html loads reverse-bidding-module.js

Commit: 3a8b210baa5b71f2620b3ab11682a95aeb6861ab
Loader commit: 546bc85116ff93a5c5493ddc018cf78122aceb37

Not verified: provider/customer browser E2E, bid acceptance/escrow lifecycle, payment release, production CI.
