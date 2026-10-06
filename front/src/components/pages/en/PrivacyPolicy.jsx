// Version anglaise de ../PrivacyPolicy.jsx. Toute modification de l'une doit
// être reportée dans l'autre.
import { Link } from "react-router-dom";
import LegalLanguageSwitch from "../LegalLanguageSwitch";
import "../css/legalPages.css";

export default function PrivacyPolicyEn() {
  return (
    <div className="legal-page-container" lang="en">
      <div className="legal-page-content">
        <Link to="/home" className="back-link">
          ← Back to home
        </Link>
        <LegalLanguageSwitch path="privacy" lang="en" />

        <h1>🔒 Privacy Policy</h1>

        <p className="intro">
          At BirthReminder, we respect your privacy and are committed to
          protecting your personal data. This policy explains which data we
          collect, why, and how you can exercise your rights.
        </p>

        <section>
          <h2>1. Data controller</h2>
          <p>The controller of your personal data is:</p>
          <ul>
            <li>
              <strong>Name:</strong> Joss Filippi
            </li>
            <li>
              <strong>Email:</strong>{" "}
              <a href="mailto:privacy@birthreminder.com">
                privacy@birthreminder.com
              </a>
            </li>
          </ul>
        </section>

        <section>
          <h2>2. Data we collect</h2>

          <h3>2.1 Data you give us</h3>
          <p>When you use BirthReminder, we collect:</p>
          <ul>
            <li>
              <strong>Account information:</strong> Email, last name, first
              name, password (encrypted)
            </li>
            <li>
              <strong>Birthdays:</strong> Last name, first name and date of
              birth of the people you save
            </li>
            <li>
              <strong>Wishlists:</strong> Gift ideas, links, personal notes
            </li>
            <li>
              <strong>Messages:</strong> Chat conversations with your friends
            </li>
            <li>
              <strong>Social connections:</strong> Friends list, friend
              requests
            </li>
          </ul>

          <h3>2.1 bis Data about people who are not registered</h3>
          <p>
            When you save the birthday of someone close to you who has no
            account, you entrust us with data about them: their first name,
            last name and date of birth. That person has not agreed to
            anything and usually does not know this information is being
            saved.
          </p>
          <p>
            This data is processed on the basis of legitimate interest:
            keeping a birthday book is a personal matter, and we make no other
            use of it. It is not sold, not used for advertising, and not used
            to build a profile. It is visible only to you, unless you choose
            to share the corresponding card with a friend.
          </p>
          <p>
            By saving this data, you agree to enter only people you know
            personally and not to misuse this service to build a file of
            people.
          </p>
          <p>
            Anyone who finds out that their data is on BirthReminder without
            being registered can ask for it to be erased by writing to{" "}
            <a href="mailto:privacy@birthreminder.com">
              privacy@birthreminder.com
            </a>
            . We will delete it after checking their identity, without asking
            them to create an account.
          </p>

          <h3>2.2 Data collected automatically</h3>
          <ul>
            <li>
              <strong>Connection data:</strong> IP address, browser type,
              operating system
            </li>
            <li>
              <strong>Cookies:</strong> See our{" "}
              <Link to="/en/cookies">Cookie Policy</Link>
            </li>
            <li>
              <strong>Usage data:</strong> Pages visited, time spent, features
              used
            </li>
          </ul>

          <h3>2.3 Use without an account (mobile app)</h3>
          <p>
            When you use the mobile app without an account,{" "}
            <strong>BirthReminder collects no data</strong>: the dates, gift
            ideas, photos and your wishlist are saved only on your device. The
            app sends no request to our servers, registers no notification
            token, and reminders are scheduled locally by the device.
          </p>
          <p>
            This data may be included in your device backup (iCloud, Google),
            depending on your own settings and under the responsibility of
            those services. The export file you create remains under your sole
            control: you choose where to save it and who to share it with.
          </p>
          <p>
            If you later create an account and choose to import your cards
            into it, they are then sent to our servers and processed in
            accordance with this policy.
          </p>
        </section>

        <section>
          <h2>3. Purposes and legal bases of processing</h2>

          <table>
            <thead>
              <tr>
                <th>Purpose</th>
                <th>Legal basis</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Creating and managing your account</td>
                <td>Performance of the contract</td>
              </tr>
              <tr>
                <td>Sending birthday notifications</td>
                <td>Performance of the contract</td>
              </tr>
              <tr>
                <td>Real time chat with your friends</td>
                <td>Performance of the contract</td>
              </tr>
              <tr>
                <td>Improving the service</td>
                <td>Legitimate interest</td>
              </tr>
              <tr>
                <td>Sending marketing emails (if you agreed)</td>
                <td>Consent</td>
              </tr>
              <tr>
                <td>Security and fraud prevention</td>
                <td>Legitimate interest</td>
              </tr>
            </tbody>
          </table>
        </section>

        <section>
          <h2>4. Retention period</h2>
          <ul>
            <li>
              <strong>Active account:</strong> Your data is kept for as long
              as your account exists
            </li>
            <li>
              <strong>After account deletion:</strong> Permanent deletion
              within 30 days. Your conversations are removed on your side as
              soon as you ask, under the same conditions as a manual removal
              (point 4.1): the people you talked to keep their copy of the
              exchanges. Once your account is erased, your messages only carry
              the label "Deleted user"
            </li>
            <li>
              <strong>Connection data:</strong> Kept for 1 year (legal
              obligation)
            </li>
            <li>
              <strong>Chat messages:</strong> Kept for as long as your account
              exists, deleted 30 days after account deletion
            </li>
            <li>
              <strong>Conversations removed from your list:</strong> See point
              4.1 below
            </li>
          </ul>

          <h3>4.1 Deleting a conversation</h3>
          <p>
            When you delete a conversation, it is removed from your list and
            earlier messages are no longer shown to you.{" "}
            <strong>
              They are not destroyed, however: the person you talked to keeps
              their copy of your exchanges.
            </strong>
          </p>
          <p>
            This choice is deliberate. The messages you sent are also the
            correspondence of the person who received them, and nobody should
            be able to erase data held by someone else. It also ensures that a
            person reported for harassment cannot destroy the evidence of what
            they did.
          </p>
          <p>
            These messages are permanently deleted <strong>12 months</strong>{" "}
            after both participants have removed the conversation from their
            list, unless they are the subject of a report still being handled.
            If a new message arrives in the meantime, the conversation
            reappears in your list, with the new messages only.
          </p>
          <p>
            Conversations removed from your list are included in your data
            export (point 6), along with the date on which you removed them.
          </p>
        </section>

        <section>
          <h2>5. Data sharing</h2>

          <h3>5.1 With other users</h3>
          <p>
            When you add a friend on BirthReminder, you choose to share some
            information with that person:
          </p>
          <ul>
            <li>Your first and last name</li>
            <li>Your birthday</li>
            <li>Your wishlist (if you make it visible)</li>
            <li>The messages you send them through the chat</li>
          </ul>

          <h3>5.2 With service providers</h3>
          <p>We use service providers for:</p>
          <ul>
            <li>
              <strong>Hosting:</strong> Amazon Web Services (AWS), data hosted
              in Europe
            </li>
            <li>
              <strong>Transactional emails:</strong> Amazon Web Services (SES)
            </li>
            <li>
              <strong>Payments (gift pools):</strong> Stripe. We never have
              access to your full banking details
            </li>
            <li>
              <strong>Audience measurement:</strong> PostHog (hosted in the
              European Union), enabled only with your consent, pseudonymised
              data (technical identifier, no name or email), form content
              never recorded
            </li>
          </ul>
          <p>
            These providers are contractually required to protect your data
            and may only use it for the defined purposes.
          </p>

          <h3>5.3 Transfers outside the EU</h3>
          <p>
            Some providers may be located outside the European Union. In that
            case, we make sure appropriate safeguards are in place, in
            particular the standard contractual clauses of the European
            Commission.
          </p>
        </section>

        <section>
          <h2>6. Your rights (GDPR)</h2>
          <p>Under the GDPR, you have the following rights:</p>

          <ul>
            <li>
              <strong>✅ Right of access:</strong> Get a copy of your personal
              data
            </li>
            <li>
              <strong>✏️ Right to rectification:</strong> Correct inaccurate
              data
            </li>
            <li>
              <strong>🗑️ Right to erasure:</strong> Delete your data ("right
              to be forgotten")
            </li>
            <li>
              <strong>⏸️ Right to restriction:</strong> Temporarily block the
              processing of your data
            </li>
            <li>
              <strong>📦 Right to data portability:</strong> Retrieve your
              data in a structured format
            </li>
            <li>
              <strong>❌ Right to object:</strong> Object to certain
              processing
            </li>
            <li>
              <strong>🔄 Right to withdraw your consent:</strong> At any time,
              for processing based on consent
            </li>
          </ul>

          <h3>How to exercise your rights</h3>
          <p>You can exercise your rights:</p>
          <ul>
            <li>
              Directly from your profile, with "Download my data" and "Delete
              my account". The export contains your profile, your dates, your
              friends, your gift lists, your events, your conversations and
              your activity log, in JSON format.
              <br />
              Because your messages are end to end encrypted, our servers
              cannot read them: they are decrypted by your device at the time
              of the export. An export started from a device where your key is
              not present will contain messages that cannot be decrypted.
            </li>
            <li>
              By email at:{" "}
              <a href="mailto:privacy@birthreminder.com">
                privacy@birthreminder.com
              </a>
            </li>
          </ul>
          <p>
            We answer your request within <strong>1 month at most</strong>.
          </p>

          <h3>Complaint to the supervisory authority</h3>
          <p>
            If you believe your rights are not respected, you can lodge a
            complaint with the CNIL (Commission Nationale de l'Informatique et
            des Libertés), the French data protection authority, or with the
            data protection authority of your country of residence:
          </p>
          <ul>
            <li>
              <strong>Website:</strong>{" "}
              <a
                href="https://www.cnil.fr/en"
                target="_blank"
                rel="noopener noreferrer"
              >
                cnil.fr
              </a>
            </li>
            <li>
              <strong>Address:</strong> 3 Place de Fontenoy, TSA 80715, 75334
              PARIS CEDEX 07, France
            </li>
          </ul>
        </section>

        <section>
          <h2>7. Data security</h2>
          <p>
            We implement appropriate security measures to protect your data:
          </p>
          <ul>
            <li>🔐 Password hashing (bcrypt)</li>
            <li>🔒 Secure HTTPS connections</li>
            <li>🛡️ Protection against attacks (CSRF, XSS, SQL injection)</li>
            <li>🔑 Authentication with JWT tokens</li>
            <li>💾 Regular backups</li>
            <li>👥 Restricted access to data (principle of least privilege)</li>
          </ul>
        </section>

        <section>
          <h2>8. Message encryption</h2>
          <p>
            Your messages are end to end encrypted (E2E).{" "}
            <strong>
              BirthReminder cannot read the content of your conversations, now
              or ever.
            </strong>
          </p>

          <h3>Standard mode (default)</h3>
          <p>
            Your messages are encrypted with a key derived from your password.
            They remain accessible on all your devices after you log in.
          </p>

          <h3>Maximum encryption mode (optional)</h3>
          <p>
            Your messages are protected by a 12 word recovery phrase that only
            you hold. If you lose both this phrase and your password, your
            messages are permanently inaccessible.{" "}
            <strong>
              BirthReminder has no way of recovering them in that case.
            </strong>
          </p>
        </section>

        <section>
          <h2>9. Minors</h2>
          <p>
            A BirthReminder account can be created from the age of 15, the age
            from which a minor can consent alone to the processing of their
            data for an online service in France (article 45 of the French
            Data Protection Act). No account can be created for a person under
            15, including by a parent on their behalf (article 2.3 of the
            Terms of Use).
          </p>
          <p>
            This age is raised to 16 in countries whose law requires it, or
            when the country cannot be determined. To know which age applies,
            we use the country set on your phone and the one matching your IP
            address, when you sign up or change your date of birth. This
            country is not saved in your account.
          </p>
          <p>
            Your date of birth is used to check these age conditions and to
            restrict gift pools to adults. Changes to it are kept in our audit
            log, so that a false declaration can be detected and dealt with.
          </p>
          <p>
            If we learn that a person under 15 has created an account, we
            delete it, along with the associated data.
          </p>
          <p>
            A person under 15 can use the mobile app without an account
            (section 2.3 above): their data stays on their device and
            BirthReminder processes none of it.
          </p>
        </section>

        <section>
          <h2>10. Changes to this policy</h2>
          <p>
            We may change this privacy policy to reflect changes in our
            practices or for legal reasons.
          </p>
          <p>
            You will be notified of any significant change by email and/or
            through a notification on the website. We encourage you to check
            this page regularly.
          </p>
        </section>

        <section>
          <h2>11. Contact</h2>
          <p>
            For any question about this privacy policy or your personal data,
            contact us:
          </p>
          <ul>
            <li>
              <strong>Email:</strong>{" "}
              <a href="mailto:privacy@birthreminder.com">
                privacy@birthreminder.com
              </a>
            </li>
            <li>
              <strong>Response time:</strong> Within 48 hours at most
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
