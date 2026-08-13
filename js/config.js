/* Little John Scooters · site config (single source for the booking bridge).
   When the FleetDesk booking system goes live, set BOOKING_URL to its public
   address (e.g. 'https://book.littlejohnscooters.com/book'). Every .js-book
   CTA then routes there and /book/ redirects to it. While null, booking runs
   through the WhatsApp quiz at /book/. */
window.LJ_CONFIG = {
  BOOKING_URL: null,
  WHATSAPP: "5997774734"
};
