import { LegalPage } from "@/components/store/legal-page";

export const metadata = { title: "Refunds & cancellations · Abu & Beyond" };

export default function RefundsPage() {
  return (
    <LegalPage
      title="Refunds"
      updated="8 November 2026"
      intro="Food is cooked to order, so cancellation depends on how far along it is. Here is exactly how we handle it."
      sections={[
        {
          heading: "Cancelling an order",
          body: [
            "Call or WhatsApp us as soon as you can. If the kitchen has not started cooking, we cancel it and refund you in full.",
            "Once cooking has started we cannot cancel, because the food cannot be sold to anyone else. If you tell us while it is still on the pass we will do what we reasonably can.",
          ],
        },
        {
          heading: "If something is wrong",
          body: [
            "Tell us the same evening, with a photo if you can. If a dish arrived cold, late enough to be spoiled, wrong, or not up to standard, we will remake it or refund that dish — your choice.",
            "If the whole order never reached you, we refund the whole order.",
          ],
        },
        {
          heading: "When we cancel",
          body: [
            "If we cancel for any reason — a sold-out dish, an address we cannot reach, weather, a kitchen problem — you are refunded in full, always.",
          ],
        },
        {
          heading: "How refunds reach you",
          body: [
            "Refunds go back to the same method you paid with. We raise the refund with our payment gateway the same day we agree it.",
            "Banks and UPI providers usually take 5 to 7 working days to show the money, and that part is out of our hands. We will give you the refund reference if you want to chase it.",
          ],
        },
        {
          heading: "What we cannot refund",
          body: [
            "Orders nobody was available to receive after our rider waited and called. A dish you simply did not enjoy, when there is nothing wrong with it — though please tell us anyway, because that is how the menu gets better.",
          ],
        },
      ]}
    />
  );
}
