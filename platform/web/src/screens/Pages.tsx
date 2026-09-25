// The plain pages: about, privacy, terms, and "no table here" (404). The first three are drafts
// for Seif to review before Dineri opens to everyone (TODO.md); they say so on the page.

import { texts, useText } from "@platform/ui";
import { Footer, TopBar } from "../brand";
import { T } from "../text";

interface Section {
  h?: string;
  p: string[];
}
type Doc = { title: string; updated: string; sections: Section[] };

const CONTACT = { en: "Contact: an address is coming soon.", fr: "Contact : une adresse arrive bientôt.", ar: "التواصل: سيُضاف عنوان قريبًا." };

const DOCS = texts<{ about: Doc; privacy: Doc; terms: Doc }>({
  en: {
    about: {
      title: "About Dineri",
      updated: "",
      sections: [
        { p: ["Dineri is a home for the card and table games played in Tunisian cafés and living rooms. Send your friends a link and you're at the same table, on a phone or a PC. Nobody around? Play against bots, from easy to hard."] },
        { p: ["Trix is the first game on the table. Chkobba, Rami and others are on their way."] },
        { p: ["Dineri is free to play. There is no betting and no real money, ever.", CONTACT.en] },
        { p: ["Trix's card faces come from GNOME Aisleriot, free software under the GPL (version 3 or later)."] },
      ],
    },
    privacy: {
      title: "Privacy",
      updated: "Draft of 25 September 2026",
      sections: [
        { h: "Playing as a guest", p: ["You don't need an account. When you sit at a table, the server keeps the name you typed and your seat for as long as the table exists. Tables are saved on our server so a restart doesn't end your game; a table nobody has touched for 6 hours is deleted.", "Your browser keeps your name, your seat keys and your language, so a refresh puts you back where you were. You can clear them by clearing this site's data in your browser."] },
        { h: "With an account", p: ["Accounts are optional. Sign-in is handled by Firebase Authentication (Google): it keeps your email address and, if you sign in with Google, your Google account's name and identifier.", "Our database (Google Cloud Firestore, in Frankfurt, Germany) keeps your profile: your name at the table, your language and the date you joined. Tables you sit at remember which account played each seat."] },
        { h: "What we don't do", p: ["No ads, no analytics, no tracking cookies. We don't sell or share your data."] },
        { h: "Server logs", p: ["The server writes short technical logs. Some warnings (for example when someone floods the server) include the connection's IP address, to protect the site. Logs are rotated and overwritten after a short time."] },
        { h: "Where it runs", p: ["Dineri runs on a server in Frankfurt, Germany (Oracle Cloud). Sign-in and the database are Google's (Firebase), in the European Union."] },
        { h: "Deleting your data", p: ["Your account page has a button that deletes your profile and your sign-in at once. Guests can clear this site's data in their browser.", CONTACT.en] },
      ],
    },
    terms: {
      title: "Terms",
      updated: "Draft of 25 September 2026",
      sections: [
        { h: "Free, and only for fun", p: ["Dineri is free. There is no betting, no prizes and no real money, and there never will be."] },
        { h: "Play fair, be kind", p: ["Pick a name you'd say out loud at a café table. Don't use Dineri to insult, threaten or harass anyone. The owner of a table can remove players from it, and we can close tables or remove names that break these rules."] },
        { h: "Accounts", p: ["An account is yours alone. You can delete it at any time from your account page."] },
        { h: "The service", p: ["Dineri is offered as it is. Games, bots and features may change, and a table can end if the server restarts or has a problem. We do our best to keep your game going."] },
        { p: [CONTACT.en] },
      ],
    },
  },
  fr: {
    about: {
      title: "À propos de Dineri",
      updated: "",
      sections: [
        { p: ["Dineri réunit les jeux de cartes et de société qu'on joue dans les cafés et les salons tunisiens. Envoyez un lien à vos amis et vous voilà à la même table, sur téléphone ou sur PC. Personne ? Jouez contre des bots, de facile à difficile."] },
        { p: ["Trix est le premier jeu sur la table. Chkobba, Rami et d'autres arrivent."] },
        { p: ["Dineri est gratuit. Aucun pari, aucun argent réel, jamais.", CONTACT.fr] },
        { p: ["Les faces des cartes de Trix viennent de GNOME Aisleriot, un logiciel libre sous licence GPL (version 3 ou ultérieure)."] },
      ],
    },
    privacy: {
      title: "Confidentialité",
      updated: "Brouillon du 25 septembre 2026",
      sections: [
        { h: "Jouer en invité", p: ["Pas besoin de compte. Quand vous vous asseyez à une table, le serveur garde le nom que vous avez saisi et votre place tant que la table existe. Les tables sont enregistrées sur notre serveur pour qu'un redémarrage n'interrompe pas la partie ; une table inactive depuis 6 heures est supprimée.", "Votre navigateur garde votre nom, vos clés de place et votre langue, pour qu'un rechargement vous remette à votre place. Vous pouvez les effacer en supprimant les données de ce site dans votre navigateur."] },
        { h: "Avec un compte", p: ["Les comptes sont facultatifs. La connexion est assurée par Firebase Authentication (Google) : elle garde votre adresse e-mail et, si vous vous connectez avec Google, le nom et l'identifiant de votre compte Google.", "Notre base de données (Google Cloud Firestore, à Francfort, Allemagne) garde votre profil : votre nom à la table, votre langue et votre date d'inscription. Les tables retiennent quel compte a joué chaque place."] },
        { h: "Ce que nous ne faisons pas", p: ["Pas de publicité, pas de mesure d'audience, pas de cookies de suivi. Nous ne vendons ni ne partageons vos données."] },
        { h: "Journaux du serveur", p: ["Le serveur écrit de courts journaux techniques. Certains avertissements (par exemple quand quelqu'un inonde le serveur) contiennent l'adresse IP de la connexion, pour protéger le site. Les journaux sont renouvelés et écrasés après peu de temps."] },
        { h: "Où tout cela tourne", p: ["Dineri tourne sur un serveur à Francfort, Allemagne (Oracle Cloud). La connexion et la base de données sont celles de Google (Firebase), dans l'Union européenne."] },
        { h: "Supprimer vos données", p: ["Votre page de compte a un bouton qui supprime à la fois votre profil et votre connexion. Les invités peuvent effacer les données de ce site dans leur navigateur.", CONTACT.fr] },
      ],
    },
    terms: {
      title: "Conditions",
      updated: "Brouillon du 25 septembre 2026",
      sections: [
        { h: "Gratuit, et seulement pour le plaisir", p: ["Dineri est gratuit. Pas de paris, pas de lots, pas d'argent réel, et il n'y en aura jamais."] },
        { h: "Jouez franc jeu, restez courtois", p: ["Choisissez un nom que vous diriez à voix haute à une table de café. N'utilisez pas Dineri pour insulter, menacer ou harceler qui que ce soit. L'hôte d'une table peut en retirer des joueurs, et nous pouvons fermer des tables ou retirer des noms qui enfreignent ces règles."] },
        { h: "Comptes", p: ["Un compte n'appartient qu'à vous. Vous pouvez le supprimer à tout moment depuis votre page de compte."] },
        { h: "Le service", p: ["Dineri est proposé tel quel. Les jeux, les bots et les fonctions peuvent changer, et une table peut s'arrêter si le serveur redémarre ou rencontre un problème. Nous faisons de notre mieux pour que votre partie continue."] },
        { p: [CONTACT.fr] },
      ],
    },
  },
  ar: {
    about: {
      title: "عن Dineri",
      updated: "",
      sections: [
        { p: ["Dineri بيتٌ لألعاب الورق والطاولة التي تُلعب في المقاهي والبيوت التونسية. أرسل رابطًا لأصدقائك فتجلسون إلى الطاولة نفسها، من الهاتف أو الحاسوب. لا أحد متاح؟ العب ضد الروبوتات، من السهل إلى الصعب."] },
        { p: ["Trix أول لعبة على الطاولة، وChkobba وRami وغيرها في الطريق."] },
        { p: ["Dineri مجاني. لا رهان ولا مال حقيقي، أبدًا.", CONTACT.ar] },
        { p: ["وجوه أوراق Trix مأخوذة من GNOME Aisleriot، وهو برنامج حر برخصة GPL (الإصدار 3 أو أحدث)."] },
      ],
    },
    privacy: {
      title: "الخصوصية",
      updated: "مسودة 25 سبتمبر 2026",
      sections: [
        { h: "اللعب كضيف", p: ["لا تحتاج إلى حساب. عندما تجلس إلى طاولة، يحتفظ الخادم بالاسم الذي كتبته وبمقعدك ما دامت الطاولة قائمة. تُحفظ الطاولات على خادمنا حتى لا تنتهي لعبتك إذا أُعيد تشغيله؛ وتُحذف الطاولة التي لم يلمسها أحد منذ 6 ساعات.", "يحتفظ متصفحك باسمك ومفاتيح مقعدك ولغتك، لتعود إلى مكانك بعد إعادة التحميل. يمكنك مسحها بمسح بيانات هذا الموقع في متصفحك."] },
        { h: "مع حساب", p: ["الحسابات اختيارية. تتولى Firebase Authentication (من Google) تسجيل الدخول: تحتفظ ببريدك الإلكتروني، وإن دخلت عبر Google فباسم حسابك في Google ومعرّفه.", "تحتفظ قاعدة بياناتنا (Google Cloud Firestore في فرانكفورت، ألمانيا) بملفك الشخصي: اسمك على الطاولة ولغتك وتاريخ انضمامك. وتتذكر الطاولات أيّ حساب لعب في كل مقعد."] },
        { h: "ما لا نفعله", p: ["لا إعلانات ولا قياس للزيارات ولا ملفات تتبّع. لا نبيع بياناتك ولا نشاركها."] },
        { h: "سجلات الخادم", p: ["يكتب الخادم سجلات تقنية قصيرة. بعض التحذيرات (مثلًا حين يُغرق أحدٌ الخادم بالرسائل) تتضمن عنوان IP للاتصال، لحماية الموقع. وتُستبدل السجلات ويُكتب فوقها بعد وقت قصير."] },
        { h: "أين يعمل الموقع", p: ["يعمل Dineri على خادم في فرانكفورت، ألمانيا (Oracle Cloud). أما تسجيل الدخول وقاعدة البيانات فمن Google (Firebase)، داخل الاتحاد الأوروبي."] },
        { h: "حذف بياناتك", p: ["في صفحة حسابك زرّ يحذف ملفك الشخصي وتسجيل دخولك معًا. ويمكن للضيوف مسح بيانات هذا الموقع في متصفحهم.", CONTACT.ar] },
      ],
    },
    terms: {
      title: "الشروط",
      updated: "مسودة 25 سبتمبر 2026",
      sections: [
        { h: "مجاني، وللمتعة فقط", p: ["Dineri مجاني. لا رهان ولا جوائز ولا مال حقيقي، ولن يكون ذلك أبدًا."] },
        { h: "العب بنزاهة وكن لطيفًا", p: ["اختر اسمًا تقوله بصوت عالٍ على طاولة في مقهى. لا تستعمل Dineri لإهانة أحد أو تهديده أو مضايقته. يستطيع صاحب الطاولة إزالة اللاعبين منها، ونستطيع إغلاق الطاولات أو إزالة الأسماء التي تخالف هذه القواعد."] },
        { h: "الحسابات", p: ["الحساب لك وحدك. يمكنك حذفه في أي وقت من صفحة حسابك."] },
        { h: "الخدمة", p: ["يُقدَّم Dineri كما هو. قد تتغير الألعاب والروبوتات والميزات، وقد تنتهي طاولة إذا أُعيد تشغيل الخادم أو واجه مشكلة. نبذل جهدنا لتستمر لعبتك."] },
        { p: [CONTACT.ar] },
      ],
    },
  },
});

export function DocPage({ which, go }: { which: "about" | "privacy" | "terms"; go: (path: string) => void }) {
  const t = useText(T);
  const doc = useText(DOCS)[which];
  return (
    <div className="hub entry">
      <TopBar go={go} back />
      <main className="page doc">
        {which !== "about" && <p className="draft">{t.draft}</p>}
        <h1>{doc.title}</h1>
        {doc.updated && <p className="hint">{doc.updated}</p>}
        {doc.sections.map((s, i) => (
          <section key={i}>
            {s.h && <h2>{s.h}</h2>}
            {s.p.map((p, j) => (
              <p key={j}>{p}</p>
            ))}
          </section>
        ))}
      </main>
      <Footer go={go} />
    </div>
  );
}

export function NotFound({ go }: { go: (path: string) => void }) {
  const t = useText(T);
  return (
    <div className="hub entry">
      <TopBar go={go} />
      <main className="plain not-found">
        <span className="card-back" aria-hidden>
          <span className="medallion" />
        </span>
        <h1>{t.notFound.title}</h1>
        <p className="lede">{t.notFound.lede}</p>
        <button className="primary" onClick={() => go("/")}>
          {t.notFound.back}
        </button>
      </main>
      <Footer go={go} />
    </div>
  );
}
