# Two-minute demonstration

Prepare four independent signed-in accounts after Google OAuth is enabled: member/recipient, donor/source, approved volunteer, and coordinator/admin. Keep the public demo open as a network-independent backup.

## Live sequence

- **0:00–0:15 — Problem.** “One repeated or outdated crisis message can consume scarce stock twice while another area receives nothing. TrustGrid separates reports from reviewed operational needs.”
- **0:15–0:35 — Report.** As the member, paste: “At Sample Community Hall, 30 water packs are still needed for tomorrow morning; the exact address is not yet confirmed.” Show that the draft preserves unknown address and ambiguous relative time. Correct one field and submit.
- **0:35–0:55 — Review.** As coordinator, open the inbox, compare the possible duplicate with source snippets and matching factors, link it to one confirmed need, and show the reversible review history.
- **0:55–1:20 — Allocate.** Open Water packs. Change available supply to 60. Compare equal (30/30), urgency first (50/10), and minimum targets (40/20). Approve one current scenario and show the reservation/lot movement.
- **1:20–1:45 — Deliver.** As the approved volunteer, accept the eligible task. The source issues pickup confirmation; the volunteer marks en route and dropoff; the designated recipient confirms the quantity received.
- **1:45–2:00 — Explain.** Refresh both dashboards. Show requested, reserved, in transit, and received separately, then open the actor/timestamp audit and stock ledger.

## Backup walkthrough

Open [the sanitized demo](https://trustgrid-gamma.vercel.app/demo). Use **Load sample report** to prove the report remains editable and keeps unknown facts. Change stock and each policy to demonstrate real computed outputs and unit conservation. Use [demo-1440.png](screenshots/demo-1440.png) and [demo-390.png](screenshots/demo-390.png) if connectivity becomes unreliable.

For the concurrency question, cite the integration test where two coordinators compete for the final ten packs: one transaction succeeds and the other is rejected after row locks and balance checks.
