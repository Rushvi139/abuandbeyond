import { LegalPage } from "@/components/store/legal-page";

export const metadata = { title: "Privacy · Abu & Beyond" };

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy"
      updated="8 November 2026"
      intro="We are a kitchen, not a data business. We keep what it takes to cook your food, deliver it and talk to you about it."
      sections={[
        {
          heading: "What we keep",
          body: [
            "Your name, mobile number and delivery address, so we can cook and deliver. Your order history, so you can reorder and so we know what to make more of.",
            "If you share your location at checkout, we keep the pin with that order so the rider can find you.",
            "Anything you write us — a note for the kitchen, a catering enquiry, a review.",
          ],
        },
        {
          heading: "What we never see",
          body: [
            "Card numbers, UPI IDs, bank details. Payment happens on our payment gateway's own page; we only ever learn that an order was paid, and a reference number.",
          ],
        },
        {
          heading: "How you are recognised",
          body: [
            "No password. We set a small cookie on your device after your first order so your order history is there when you come back. Clear it, and the device simply forgets you.",
          ],
        },
        {
          heading: "Who else sees it",
          body: [
            "Our kitchen and delivery staff see what they need to make and deliver your order. Our payment gateway and, once it is live, WhatsApp, receive your number and order details so they can do their job.",
            "We do not sell your details, and we do not hand your number to advertisers.",
          ],
        },
        {
          heading: "Messages",
          body: [
            "We message you about your own orders. If we ever want to send you an offer, we will ask first, and every such message will have a way to stop them.",
          ],
        },
        {
          heading: "How long we keep it",
          body: [
            "Order and payment records stay as long as tax law requires us to keep them. Everything else you can ask us to delete.",
          ],
        },
        {
          heading: "Your say",
          body: [
            "Ask us what we hold about you, ask us to correct it, or ask us to delete it. Message us on the Help page and a person — not a form — will answer.",
          ],
        },
      ]}
    />
  );
}
