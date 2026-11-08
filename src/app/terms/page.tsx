import { LegalPage } from "@/components/store/legal-page";

export const metadata = { title: "Terms · Abu & Beyond" };

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms"
      updated="8 November 2026"
      intro="Plain terms for ordering food from Abu & Beyond. By placing an order you agree to these."
      sections={[
        {
          heading: "Who we are",
          body: [
            "Abu & Beyond is a delivery-only kitchen operating in Mount Abu, Rajasthan, India. We cook and deliver our own food; we do not resell anyone else's.",
            "You can reach us through the Help page, by phone or on WhatsApp, during our serving hours.",
          ],
        },
        {
          heading: "Ordering",
          body: [
            "You must be able to receive a delivery at the address you give us, and give us a working mobile number. Orders are accepted only within our delivery area in and around Mount Abu town.",
            "We may decline or cancel an order if a dish has sold out, the address is outside our range, the weather or road makes delivery unsafe, or we cannot reach you on the number given. If we cancel after you have paid, you get a full refund.",
          ],
        },
        {
          heading: "Prices and payment",
          body: [
            "All prices are in Indian Rupees. Menu prices are shown before tax; 5% GST is added once at checkout, and the total you approve is the total you pay.",
            "Payment is online, through our payment gateway. We never see or store your card or UPI details.",
          ],
        },
        {
          heading: "Delivery",
          body: [
            "Delivery times given on the site are honest estimates, not guarantees. Hills, weather and traffic are real. We will tell you if your order is running late.",
            "Our rider will call when they arrive. If nobody can take the delivery after a reasonable wait and repeated calls, the order is treated as delivered and is not refunded.",
          ],
        },
        {
          heading: "Food, allergies and dietary needs",
          body: [
            "Our kitchen handles wheat, dairy, nuts, soy, egg and non-vegetarian ingredients. Veg and non-veg are prepared in the same kitchen, and we cannot promise there is no cross-contact. If you have a serious allergy, please call us before ordering rather than relying on a note.",
            "We mark veg and non-veg honestly on every dish. If we get it wrong, tell us and we will make it right.",
          ],
        },
        {
          heading: "Your account",
          body: [
            "There is no password. Ordering once lets this device find its own order history, and on a new device your mobile number plus a past order number does the same. Keep your phone to yourself, and that is as private as it sounds.",
          ],
        },
        {
          heading: "Content you share",
          body: [
            "If you send us a photo, video or review for our wall, you are letting us show it on our site and social channels with your first name. Tell us and we will take it down.",
          ],
        },
        {
          heading: "Changes and disputes",
          body: [
            "We may update these terms; the date above tells you when they last changed. Any dispute is governed by Indian law, with the courts of Sirohi district, Rajasthan.",
          ],
        },
      ]}
    />
  );
}
