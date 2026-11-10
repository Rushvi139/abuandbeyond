/**
 * Keyword landing pages. One page per search intent, each with its own URL,
 * title and H1, all pointing back to the menu to order.
 *
 * Copy here must only say things that are true of the kitchen today — the
 * hours come from `SERVICE`, the dishes and prices come live from the menu.
 * If a claim changes (hours, delivery area), change it here too.
 *
 * Keyword map (primary → supporting), so nobody adds a second page that
 * competes for the same search:
 *   /                          abu & beyond, abu and beyond, order food online mount abu
 *   /food-delivery-mount-abu   food delivery mount abu, home delivery mount abu, restaurants that deliver mount abu, food delivery to hotel mount abu
 *   /late-night-food-mount-abu late night food mount abu, food open after midnight mount abu, night delivery mount abu
 *   /pizza-delivery-mount-abu  pizza delivery mount abu, pizza in mount abu, best pizza mount abu, margherita pizza mount abu
 *   /pasta-mount-abu           pasta in mount abu, italian food mount abu, alfredo / arrabbiata pasta mount abu
 *   /burgers-mount-abu         burger in mount abu, veg burger mount abu, chicken burger mount abu, peri peri fries mount abu
 *   /lebanese-food-mount-abu   lebanese food mount abu, falafel mount abu, hummus mount abu, shawarma style rolls mount abu
 *   /shakes-mount-abu          shakes in mount abu, nutella shake / oreo shake mount abu, iced tea mount abu
 */
export type Landing = {
  slug: string;
  title: string;
  description: string;
  h1: string;
  intro: string[];
  /** Category slugs whose live dishes are listed on the page. Empty = every category. */
  categories: string[];
  /** Narrow the listed dishes to one cuisine sticker (the Bowls category mixes several). */
  cuisine?: "abu" | "italy" | "mexico" | "china" | "lebanon";
  faq: { q: string; a: string }[];
};

const DELIVERY_FAQ = {
  q: "Where in Mount Abu do you deliver?",
  a: "Everywhere in Mount Abu town, plus the hotels, villas and homestays around Nakki Lake. Further out? Message us on WhatsApp before ordering and we'll tell you honestly whether it will travel well.",
};
const HOURS_FAQ = {
  q: "What are your timings?",
  a: "Two kitchens a day: 12 PM to 3 PM, and 7 PM to 2 AM. Order direct on this site for delivery or take-away.",
};

