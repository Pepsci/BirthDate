// Version anglaise de ../CGU.jsx. Toute modification de l'une doit être
// reportée dans l'autre. En cas de divergence, la version française prévaut.
import { Link } from "react-router-dom";
import LegalLanguageSwitch from "../LegalLanguageSwitch";
import "../css/legalPages.css";

export default function TermsEn() {
  return (
    <div className="legal-page-container" lang="en">
      <div className="legal-page-content">
        <Link to="/home" className="back-link">
          ← Back to home
        </Link>
        <LegalLanguageSwitch path="cgu" lang="en" />

        <h1>📜 Terms of Use</h1>

        <p className="intro">
          These Terms of Use govern the use of the BirthReminder service. By
          using our service, you accept these terms in full.
        </p>

        <section>
          <h2>1. Purpose</h2>
          <p>
            BirthReminder is an online service for managing and receiving
            reminders for the birthdays of the people close to you. The
            service includes:
          </p>
          <ul>
            <li>Managing birthdays</li>
            <li>Sending notifications by email</li>
            <li>A friends system to share dates</li>
            <li>A real time chat between friends</li>
            <li>Managing wishlists</li>
            <li>An event organizer</li>
          </ul>
          <p>
            On the mobile app, part of the service can also be used without an
            account (article 2.4).
          </p>
        </section>

        <section>
          <h2>2. Access to the service</h2>

          <h3>2.1 Creating an account</h3>
          <p>
            To use the whole BirthReminder service, you must create an account
            by providing:
          </p>
          <ul>
            <li>A valid email address</li>
            <li>A first name and a last name</li>
            <li>
              A secure password (at least 8 characters, 1 uppercase letter, 1
              lowercase letter, 1 digit)
            </li>
          </ul>

          <h3>2.2 Email verification</h3>
          <p>
            You must verify your email address by clicking the link sent when
            you sign up. Without this verification, you will not be able to
            access the service.
          </p>

          <h3>2.3 Age requirements</h3>
          <p>
            The BirthReminder service is reserved for people aged at least{" "}
            <strong>15</strong>, the age from which a minor can consent alone
            to the processing of their data for an online service in France.
          </p>
          <p>
            This age is raised to <strong>16</strong> in countries whose law
            requires it (in particular Germany, Ireland, the Netherlands and
            Poland), and when the user's country cannot be determined. The age
            that applies to you is shown when you sign up; in the rest of
            these terms, "15" refers to this minimum age.
          </p>
          <p>
            No account can be created for a person under 15, including by a
            parent or guardian on their behalf. Users aged 15 to 17 have
            access to the whole service, except for opening gift pools
            (article 5.2).
          </p>
          <p className="warning">
            ⚠️ An account that turns out to belong to a person under 15 is
            deleted.
          </p>

          <h4>Accuracy of the date of birth</h4>
          <p>
            By creating your account, you certify that the date of birth you
            give is accurate. It determines access to some features, in
            particular gift pools, which are reserved for adults (article
            5.2).
          </p>
          <p>
            Any later change to the date of birth is recorded. When it turns a
            minor's account into an adult's account, a gift pool can only be
            opened after a period of 30 days. A false declaration may lead to
            the suspension of access to gift pools, or of the account (article
            7.2).
          </p>

          <h3>2.4 Use without an account (mobile app)</h3>
          <p>
            The mobile app can be used without creating an account. In this
            mode, birthdays, gift ideas, photos and the wishlist are saved{" "}
            <strong>only on the user's device</strong>. They are neither sent
            to BirthReminder nor hosted on its servers.
          </p>
          <p>
            This mode has no age requirement, since no data is collected. The
            features that involve connecting several people (friends, chat,
            events, shared lists, gift pools, public sharing, gift
            reservation) are not available in it, nor is access from the
            website or syncing between devices.
          </p>
          <p className="warning">
            ⚠️ Since BirthReminder has no copy of this data, it cannot recover
            it if the device is lost, stolen or reset, or if the app is
            deleted. It is up to the user to make backups, using the export
            feature provided for that purpose.
          </p>
          <p>
            The user can create an account at any time and import their data
            into it; the conditions of article 2.3 then apply.
          </p>
        </section>

        <section>
          <h2>3. Use of the service</h2>

          <h3>3.1 User obligations</h3>
          <p>By using BirthReminder, you agree to:</p>
          <ul>
            <li>Provide accurate and up to date information</li>
            <li>Keep your password confidential</li>
            <li>Not share your account with third parties</li>
            <li>Respect other users</li>
            <li>Not use the service for illegal or malicious purposes</li>
            <li>Not attempt to bypass security measures</li>
            <li>Not send spam or inappropriate content through the chat</li>
          </ul>

          <h3>3.2 Prohibited behaviour</h3>
          <p>It is strictly forbidden to:</p>
          <ul>
            <li>Harass, threaten or insult other users</li>
            <li>Post illegal, offensive or discriminatory content</li>
            <li>Impersonate another person</li>
            <li>Attempt to access other users' accounts</li>
            <li>Use scripts or bots to automate actions</li>
            <li>Collect other users' data without their consent</li>
            <li>Disrupt the operation of the service</li>
          </ul>
          <p className="warning">
            ⚠️ Any breach of these rules may lead to the suspension or
            permanent deletion of your account without notice.
          </p>

          <h3>3.3 Reporting content or a user</h3>
          <p>
            Every message, gift proposal or wishlist can be reported from the
            app, with a reason (spam, harassment, inappropriate content,
            scam). The report is sent to our moderation team.
          </p>
          <p>
            We undertake to review each report within a reasonable time, in
            principle within 72 hours. Depending on how serious it is, we may
            delete the content, warn its author, suspend their account or
            delete it permanently. Reported items are kept for as long as
            needed to handle the report, even if one of the users has removed
            the conversation from their list.
          </p>
          <p>
            If your account is suspended or deleted and you believe the
            decision is unjustified, you can challenge it by writing to{" "}
            <a href="mailto:contact@birthreminder.com">
              contact@birthreminder.com
            </a>
            . We will review your situation.
          </p>

          <h3>3.4 Blocking a user</h3>
          <p>
            You can block a user at any time. Blocking prevents that person
            from sending you messages, friend requests, or invitations to an
            event or a shared gift list. They are not told about the block.
            You can view and lift your blocks from your profile.
          </p>
        </section>

        <section>
          <h2>4. User content</h2>

          <h3>4.1 Ownership of content</h3>
          <p>
            You keep all rights to the content you create on BirthReminder
            (dates, wishlists, messages, etc.). By using the service, you
            grant us a limited licence to store, process and display this
            content as part of the service.
          </p>

          <h3>4.2 Responsibility for content</h3>
          <p>
            You alone are responsible for the content you post. BirthReminder
            is not responsible for content created by users and reserves the
            right to delete any inappropriate content.
          </p>

          <h3>4.3 Product links and affiliate links</h3>
          <p>
            When you add a product link to a wishlist, we try to extract its
            title, price and image automatically.
          </p>
          <p className="warning">
            ⚠️ Some merchant links, in particular those pointing to Amazon,
            are turned into affiliate links. If a purchase is made from one of
            these links, we may receive a commission from the merchant.{" "}
            <strong>
              This costs you nothing extra and changes neither the price nor
              the product.
            </strong>{" "}
            This income does not influence the products shown to you: they are
            the ones you or your friends chose.
          </p>

          <h3>4.4 Sharing a birthday card</h3>
          <p>
            You can send a friend a birthday card (first name, last name, date
            of birth, name day). Your gift ideas are never included. The
            recipient can save this card on their side; the copy they get is
            independent of yours and is not updated if you change yours.
          </p>
          <p>
            If the person concerned has an account, the recipient can send
            them a friend request:{" "}
            <strong>they will have to accept it for the link to be made</strong>
            . Only share a card with people who have a legitimate reason to
            know this information.
          </p>

          <h3>4.5 Removing a conversation</h3>
          <p>
            Removing a conversation makes it disappear from your list and
            hides earlier messages, for you only.{" "}
            <strong>
              The person you talked to keeps their copy of the exchanges.
            </strong>{" "}
            Nobody can erase messages held by someone else, in particular when
            they serve as evidence after a report. The conditions and
            retention periods are detailed in our privacy policy.
          </p>

          <h3>4.6 Retrieving your data</h3>
          <p>
            You can download a copy of your data from your profile at any
            time. Because your messages are end to end encrypted, they are
            decrypted by your device at the time of the export: if your key is
            not present on it, the messages concerned will remain unreadable.
          </p>
        </section>

        <section>
          <h2>5. Event gift pools</h2>

          <p>
            The organizer of an event can open a gift pool to fund a shared
            gift. Read this section carefully: it defines who is responsible
            for the money collected.
          </p>

          <h3>5.1 The role of BirthReminder</h3>
          <p className="warning">
            ⚠️ BirthReminder is not a payment institution, never holds the
            funds and takes no commission on gift pools. We only provide the
            tool that lets an organizer collect money from their guests.
          </p>
          <p>
            Card payments are collected{" "}
            <strong>directly on the organizer's account</strong> with our
            provider Stripe. At no point does the money go through a
            BirthReminder account.
          </p>

          <h3>5.2 Responsibility of the organizer</h3>
          <p className="warning">
            ⚠️ Only an adult (aged 18 or over) can open a gift pool or offer
            their guests a means of payment (bank card, bank details, PayPal,
            link to a pool held on another service). A user aged 15 to 17 can
            use all the other features and contribute to other people's gift
            pools. If it turns out that a gift pool was opened by a minor,
            BirthReminder freezes it and disables its author's access to gift
            pools.
          </p>
          <p>The organizer who opens a gift pool is solely responsible for:</p>
          <ul>
            <li>
              the use of the money collected, in line with what they announced
              to the participants;
            </li>
            <li>
              returning it if the event is cancelled or if the gift is not
              bought in the end;
            </li>
            <li>
              the accuracy of the information they give (target amount,
              purpose of the gift, deadline);
            </li>
            <li>any reporting or tax obligations they may have.</li>
          </ul>
          <p>
            The app gives them a refund feature (article 5.4). It makes this
            obligation easier to fulfil, it does not transfer it: the fact
            that a tool exists does not make BirthReminder responsible for the
            money, and the fact that it is not used does not release the
            organizer from refunding.
          </p>
          <p>
            By opening a gift pool, they create{" "}
            <strong>their own Stripe account</strong> and submit to the
            identity checks required by regulations. This account belongs to
            them: they access it directly, view their receipts there and
            manage their bank details there, as they would on any other
            platform. As such they accept, in addition to these terms, the{" "}
            <a
              href="https://stripe.com/legal/ssa"
              target="_blank"
              rel="noopener noreferrer"
            >
              Stripe Services Agreement
            </a>{" "}
            and, where applicable, the{" "}
            <a
              href="https://stripe.com/legal/connect-account"
              target="_blank"
              rel="noopener noreferrer"
            >
              Stripe Connected Account Agreement
            </a>
            . These documents remain available from the gift pool management
            page.
          </p>
          <p>
            Those terms govern the payment account, not the gift pool itself:{" "}
            <strong>
              they provide for no obligation to refund in the event of
              cancellation
            </strong>
            . On the contrary, Stripe states in them that the account holder
            is solely responsible for the goods and services provided to their
            customers, and that fees already charged are not refundable. The
            organizer's obligations towards participants therefore arise only
            from this article 5.
          </p>

          <h3>5.3 Responsibility of the participant</h3>
          <p>
            Contributing to a gift pool is a voluntary act between private
            individuals. You only contribute to people you know and trust. A
            contribution is not the purchase of a good or a service: the right
            of withdrawal that applies to online purchases does not apply to
            it.
          </p>
          <p>
            You cannot cancel a contribution yourself once it has been paid:
            only the organizer can trigger a refund, and leaving the event
            does not refund you. Get in touch with them.
          </p>
          <p>
            These terms are accepted when the account is created. A
            participant who contributes <strong>without an account</strong>,
            from an invitation link, accepts them explicitly before paying:
            the confirmation box shown at that step counts as acceptance, and
            its date is kept with the contribution.
          </p>

          <h3>5.4 Refunding contributions</h3>
          <p>
            The organizer can refund one contribution, or all of them, from
            the event page. The refund is carried out{" "}
            <strong>on their own Stripe account</strong>: we pass on the
            instruction, we move no funds, and we do not have to step in for
            them if they do not do it.
          </p>
          <p>
            We do however have a technical ability to act on payments
            collected through the app.{" "}
            <strong>
              We do not arbitrate disagreements and do not act at the request
              of an unhappy participant
            </strong>
            : this ability is reserved for exceptional and documented
            situations, such as established fraud, an organizer who cannot be
            reached or whose account has been deleted, or a decision by a
            competent authority. It also remains limited by the balance
            available on the organizer's account: once the money has been paid
            out to their bank account, nobody can call it back in their place.
          </p>
          <p>
            The contributor gets back <strong>the full amount</strong> paid.
            However, Stripe does not return the fees charged on the original
            transaction: about{" "}
            <strong>1.5% of the amount plus €0.25</strong> per contribution
            remain payable by the organizer, on top of the amount returned.
            This cost is shown to them before they confirm the operation.
            These fees are set by Stripe and may change independently of us.
          </p>
          <p>
            Cancelling an event, like transferring the organizer role,{" "}
            <strong>freezes the gift pool</strong>: no further contribution
            can be paid into it. The money already collected stays on the
            Stripe account of the organizer who collected it. It does not
            follow the transfer of the role. It is up to them to pass it on to
            the new organizer or to refund the participants.
          </p>
          <p className="warning">
            ⚠️ A refund is irreversible and cannot be cancelled from the app.
            The actual credit to the contributor's account then depends on
            their bank and may take several working days: this delay depends
            neither on BirthReminder nor on the organizer.
          </p>
          <p>
            Contributions received by bank transfer (article 5.6) cannot be
            refunded by the app, which has no record of them.
          </p>

          <h3>5.5 Disputes: what to do and in what order</h3>
          <p>
            A gift pool connects two private individuals. Any dispute is
            therefore settled{" "}
            <strong>between the participant and the organizer</strong>:
            BirthReminder is not a party to the transaction, does not
            arbitrate these disputes and cannot pay back money it does not
            hold. We can however establish that a payment took place, and that
            is often what unblocks the situation.
          </p>
          <p>
            Each card contribution results in a receipt being sent to its
            author, showing the amount, the date, the identity of the
            organizer who collected it and the payment reference.{" "}
            <strong>Keep this message</strong>: it is your proof, and the
            first document you will be asked for at each step below.
          </p>
          <ol>
            <li>
              <strong>Contact the organizer.</strong> They are the only one
              holding the funds and the only one who can trigger the refund.
              Give them the reference shown on your receipt. The vast majority
              of situations are settled here.
            </li>
            <li>
              <strong>Write to us</strong> from the contact page if you get no
              answer. We will not rule on the substance of the disagreement,
              but we can confirm the payment, check that the organizer's
              account still exists and follow up with them.
            </li>
            <li>
              <strong>Refer the matter to a court conciliator</strong>{" "}
              (conciliateur de justice) if the disagreement persists. In
              France this is free, it is requested at the town hall or the
              local court, and it is a <em>mandatory first step</em> before
              any legal action for disputes under €5,000. Please note: the
              consumer ombudsman has no jurisdiction here, since that requires
              a dispute between a consumer and a professional.
            </li>
            <li>
              <strong>Dispute the payment with your bank</strong> as a last
              resort. Be aware that this makes the organizer bear non
              refundable dispute fees, on top of the amount taken back.
            </li>
            <li>
              <strong>File a complaint with the police</strong> if you believe
              you have been the victim of a scam, such as a made up event or
              an organizer who disappeared with the funds. In France, online
              complaints for internet scams are filed through the THESEE
              service, on the website of the Ministry of the Interior. Report
              it to us as well: we freeze the gift pool concerned and
              cooperate with the authorities.
            </li>
          </ol>
          <p>
            For card payments, we keep a record of each contribution: identity
            of the contributor, amount, date and payment reference. This
            information can be given to the people concerned or to the
            competent authorities on legitimate request.
          </p>

          <h3>5.6 Gift pool by bank transfer</h3>
          <p className="warning">
            ⚠️ The organizer may choose to share their bank details instead of
            using card payment. In that case, transfers go from bank to bank,
            outside our services:{" "}
            <strong>
              we keep no record of them and cannot provide any proof of
              payment in the event of a dispute.
            </strong>{" "}
            This method relies entirely on the trust you place in the
            organizer.
          </p>

          <h3>5.7 Gift pool opened on another service</h3>
          <p>
            Instead of using the built in gift pool, the organizer can show on
            the event page a link to a pool opened with a third party
            (Leetchi, Lydia, Le Pot Commun or any other service).
          </p>
          <p className="warning">
            ⚠️ In that case, BirthReminder only shows a link.{" "}
            <strong>
              The collection takes place entirely outside our services
            </strong>
            : we know neither the amounts nor the participants, we send no
            receipt, we keep no record of it and we cannot provide any proof
            of payment. No refund is possible from the app, and these
            contributions do not appear in your history.
          </p>
          <p>
            Your contribution is then governed by the terms of the service
            concerned, which you should refer to. Any dispute is settled with
            the organizer or with that service, and article 5.5 does not apply
            to it: we cannot confirm a payment we have no knowledge of.
          </p>
          <p>
            Showing such a link is neither a recommendation, nor a
            verification of the service concerned, nor a guarantee about how
            the money collected is used. The name given to the pool is chosen
            by the organizer; the actual domain of the link is shown next to
            it so that you can check where it takes you before clicking. We
            remove any link reported to us as fraudulent or misleading.
          </p>

          <h3>5.8 A free service</h3>
          <p>
            All BirthReminder features are currently free and without
            advertising: unlimited dates, unlimited friends, encrypted chat,
            events, wishlists, export of your data. A paid plan may be offered
            in the future; it would then be covered by an update to these
            terms and would not retroactively restrict what you already have.
          </p>
        </section>

        <section>
          <h2>6. Availability of the service</h2>

          <h3>6.1 Availability</h3>
          <p>
            We do our best to keep the service accessible 24 hours a day, 7
            days a week. However, we do not guarantee uninterrupted
            availability and we reserve the right to carry out maintenance.
          </p>

          <h3>6.2 Changes to the service</h3>
          <p>
            We may change, suspend or discontinue all or part of the service
            at any time, with or without notice. We will do our best to inform
            you in advance of significant changes.
          </p>
        </section>

        <section>
          <h2>7. Termination</h2>

          <h3>7.1 By the user</h3>
          <p>
            You can delete your account at any time from your profile. Your
            data will be anonymised immediately and permanently deleted within
            30 days.
          </p>

          <h3>7.2 By BirthReminder</h3>
          <p>
            We reserve the right to suspend or delete your account in the
            event of:
          </p>
          <ul>
            <li>Breach of these Terms of Use</li>
            <li>Inappropriate or harmful behaviour</li>
            <li>Fraudulent use of the service</li>
            <li>
              False declaration of date of birth, in particular to access gift
              pools
            </li>
            <li>Prolonged inactivity (more than 2 years)</li>
          </ul>
        </section>

        <section>
          <h2>8. Intellectual property</h2>
          <p>
            All content on the website (design, code, logo, texts, etc.) is
            the exclusive property of Joss Filippi, unless stated otherwise.
          </p>
          <p>
            Any reproduction, distribution or use without permission is
            forbidden.
          </p>
        </section>

        <section>
          <h2>9. Personal data protection</h2>
          <p>
            Your personal data is processed in accordance with our{" "}
            <Link to="/en/privacy">Privacy Policy</Link> and the GDPR.
          </p>
          <p>In particular, you have the following rights:</p>
          <ul>
            <li>Right of access to your data</li>
            <li>Right to rectification</li>
            <li>Right to erasure (right to be forgotten)</li>
            <li>Right to data portability</li>
            <li>Right to object</li>
          </ul>
        </section>

        <section>
          <h2>10. Limitation of liability</h2>

          <h3>10.1 Service provided "as is"</h3>
          <p>
            BirthReminder is provided "as is" without warranty of any kind,
            express or implied. We do not guarantee that the service will be
            free of errors or available at all times.
          </p>

          <h3>10.2 Limitation of liability</h3>
          <p>
            To the extent permitted by law, BirthReminder cannot be held
            liable for:
          </p>
          <ul>
            <li>Indirect or consequential damage</li>
            <li>Loss of data or profits</li>
            <li>Service interruptions</li>
            <li>Content created by other users</li>
          </ul>

          <h3>10.3 Forgotten birthdays</h3>
          <p className="note">
            💡 BirthReminder is a reminder tool, but we cannot guarantee that
            100% of emails are received. We encourage you to check your
            important dates regularly.
          </p>
          <p>
            When used without an account (article 2.4), reminders are
            scheduled by the device itself, for a limited period: they depend
            on its notification settings and require opening the app
            regularly.
          </p>
        </section>

        <section>
          <h2>11. Governing law and jurisdiction</h2>
          <p>
            These Terms of Use are governed by French law. In the event of a
            dispute, and failing an amicable settlement, the French courts
            shall have sole jurisdiction.
          </p>
          <p>
            In accordance with article L.612-1 of the French Consumer Code,
            you can use a consumer ombudsman free of charge in the event of a
            dispute.
          </p>
        </section>

        <section>
          <h2>12. Changes to these terms</h2>
          <p>
            We may change these Terms of Use at any time. You will be notified
            of significant changes by email and/or through a notification on
            the website.
          </p>
          <p>
            By continuing to use the service after the terms have changed, you
            accept the new terms.
          </p>
        </section>

        <section>
          <h2>13. Contact</h2>
          <p>
            For any question about these terms, use the{" "}
            <a href="/contact">contact form</a>. It is available with or
            without an account, and it opens a follow up: your request is not
            just an email lost in an inbox, you can read the answers and
            continue the conversation.
          </p>
          <ul>
            <li>
              <strong>Form:</strong>{" "}
              <a href="/contact">birthreminder.com/contact</a>
            </li>
            <li>
              <strong>Response time:</strong> within 48 hours at most
            </li>
          </ul>
        </section>

        <p className="last-update">
          <strong>Last updated:</strong> 6 October 2026
        </p>
      </div>
    </div>
  );
}
