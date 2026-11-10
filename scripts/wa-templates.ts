// Prints the message templates to paste into WhatsApp Manager.
// Usage: npm run wa:templates
import { templateSubmissionText } from "../src/lib/whatsapp/templates";

console.log(`
Submit these at business.facebook.com -> WhatsApp Manager -> Message templates.
All four are UTILITY: they concern an order the guest already placed.
Submitting an order update as MARKETING gets it rejected and costs more.
`);
console.log(templateSubmissionText());
