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

describe("isAutomatedEmail (filtre anti-bruit)", () => {
  const noHeaders = () => "";
  const headers = (map: Record<string, string>) => (name: string) =>
    map[
      Object.keys(map).find((k) => k.toLowerCase() === name.toLowerCase()) ?? ""
    ] ?? "";

  it("écarte les adresses jamais humaines", () => {
    for (const email of [
      "noreply@distrokid.com",
      "no-reply@accounts.google.com",
      "no_reply@service.fr",
      "do-not-reply@bank.pf",
      "notifications@github.com",
      "notification@facebook.com",
      "newsletter@shop.com",
      "news@ngrok.com",
      "mailer-daemon@googlemail.com",
      "marketing@uber.com",
      "updates@linkedin.com",
      "alerts@site.io",
    ]) {
      expect(isAutomatedEmail(email, noHeaders), email).toBe(true);
    }
  });

  it("laisse passer les expéditeurs humains sans en-tête automatique", () => {
    for (const email of [
      "jean.dupont@gmail.com",
      "contact@hotel-tiare.pf",
      "info@mairie-papeete.pf",
      "moana@hotmail.com",
      "replymaster@x.com", // contient « reply » mais pas en préfixe no-reply
    ]) {
      expect(isAutomatedEmail(email, noHeaders), email).toBe(false);
    }
  });

  it("écarte newsletters et promos via List-Unsubscribe", () => {
    expect(
      isAutomatedEmail(
        "offers@ubereats.com",
        headers({ "List-Unsubscribe": "<https://u.example/x>" })
      )
    ).toBe(true);
  });

  it("écarte les messages machine (Auto-Submitted, Precedence: bulk)", () => {
    expect(
      isAutomatedEmail(
        "verif@service.com",
        headers({ "Auto-Submitted": "auto-generated" })
      )
    ).toBe(true);
    expect(
      isAutomatedEmail("x@y.com", headers({ Precedence: "bulk" }))
    ).toBe(true);
    expect(
      isAutomatedEmail("x@y.com", headers({ "Feedback-ID" : "c:123:d" }))
    ).toBe(true);
  });

  it("Auto-Submitted: no n'est pas un motif d'exclusion", () => {
    expect(
      isAutomatedEmail("jean@gmail.com", headers({ "Auto-Submitted": "no" }))
    ).toBe(false);
  });
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
