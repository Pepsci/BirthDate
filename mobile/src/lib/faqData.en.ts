// Version anglaise de la FAQ. Même structure, mêmes `id` et même ordre que
// `faqData.ts` (français, la référence) : toute question ajoutée là-bas doit
// l'être ici. Les libellés entre guillemets reprennent ceux de l'interface
// anglaise (locales/en/*.json).
import type { Section } from "./faqData";

export const FAQ_SECTIONS_EN: Section[] = [
  {
    id: "local",
    emoji: "📱",
    title: "Using the app without an account",
    items: [
      {
        q: "Can I use BirthReminder without an account?",
        a: "Yes, in the mobile app. Choose \"Use without an account\" on the welcome screen (or \"Continue without an account\" on the login screen). Your cards, gift ideas, photos and wishlist stay on your phone: nothing is sent to our servers. This is also possible under the age of 15, since no data is collected.",
      },
      {
        q: "What does not work without an account?",
        a: "Everything that connects several people: friends, chat, events, shared lists, money pools, public wishlist and gift reservations. There is no access from the website and no sync between devices either.",
      },
      {
        q: "How do reminders work without an account?",
        a: "Your phone schedules them: at midnight for birthdays, at 9 am for name days, following each card's settings. It plans them for the next 60 days: open the app from time to time so it can schedule what comes next. If it stays closed too long, a notification reminds you. Go to Profile → Reminders to check and send a test reminder.",
      },
      {
        q: "How do I back up my cards?",
        a: "Without an account, your data only exists on this phone: if you lose it or delete the app, it is gone. Make regular backups.",
        steps: [
          "Profile → My data (backup)",
          "\"Export a backup\"",
          "Save the file in Files, iCloud Drive, or email it to yourself",
          "To restore: same screen → \"Import a backup\" (photos included)",
        ],
      },
      {
        q: "What if I create an account later?",
        a: "After you log in, the app offers to import your cards into your account, with their gift ideas, photos and reminders. A card that is already in your account is not created again. Your cards are only removed from the phone once they have all arrived safely.",
      },
    ],
  },
  {
    id: "dates",
    emoji: "🎂",
    title: "Adding a date",
    items: [
      {
        q: "How do I add a birthday?",
        a: "From the Birthdays tab, tap the ＋ button at the top right. Enter a first name, a date and, if you like, the relationship (family, friend…).",
      },
      {
        q: "How do I edit or delete a date?",
        a: "Tap a card to open it. For a date you added yourself, you will find the edit and delete options there.",
      },
      {
        q: "How do name days work?",
        a: "A first name's name day is found automatically in the French calendar, including compound names (Jean-Luc is celebrated on St Luke's day). If you choose a name day yourself on a card, it is never changed again. A name day looks wrong? Use the \"Wrong name day?\" link under the card's name day: the fix benefits everyone.",
      },
      {
        q: "Are my friends' birthdays added automatically?",
        a: "Yes! As soon as a friend accepts your request, their birthday shows up in your list automatically with a FRIEND badge.",
      },
    ],
  },
  {
    id: "friends",
    emoji: "👥",
    title: "Friends & requests",
    items: [
      {
        q: "How do I add a friend?",
        a: "Go to the Profile tab → My friends. Search for someone by email and send them a request.",
      },
      {
        q: "Where can I see the requests I received?",
        a: "A red badge on the bell 🔔 (at the top) shows pending requests. Open Profile → My friends → Received tab.",
      },
      {
        q: "Can I open a friend's card?",
        a: "Yes, tap their name in My friends, or their card on the home screen.",
      },
    ],
  },
  {
    id: "wishlist",
    emoji: "🎁",
    title: "Wishlist & gifts",
    items: [
      {
        q: "How do I create my wishlist?",
        a: "Go to Profile → My wishlist and add your wishes (title, price, product link).",
      },
      {
        q: "How do I see a friend's wishlist?",
        a: "Open their card → See gifts → \"Their wishlist\" tab.",
      },
      {
        q: "How do I reserve a gift?",
        a: "In a friend's wishlist, tap an available gift then \"Reserve it\". Gifts already reserved by others are hidden.",
      },
      {
        q: "How do I manage my gift ideas for someone?",
        a: "On their card → See gifts → \"My ideas\". You can add ideas, filter by occasion and change the status (To buy, Bought, To give, Given).",
      },
    ],
  },
  {
    id: "events",
    emoji: "🎉",
    title: "Events",
    items: [
      {
        q: "How do I create an event?",
        a: "Events tab → ＋, or from someone's card → Plan an event.",
      },
      {
        q: "How do I invite people?",
        a: "On the event page: \"Invite my friends\" (from your list) or \"Share the link + code\". Guests can invite too if you allow it.",
      },
      {
        q: "What is gift selection for?",
        a: "As the host, you can \"Select\" one or more suggested gifts; they are marked ⭐ for everyone.",
      },
      {
        q: "How does the money pool work?",
        a: "The host can open a money pool by connecting their Stripe account (secure payments). Guests can then contribute right from the event page, and everyone sees the total collected.",
      },
      {
        q: "How do I cancel an event?",
        a: "On the event page → Cancel. You can add a reason, which is passed on as is; without one, guests get a generic message. Everyone is notified in the app, by push and by email.",
      },
      {
        q: "What happens to a cancelled event?",
        a: "It moves to past events with a \"Cancelled\" banner, and nobody can vote, reply, suggest a gift or contribute any more. Nothing is erased: you can restore it, or delete it permanently once cancelled.",
      },
      {
        q: "Can I hand over hosting to someone else?",
        a: "Yes: offer the role to a participant from the event page. They must accept for the transfer to take effect; until they do, nothing changes.",
      },
      {
        q: "What happens to the money pool if I hand over hosting?",
        a: "It is frozen and your bank details are removed from the event. The money already collected stays on YOUR Stripe account: it does not follow the role. It is up to you to pass it on or refund it, and the new host can open their own money pool. All participants are notified.",
      },
      {
        q: "Can my guests invite other people?",
        a: "Yes, by default: the \"Guests can invite\" option is ticked when you create an event. Untick it if you want to keep control of the guest list. You can change it later by editing the event.",
      },
      {
        q: "How do I leave an event?",
        a: "From the event page → Leave the event. You will no longer get its notifications. If you contributed to the money pool, leaving does not refund you: ask the host.",
      },
    ],
  },
  {
    id: "cagnotte",
    emoji: "💶",
    title: "Money pools: what you need to know",
    action: {
      kind: "poolIssue",
      label: "A problem with your contribution to a money pool?",
    },
    items: [
      {
        q: "I have a problem with my contribution: what should I do?",
        a: "BirthReminder never holds the money in a pool: it is collected directly by the host. So we cannot refund on their behalf or settle a disagreement, but we can prove that you paid and follow up with the host. Follow the steps in order; most situations are resolved at the first one.",
        steps: [
          "Contact the host. They are the only one holding the funds and the only one who can trigger a refund. Give them your contribution reference: you will find it in \"My contributions\", with a button that prepares the message for you.",
          "Write to us if you get no reply. We confirm the payment, check that the host's account still exists and follow up with them.",
          "Turn to a mediator if the disagreement continues. In France this is the \"conciliateur de justice\": it is free, you ask at your town hall, and it is a required step before any court action for disputes under 5,000 €.",
          "Dispute the payment with your bank only as a last resort: this makes the host pay fees on top of the amount taken back.",
          "File a complaint with the police if you think you were the victim of a scam (made-up event, host gone with the funds). Tell us too: we freeze the money pool concerned.",
        ],
      },
      {
        q: "Where does the money from contributions go?",
        a: "Straight to the host's account, through our provider Stripe. BirthReminder never holds the funds and takes no commission.",
      },
      {
        q: "Why do I have to verify my identity to open a money pool?",
        a: "It is a legal requirement for collecting money. Stripe verifies your identity and bank details, which also protects your guests.",
      },
      {
        q: "What if the event is cancelled?",
        a: "The money pool is frozen immediately: no more contributions are possible. The host remains responsible for refunding, and has a \"Refund everyone\" button that gives each person back everything they paid. Since we do not hold the funds, we cannot do it for them: only contribute to money pools opened by people you know.",
      },
      {
        q: "How much does a refund cost me as the host?",
        a: "The contributor gets back 100% of what they paid, but Stripe does not return the fees of the original transaction: about 1.5% of the amount plus 0.25 € per contribution remain at your expense. The app shows you this total BEFORE you start.",
      },
      {
        q: "How do I know I have been refunded?",
        a: "You get a notification as soon as the refund is recorded, and your contribution shows as \"refunded\" on the event page. The credit then appears on your statement within 5 to 10 business days depending on your bank. Note: if the refund happens shortly after your payment, your bank may simply cancel the original transaction instead of crediting an amount. In that case you will not see any refund arrive: the payment itself disappears from your statement. This is normal, and the amounts add up.",
      },
      {
        q: "Is a refund possible for a money pool by bank transfer?",
        a: "No. The app does not see these transfers and cannot refund anything: everything is settled bank to bank, directly with the host.",
      },
      {
        q: "Can I collect by bank transfer rather than by card?",
        a: "Yes, by sharing your bank details. Note: these transfers go bank to bank, outside the app. No record is kept and nothing can be proven in a disagreement.",
      },
      {
        q: "Can I use a money pool I already opened elsewhere?",
        a: "Yes. In the pool settings, turn on \"Money pool on another service\" and paste the link (Leetchi, Lydia, Le Pot Commun…). It will show on the event page, visible to all guests, including those who arrive later, unlike a link pasted in the chat that gets buried under messages.",
      },
      {
        q: "What changes when I use an external money pool?",
        a: "Everything happens on the chosen service: BirthReminder sees neither the amounts nor the participants. We cannot confirm anything in a disagreement, no receipt is sent, nothing appears in \"My contributions\", and no refund is possible from the app. It is just a displayed link: handy, but with none of the guarantees of the built-in money pool.",
      },
      {
        q: "How do I know where an external money pool link takes me?",
        a: "The real domain of the site is shown under the button, in small print. The name of the pool is chosen by the host and proves nothing: the domain is what you should check before tapping. If in doubt, ask the host.",
      },
      {
        q: "Can I contribute without my name showing?",
        a: "Yes, your contribution can be anonymous or made under a nickname, including towards the host.",
      },
    ],
  },
  {
    id: "encryption",
    emoji: "🔒",
    title: "Message encryption",
    items: [
      {
        q: "Who can read my messages?",
        a: "Only you and the person you are talking to. Messages are end-to-end encrypted: our servers only store encrypted text that we cannot read.",
      },
      {
        q: "What is the 12-word phrase for?",
        a: "In Profile → Encryption & security, maximum mode generates a 12-word recovery phrase. Write it down and keep it somewhere safe, off your phone: it lets you get your messages back on a new device.",
      },
      {
        q: "What happens if I forget my password?",
        a: "In standard mode, your key is protected by your password: resetting it makes the messages exchanged until then permanently unreadable. In maximum mode, you enter your 12-word phrase again and get everything back.",
      },
      {
        q: "What if I lose my recovery phrase?",
        a: "Nobody can recover it, not even us. That is exactly what makes your messages unreadable to others. Without it and without your password, older messages are lost.",
      },
    ],
  },
  {
    id: "sharing",
    emoji: "📤",
    title: "Sharing & shared lists",
    items: [
      {
        q: "How do I share a birthday card?",
        a: "From someone's card → Share this card. Your friend receives the first name, date of birth and name day in the chat. Your gift ideas are never passed on.",
      },
      {
        q: "What can the person who receives it do?",
        a: "Add it to their own birthdays. If the person concerned has an account, they can also send them a friend request, which that person will have to accept.",
      },
      {
        q: "What is a shared gift list for?",
        a: "Planning gifts for someone as a group: you all see and edit the same list, which avoids duplicates. Start it from the person's card → Shared list.",
      },
      {
        q: "What is the difference between a manager and a guest?",
        a: "A manager adds, edits and deletes ideas, and manages access. A guest views and reserves, nothing more: they see neither the gifts already bought or given, nor who reserved what.",
      },
      {
        q: "Where do I find my shared lists?",
        a: "Profile → Shared lists. You see the ones you manage and the ones you are a guest on, and you can open them directly or leave them.",
      },
      {
        q: "What is \"I'll take it\" for?",
        a: "Telling the others you are taking care of that gift, so nobody buys it twice. You can release your reservation at any time, and a manager can release someone else's, which is useful when that person never comes back.",
      },
      {
        q: "How do I share the list with someone who has no account?",
        a: "Turn on the public link from Share. If the list has an access code, the link alone shows nothing until the code is entered: use \"Send the link (code included)\" to pass on everything at once. Changing the code invalidates links already sent that contained it.",
      },
      {
        q: "Can I hide an idea from guests?",
        a: "Yes: open the idea then tap \"Visible to guests · hide\". It stays visible to managers, marked 🙈, but disappears for guests and for the public link.",
      },
      {
        q: "Can a guest suggest an idea?",
        a: "Yes. On a list where you are a guest, open \"Suggestions\" then \"Suggest an idea\": enter the gift name and, if you like, a link, a price and an image. The \"Fetch details from the link\" button fills everything in from the product link. Your suggestion does not go straight into the list: the managers decide.",
      },
      {
        q: "How do I accept or decline a suggestion?",
        a: "If you manage the list, the \"Suggestions\" button (next to \"Share\") shows how many suggestions are waiting. Open it, then choose Accept or Decline on each card. An accepted suggestion becomes a normal idea in the list. The person who suggested it is told either way.",
      },
      {
        q: "Where do I see the answer to my suggestion?",
        a: "In \"Suggestions\" → \"My suggestions\": each card shows Pending, Accepted or Not kept, even if you cleared the notification. \"Clear\" removes an answer from your list, with a few seconds to undo.",
      },
      {
        q: "How do I find my way around a long list?",
        a: "The filter combines two criteria: the occasion, and the reservation status (available, reserved, or the ones you are taking care of). Gifts already given move below a line at the bottom: they are not deleted, they are the record of what has already been given.",
      },
      {
        q: "What happens if I leave a shared list?",
        a: "It is removed from your card and you no longer see its ideas. The other members keep it, and someone will have to share it with you again for you to come back.",
      },
    ],
  },
  {
    id: "security",
    emoji: "🛡️",
    title: "Safety & moderation",
    items: [
      {
        q: "How do I report a message or a person?",
        a: "Long press a message, or from the person's profile → Report, and give the reason. Every report is reviewed, normally within 72 hours.",
      },
      {
        q: "What does blocking do?",
        a: "The blocked person can no longer send you messages, friend requests or invitations. They are not told. You manage your blocks in Profile → Blocked users.",
      },
      {
        q: "What happens if I remove a conversation?",
        a: "Long press a conversation to remove it from your list. It disappears on your side, but the other person keeps their copy: nobody can erase messages on someone else's side, especially if they serve as evidence after a report.",
      },
    ],
  },
  {
    id: "notifications",
    emoji: "🔔",
    title: "Notifications",
    items: [
      {
        q: "How do I manage email reminders?",
        a: "Profile → Notifications. Choose to be reminded 30, 14, 7, 3 or 1 day(s) before, or on the day.",
      },
      {
        q: "I am not getting notifications, what should I do?",
        a: "First check that they are allowed on your phone. If you declined them at first launch, the app cannot ask you again: Profile → Notifications then shows a banner with an \"Open settings\" button. By hand: on iPhone, Settings → BirthReminder → Notifications → Allow Notifications; on Android, Settings → Apps → BirthReminder → Notifications. Then check that the category you want is ticked in Profile → Notifications.",
      },
      {
        q: "How do I get the monthly recap?",
        a: "Profile → Email notifications → Monthly recap. On the 1st of each month you receive the upcoming birthdays. This setting is independent of birthday reminders: you can keep one without the other.",
      },
      {
        q: "Are push notifications native?",
        a: "Yes. Accept the notification permission when the app starts. You can set reminders per date from a person's card.",
      },
      {
        q: "Can I read messages in notifications?",
        a: "Messages are end-to-end encrypted and decrypted on your phone: the text shows right in the notification, like on WhatsApp.",
      },
    ],
  },
  {
    id: "account",
    emoji: "⚙️",
    title: "My account",
    items: [
      {
        q: "How do I edit my details?",
        a: "Profile → My details (first name, last name, date of birth, photo).",
      },
      {
        q: "How do I change my password?",
        a: "Profile → Change my password. You will be asked for your current password.",
      },
      {
        q: "How do I change the app's language?",
        a: "The app follows your phone's language: French if your phone is in French, English otherwise. To choose yourself, go to Profile → Language. Notifications and emails arrive in the language you choose.",
      },
      {
        q: "How old do I need to be to create an account?",
        a: "15, or 16 in countries where the law requires it (Germany, Ireland, the Netherlands, Poland and others). The app tells you as soon as you pick your date of birth. Without an account there is no minimum age: your data stays on your phone.",
      },
      {
        q: "Can I back up my cards?",
        a: "Yes: Profile → Backup. The file contains your birthday cards, their gift ideas, their photos and your wishlist. You can restore it at any time without creating duplicates.",
      },
      {
        q: "How do I contact support?",
        a: "Profile → Contact support. The team's replies arrive in the Support tab of Chats, where you can continue the conversation. A notification tells you about each reply.",
      },
      {
        q: "How do I get a copy of my data?",
        a: "Profile → Download my data. You get a file with your profile, dates, friends, gifts, events and conversations. Your messages are decrypted by your phone at export time.",
      },
      {
        q: "How do I delete my account?",
        a: "Profile → at the very bottom → Delete my account. GDPR compliant: your data is deleted or anonymised.",
      },
      {
        q: "What happens to my conversations if I delete my account?",
        a: "They are removed on your side, but the people you talked to keep their copy of the exchanges. Your messages will appear there as \"Deleted user\".",
      },
    ],
  },
];
