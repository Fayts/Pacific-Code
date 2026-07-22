// Tests des briques pures de l'intégration e-mail : state OAuth signé,
// analyse des expéditeurs, extraction des corps de message, MIME de réponse.

import { beforeAll, describe, expect, it } from "vitest";
import {
  buildGmailReplyMime,
  extractGmailBody,
  htmlToText,
  isAutomatedEmail,
  parseFromHeader,
  signEmailOauthState,
  verifyEmailOauthState,
} from "@/lib/email/server";

const ORG = "11111111-2222-4333-8444-555555555555";

beforeAll(() => {
  process.env.WEBHOOK_INGEST_SECRET = "secret-de-test";
});

describe("state OAuth signé", () => {
  it("fait l'aller-retour organisation + fournisseur", () => {
    const state = signEmailOauthState(ORG, "gmail");
    expect(verifyEmailOauthState(state)).toEqual({
      orgId: ORG,
      provider: "gmail",
    });
  });

  it("rejette un state altéré ou invalide", () => {
    const state = signEmailOauthState(ORG, "outlook");
    const tampered = Buffer.from(
      Buffer.from(state, "base64url")
        .toString("utf8")
        .replace("outlook", "gmail_"),
      "utf8"
    ).toString("base64url");
    expect(verifyEmailOauthState(tampered)).toBeNull();
    expect(verifyEmailOauthState("n-importe-quoi")).toBeNull();
    expect(verifyEmailOauthState("")).toBeNull();
  });
});

describe("parseFromHeader", () => {
  it("sépare nom et adresse", () => {
    expect(parseFromHeader('"Moana Tehani" <moana@mail.pf>')).toEqual({
      name: "Moana Tehani",
      email: "moana@mail.pf",
    });
    expect(parseFromHeader("Jean <Jean.DUPONT@Gmail.com>")).toEqual({
      name: "Jean",
      email: "jean.dupont@gmail.com",
    });
  });

  it("accepte une adresse nue", () => {
    expect(parseFromHeader("client@mail.pf")).toEqual({
      name: "",
      email: "client@mail.pf",
    });
  });
});

describe("htmlToText", () => {
  it("dégrade le HTML en texte lisible", () => {
    const text = htmlToText(
      "<div><p>Bonjour,</p><p>Le Kärcher est-il libre &agrave; No&euml;l ?<br>Merci &amp; à bientôt</p><style>p{color:red}</style></div>"
    );
    expect(text).toContain("Bonjour,");
    expect(text).toContain("Merci & à bientôt");
    expect(text).not.toContain("<p>");
    expect(text).not.toContain("color:red");
  });
});

describe("extractGmailBody", () => {
  const b64 = (value: string) =>
    Buffer.from(value, "utf8").toString("base64url");

  it("préfère la partie text/plain, même imbriquée", () => {
    expect(
      extractGmailBody({
        mimeType: "multipart/alternative",
        parts: [
          {
            mimeType: "multipart/related",
            parts: [
              { mimeType: "text/plain", body: { data: b64("Bonjour en texte") } },
            ],
          },
          { mimeType: "text/html", body: { data: b64("<b>Bonjour</b>") } },
        ],
      })
    ).toBe("Bonjour en texte");
  });

  it("retombe sur le HTML dégradé puis sur le corps direct", () => {
    expect(
      extractGmailBody({
        mimeType: "multipart/alternative",
        parts: [
          { mimeType: "text/html", body: { data: b64("<p>Salut HTML</p>") } },
        ],
      })
    ).toBe("Salut HTML");
    expect(
      extractGmailBody({ mimeType: "text/plain", body: { data: b64("Direct") } })
    ).toBe("Direct");
    expect(extractGmailBody(undefined)).toBe("");
  });
});

describe("isAutomatedEmail", () => {
  it("écarte les expéditeurs machine", () => {
    for (const email of [
      "noreply@spartoo.com",
      "no-reply@higgsfield.ai",
      "donotreply@banque.pf",
      "newsletter@tripo.ai",
      "notifications@facebook.com",
      "mailer-daemon@googlemail.com",
      "marketing+promo@boutique.com",
    ]) {
      expect(isAutomatedEmail({ fromEmail: email })).toBe(true);
    }
  });

  it("écarte l'envoi en masse via les en-têtes", () => {
    expect(
      isAutomatedEmail({
        fromEmail: "team@startup.io",
        listUnsubscribe: "<https://startup.io/unsub>",
      })
    ).toBe(true);
    expect(
      isAutomatedEmail({ fromEmail: "hello@app.com", precedence: "bulk" })
    ).toBe(true);
    expect(
      isAutomatedEmail({
        fromEmail: "hello@app.com",
        autoSubmitted: "auto-generated",
      })
    ).toBe(true);
    expect(
      isAutomatedEmail({ fromEmail: "client@mail.pf", autoSubmitted: "no" })
    ).toBe(false);
  });

  it("écarte les catégories Gmail Promotions / Réseaux sociaux / Forums", () => {
    expect(
      isAutomatedEmail({
        fromEmail: "enzo@spartoo.com",
        gmailLabelIds: ["INBOX", "CATEGORY_PROMOTIONS"],
      })
    ).toBe(true);
    expect(
      isAutomatedEmail({
        fromEmail: "client@mail.pf",
        gmailLabelIds: ["INBOX", "CATEGORY_PERSONAL"],
      })
    ).toBe(false);
  });

  it("laisse passer les vrais clients, y compris info@ et contact@", () => {
    for (const email of [
      "moana.tehani@gmail.com",
      "client@mail.pf",
      "info@pension-fare.pf",
      "contact@tahiti-tours.com",
    ]) {
      expect(isAutomatedEmail({ fromEmail: email })).toBe(false);
    }
  });
});

describe("buildGmailReplyMime", () => {
  it("construit une réponse threadée avec sujet Re:", () => {
    const mime = buildGmailReplyMime({
      to: "client@mail.pf",
      subject: "Location scooter",
      body: "C'est disponible !",
      inReplyTo: "<abc123@mail.gmail.com>",
    });
    expect(mime).toContain("To: client@mail.pf");
    expect(mime).toContain("Subject: Re: Location scooter");
    expect(mime).toContain("In-Reply-To: <abc123@mail.gmail.com>");
    expect(mime).toContain("References: <abc123@mail.gmail.com>");
    const bodyB64 = mime.split("\r\n\r\n")[1];
    expect(Buffer.from(bodyB64, "base64").toString("utf8")).toBe(
      "C'est disponible !"
    );
  });

  it("ne double pas le préfixe Re: et encode les sujets accentués", () => {
    expect(
      buildGmailReplyMime({ to: "a@b.pf", subject: "RE: Déjà répondu", body: "x" })
    ).toContain("Subject: =?UTF-8?B?");
    const ascii = buildGmailReplyMime({
      to: "a@b.pf",
      subject: "Re: Simple",
      body: "x",
    });
    expect(ascii).toContain("Subject: Re: Simple");
    const empty = buildGmailReplyMime({ to: "a@b.pf", subject: "  ", body: "x" });
    expect(empty).toContain("Subject: Re: votre message");
  });
});
