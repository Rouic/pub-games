import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy — Pub Games",
};

export default function PrivacyPage() {
  return (
    <div className="page">
      <div
        style={{
          maxWidth: 640,
          margin: "0 auto",
          padding: "3rem 1.5rem",
          color: "var(--text)",
          lineHeight: 1.7,
        }}
      >
        <a
          href="/"
          style={{
            color: "var(--text-muted)",
            textDecoration: "none",
            fontSize: "0.85rem",
            display: "inline-flex",
            alignItems: "center",
            gap: "0.3rem",
            marginBottom: "1.5rem",
          }}
        >
          &larr; Back to games
        </a>

        <h1
          style={{
            fontSize: "1.8rem",
            fontWeight: 700,
            marginBottom: "0.5rem",
            color: "#fff",
          }}
        >
          Privacy
        </h1>
        <p style={{ color: "var(--text-muted)", marginBottom: "2rem" }}>
          Last updated: April 2026
        </p>

        <section style={{ marginBottom: "2rem" }}>
          <h2
            style={{
              fontSize: "1.1rem",
              fontWeight: 600,
              color: "#fff",
              marginBottom: "0.5rem",
            }}
          >
            What we collect
          </h2>
          <p>
            When you create or join a game, we generate a random anonymous
            identity (e.g. &ldquo;Sneaky Fox&rdquo;) and store it in a cookie
            on your device. No real name, email address, IP address, or
            location data is collected.
          </p>
          <p style={{ marginTop: "0.75rem" }}>We store:</p>
          <ul
            style={{
              paddingLeft: "1.25rem",
              marginTop: "0.5rem",
              listStyleType: "disc",
            }}
          >
            <li>A randomly generated player ID and display name</li>
            <li>Win/loss/game count statistics</li>
            <li>Temporary game room state (deleted when the game ends)</li>
          </ul>
        </section>

        <section style={{ marginBottom: "2rem" }}>
          <h2
            style={{
              fontSize: "1.1rem",
              fontWeight: 600,
              color: "#fff",
              marginBottom: "0.5rem",
            }}
          >
            Cookies
          </h2>
          <p>
            We use a single <strong>strictly functional cookie</strong>{" "}
            (<code style={{ color: "var(--neon-green)" }}>pub_player_id</code>)
            to remember your anonymous identity between sessions. It is set
            only when you actively create or join a game &mdash; not on your
            first visit. It expires after 90 days.
          </p>
          <p style={{ marginTop: "0.75rem" }}>
            We do not use any analytics, tracking, or advertising cookies.
          </p>
        </section>

        <section style={{ marginBottom: "2rem" }}>
          <h2
            style={{
              fontSize: "1.1rem",
              fontWeight: 600,
              color: "#fff",
              marginBottom: "0.5rem",
            }}
          >
            Your rights
          </h2>
          <p>You can delete all your data at any time:</p>
          <ul
            style={{
              paddingLeft: "1.25rem",
              marginTop: "0.5rem",
              listStyleType: "disc",
            }}
          >
            <li>
              Tap <strong>&ldquo;Forget me&rdquo;</strong> on the landing page
              to permanently delete your player record, game history, and
              cookie
            </li>
            <li>
              Or simply clear your browser cookies &mdash; without the cookie,
              the anonymous record is orphaned and will be cleaned up
            </li>
          </ul>
        </section>

        <section style={{ marginBottom: "2rem" }}>
          <h2
            style={{
              fontSize: "1.1rem",
              fontWeight: 600,
              color: "#fff",
              marginBottom: "0.5rem",
            }}
          >
            Data storage
          </h2>
          <p>
            Data is stored in a PostgreSQL database hosted on our own
            infrastructure (OVH, UK). It is not shared with any third party.
            Game room data is ephemeral and automatically expires.
          </p>
        </section>

        <section>
          <h2
            style={{
              fontSize: "1.1rem",
              fontWeight: 600,
              color: "#fff",
              marginBottom: "0.5rem",
            }}
          >
            Contact
          </h2>
          <p>
            This is a demo project by{" "}
            <a
              href="https://rouic.com"
              target="_blank"
              rel="noopener"
              style={{ color: "var(--neon-green)", textDecoration: "none" }}
            >
              Rouic
            </a>
            . For any privacy questions, contact{" "}
            <a
              href="mailto:alex@rouic.com"
              style={{ color: "var(--neon-green)", textDecoration: "none" }}
            >
              alex@rouic.com
            </a>
            .
          </p>
        </section>
      </div>
    </div>
  );
}