export const LANDINGS: Landing[] = [
  {
    slug: "food-delivery-mount-abu",
    title: "Food Delivery in Mount Abu — Order Online | Abu & Beyond",
    description:
      "Food delivery in Mount Abu to your hotel, villa or homestay. Pizza, pasta, burgers, laffa rolls and shakes from Abu & Beyond. Order online, open till 2 AM.",
    h1: "Food delivery in Mount Abu",
    intro: [
      "Abu & Beyond is a delivery kitchen in Mount Abu cooking the world's comfort food — Italian pizza and pasta, Lebanese laffa rolls and falafel, burgers, fries and thick shakes.",
      "Every bread is made in our kitchen: the pizza bases, the laffa and the burger buns. Order direct on this site and our own rider brings it to your hotel room, villa or homestay — no app, no account.",
    ],
    categories: [],
    faq: [DELIVERY_FAQ, HOURS_FAQ, { q: "How long does delivery take?", a: "Most orders leave the kitchen in 25–35 minutes. You can follow your order live once it's placed, and your rider will call when they reach." }],
  },
  {
    slug: "late-night-food-mount-abu",
    title: "Late Night Food Delivery in Mount Abu — Open till 2 AM | Abu & Beyond",
    description:
      "Hungry after midnight in Mount Abu? Abu & Beyond delivers pizza, burgers, pasta, rolls and shakes from 7 PM to 2 AM, straight to your hotel or homestay.",
    h1: "Late night food in Mount Abu",
    intro: [
      "Most of Mount Abu shuts early. We don't. Our evening kitchen runs from 7 PM to 2 AM, every night.",
      "Pizzas on our own dough, loaded burgers, creamy pastas, laffa rolls and shakes — delivered to your door by our own rider. Order straight from the menu.",
    ],
    categories: ["pizza", "burgers", "fries", "pasta", "laffa-rolls", "shakes"],
    faq: [HOURS_FAQ, DELIVERY_FAQ],
  },
  {
    slug: "pizza-delivery-mount-abu",
    title: "Pizza Delivery in Mount Abu — Homemade Base | Abu & Beyond",
    description:
      "Order pizza in Mount Abu: Margherita, Four Cheese, Pesto and Veggies on a base made in our own kitchen. Delivered to your hotel or homestay, open till 2 AM.",
    h1: "Pizza delivery in Mount Abu",
    intro: [
      "Our pizza dough is made in-house every day — no frozen bases. Classic Margherita, Four Cheese, Pesto and a loaded Veggies pizza, baked to order.",
      "Add cheese garlic bread and a shake, and we'll bring it to your door anywhere in Mount Abu.",
    ],
    categories: ["pizza", "garlic-bread"],
    faq: [DELIVERY_FAQ, HOURS_FAQ],
  },
  {
    slug: "pasta-mount-abu",
    title: "Pasta & Italian Food in Mount Abu — Delivery | Abu & Beyond",
    description:
      "Italian food in Mount Abu: Alfredo, Arrabbiata, Pink sauce, Pesto and Aglio Olio pasta, plus pizza and garlic bread. Order online for delivery.",
    h1: "Pasta and Italian food in Mount Abu",
    intro: [
      "Red, white, pink or green — Arrabbiata, Alfredo, a mixed pink sauce, basil pesto and a garlicky Aglio Olio, each cooked to order.",
      "Pair it with a pizza on our homemade base and cheese garlic bread for a proper Italian night in the hills.",
    ],
    categories: ["pasta", "pizza", "garlic-bread"],
    faq: [DELIVERY_FAQ, HOURS_FAQ],
  },
  {
    slug: "burgers-mount-abu",
    title: "Burgers & Fries in Mount Abu — Veg & Chicken | Abu & Beyond",
    description:
      "Veg and chicken burgers on buns baked in our kitchen, with salted, peri peri or tandoori fries. Burger delivery across Mount Abu, open till 2 AM.",
    h1: "Burgers and fries in Mount Abu",
    intro: [
      "Our burger buns are baked in our own kitchen. Choose a veg or chicken burger, and add fries — salted, peri peri or tandoori.",
      "Delivered hot to your hotel, villa or homestay in Mount Abu.",
    ],
    categories: ["burgers", "fries"],
    faq: [DELIVERY_FAQ, HOURS_FAQ],
  },
  {
    slug: "lebanese-food-mount-abu",
    title: "Lebanese Food in Mount Abu — Falafel, Hummus, Laffa Rolls | Abu & Beyond",
    description:
      "Lebanese food in Mount Abu: falafel, roasted chicken and paneer laffa rolls, and a falafel hummus platter with fresh pita. Order online for delivery.",
    h1: "Lebanese food in Mount Abu",
    intro: [
      "Laffa is a soft, wide flatbread — ours is made in our kitchen and rolled around roasted chicken, paneer, veggies or crisp falafel.",
      "Want to share? The falafel hummus platter comes with fresh pita.",
    ],
    categories: ["laffa-rolls", "bowls"],
    cuisine: "lebanon",
    faq: [DELIVERY_FAQ, HOURS_FAQ],
  },
  {
    slug: "shakes-mount-abu",
    title: "Shakes & Iced Tea in Mount Abu — Delivery | Abu & Beyond",
    description:
      "Thick shakes in Mount Abu — Nutella, Oreo, Peanut Butter Caramel — plus peach, lemon and Blue Lagoon iced teas. Delivered with your meal or on their own.",
    h1: "Shakes and iced tea in Mount Abu",
    intro: [
      "Nutella, Oreo and Peanut Butter Caramel shakes, made thick. Or something lighter: peach, lemon or Blue Lagoon iced tea.",
    ],
    categories: ["shakes", "iced-tea"],
    faq: [DELIVERY_FAQ, HOURS_FAQ],
  },
];

export const landingBySlug = (slug: string) => LANDINGS.find((l) => l.slug === slug);
