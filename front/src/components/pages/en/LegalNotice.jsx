// Version anglaise de ../MentionsLegales.jsx. Toute modification de l'une
// doit être reportée dans l'autre.
import { Link } from "react-router-dom";
import LegalLanguageSwitch from "../LegalLanguageSwitch";
import "../css/legalPages.css";

export default function LegalNoticeEn() {
  return (
    <div className="legal-page-container" lang="en">
      <div className="legal-page-content">
        <Link to="/home" className="back-link">
          ← Back to home
        </Link>
        <LegalLanguageSwitch path="mentions-legales" lang="en" />

        <h1>⚖️ Legal Notice</h1>

        <section>
          <h2>Publisher</h2>
          <p>The BirthReminder website is published by:</p>
          <ul>
            <li>
              <strong>Name:</strong> Josse Filippi
            </li>
            <li>
              <strong>Status:</strong> Private individual (non-professional publisher)
            </li>
            <li>
              <strong>Address:</strong> Paris, France
            </li>
            <li>
              <strong>Email:</strong>{" "}
              <a href="mailto:contact@birthreminder.com">
                contact@birthreminder.com
              </a>
            </li>
          </ul>
        </section>

        <section>
          <h2>Publication director</h2>
          <p>
            The publication director of the website is{" "}
            <strong>Josse Filippi</strong>.
          </p>
        </section>

        <section>
          <h2>Hosting</h2>
          <p>The BirthReminder website is hosted by:</p>
          <ul>
            <li>
              <strong>Host:</strong> Amazon Web Services (AWS)
            </li>
            <li>
              <strong>Company name:</strong> Amazon Web Services EMEA SARL
            </li>
            <li>
              <strong>Address:</strong> 38 Avenue John F. Kennedy, L-1855,
              Luxembourg
            </li>
            <li>
              <strong>Website:</strong>{" "}
              <a
                href="https://aws.amazon.com"
                target="_blank"
                rel="noopener noreferrer"
              >
                aws.amazon.com
              </a>
            </li>
          </ul>
        </section>

        <section>
          <h2>Intellectual property</h2>
          <p>
            All content on this website (texts, images, logos, source code) is
            the exclusive property of Josse Filippi, unless stated otherwise.
          </p>
          <p>
            Any reproduction, distribution, modification or use of these
            elements without prior permission is strictly forbidden and
            constitutes an infringement punishable under the French
            Intellectual Property Code.
          </p>
        </section>

        <section>
          <h2>Personal data protection</h2>
          <p>
            The information collected on this website is processed
            electronically in order to manage birthdays and friendships.
          </p>
          <p>
            In accordance with the General Data Protection Regulation (GDPR)
            and the French Data Protection Act, you have the right to access,
            rectify, object to, erase, restrict and port your data.
          </p>
          <p>
            To exercise these rights, see our{" "}
            <Link to="/en/privacy">Privacy Policy</Link> or contact us at{" "}
            <a href="mailto:privacy@birthreminder.com">
              privacy@birthreminder.com
            </a>
            .
          </p>
        </section>

        <section>
          <h2>Cookies</h2>
          <p>
            This website uses cookies to improve your experience. To find out
            more, see our <Link to="/en/cookies">Cookie Policy</Link>.
          </p>
        </section>

        <section>
          <h2>Liability</h2>
          <p>
            We do our best to provide accurate and up to date information.
            However, we cannot guarantee the accuracy, completeness or
            relevance of the information published on the website.
          </p>
          <p>
            You use the information and content available on the website
            entirely at your own risk.
          </p>
        </section>

        <section>
          <h2>Disputes</h2>
          <p>
            This legal notice is governed by French law. In the event of a
            dispute, the French courts shall have sole jurisdiction.
          </p>
        </section>

        <section>
          <h2>Contact</h2>
          <p>For any question about this legal notice, you can contact us at:</p>
          <ul>
            <li>
              <strong>Email:</strong>{" "}
              <a href="mailto:contact@birthreminder.com">
                contact@birthreminder.com
              </a>
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
