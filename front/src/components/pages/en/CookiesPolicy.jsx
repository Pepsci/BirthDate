// Version anglaise de ../CookiesPolicy.jsx. Toute modification de l'une doit
// être reportée dans l'autre.
import { Link } from "react-router-dom";
import LegalLanguageSwitch from "../LegalLanguageSwitch";
import "../css/legalPages.css";

export default function CookiesPolicyEn() {
  const handleManagePreferences = () => {
    document.cookie =
      "birthreminder-cookie-consent=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
    window.location.reload();
  };

  return (
    <div className="legal-page-container" lang="en">
      <div className="legal-page-content">
        <Link to="/home" className="back-link">
          ← Back to home
        </Link>
        <LegalLanguageSwitch path="cookies" lang="en" />

        <h1>🍪 Cookie Policy</h1>
        <p className="intro">
          This page explains how BirthReminder uses cookies and similar
          technologies to improve your experience.
        </p>

        <section>
          <h2>What is a cookie?</h2>
          <p>
            A cookie is a small text file stored on your device when you visit
            a website. It lets the website remember your actions and
            preferences over a period of time.
          </p>
        </section>

        <section>
          <h2>Which cookies do we use?</h2>

          <div className="cookie-category">
            <h3>1. Strictly necessary cookies (required)</h3>
            <p>
              These cookies are essential for the website to work. Without
              them, some features cannot work.
            </p>
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Purpose</th>
                  <th>Duration</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>
                    <code>authToken</code>
                  </td>
                  <td>Authentication and user session</td>
                  <td>7 days</td>
                </tr>
                <tr>
                  <td>
                    <code>birthreminder-cookie-consent</code>
                  </td>
                  <td>Remembering your cookie choices</td>
                  <td>1 year</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="cookie-category">
            <h3>2. Analytics cookies (optional)</h3>
            <p>
              They help us understand how you use the website so we can
              improve it (pages visited, time spent, etc.).
            </p>
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Purpose</th>
                  <th>Duration</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>
                    <code>ph_*_posthog</code>
                  </td>
                  <td>
                    PostHog: audience measurement and usage analysis (pages
                    visited, journeys, interactions)
                  </td>
                  <td>1 year</td>
                </tr>
              </tbody>
            </table>
            <p className="note">
              <strong>Note:</strong> We use{" "}
              <a
                href="https://posthog.com"
                target="_blank"
                rel="noopener noreferrer"
              >
                PostHog
              </a>
              , hosted in the European Union, to understand how the website is
              used and to improve it. These cookies are set{" "}
              <strong>only after you consent</strong> through the banner. The
              data is pseudonymised (a technical identifier, no name or email)
              and the content of form fields is never recorded.
            </p>
            <p className="note">
              <strong>What exactly this covers:</strong> the pages you view,
              your interactions with the interface (clicks, submitted forms)
              and{" "}
              <strong>
                a recording of your browsing session, which can be replayed
              </strong>{" "}
              by our team to understand a journey or a bug. What you type is
              masked in the recording, and the content of your messages is
              never involved: it is encrypted and does not go through this
              tool. If you are logged in, these measurements are linked to the
              technical identifier of your account, never to your name or
              email.
            </p>
            <p className="note">
              Refusing analytics cookies turns all of this off, including
              session recording. You can change your mind at any time from the
              cookie management banner.
            </p>
          </div>

          <div className="cookie-category">
            <h3>3. Functional cookies (optional)</h3>
            <p>
              They improve your experience by remembering your preferences and
              enabling some features.
            </p>
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Purpose</th>
                  <th>Duration</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>
                    <code>io</code>
                  </td>
                  <td>Socket.io: real time chat</td>
                  <td>Session</td>
                </tr>
                <tr>
                  <td>
                    <code>theme</code>
                  </td>
                  <td>Remembering your dark or light mode preference</td>
                  <td>1 year</td>
                </tr>
                <tr>
                  <td>
                    <code>cookie-preferences</code>
                  </td>
                  <td>Storing your detailed cookie preferences</td>
                  <td>1 year</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section>
          <h2>How to manage your cookies</h2>

          <h3>On BirthReminder</h3>
          <p>
            You can change your preferences at any time by clicking the button
            below:
          </p>

          <button
            onClick={handleManagePreferences}
            className="manage-cookies-btn"
          >
            🍪 Manage my cookie preferences
          </button>

          <h3>In the mobile app</h3>
          <p>
            The mobile app (iOS and Android) does not use cookies. It does store some information
            on your phone, in the secure area of the system: your login token,
            your private encryption key, your theme and your display
            preferences. These items are only used to make the app work, are
            not shared with any third party, and are erased when you log out
            or uninstall the app.
          </p>

          <h3>From your browser</h3>
          <p>
            You can also block or delete cookies in your browser settings:
          </p>
          <ul>
            <li>
              <strong>Chrome:</strong> Settings → Privacy and security →
              Cookies
            </li>
            <li>
              <strong>Firefox:</strong> Options → Privacy & Security → Cookies
            </li>
            <li>
              <strong>Safari:</strong> Preferences → Privacy → Cookies
            </li>
            <li>
              <strong>Edge:</strong> Settings → Cookies and site permissions
            </li>
          </ul>
        </section>

        <section>
          <h2>Retention period</h2>
          <p>
            Cookies are kept for the duration shown in the tables above. You
            can delete them at any time.
          </p>
        </section>

        <section>
          <h2>Updates to this policy</h2>
          <p>
            We may update this cookie policy to reflect changes in our
            practices. We encourage you to check it regularly.
          </p>
          <p className="last-update">
            <strong>Last updated:</strong> 6 October 2026
          </p>
        </section>

        <section>
          <h2>Contact</h2>
          <p>
            For any question about our use of cookies, contact us at:{" "}
            <a href="mailto:contact@birthreminder.com">
              contact@birthreminder.com
            </a>
          </p>
        </section>
      </div>
    </div>
  );
}
