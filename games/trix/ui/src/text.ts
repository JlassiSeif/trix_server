// Everything the Trix table says in words, in English, French and Arabic (R-TABLE-9). French and
// Arabic are first drafts for Seif to review. Contract names (DINERI, DAMET, …) are Trix's own
// words and stay as they are in every language.

import type { CardId, Contract, GameEvent, Seat } from "@games/trix";
import { list, ltr, plural, texts } from "@platform/ui";

export const CONTRACT_ORDER: Contract[] = ["dineri", "damet", "pli", "farcha", "ray", "general", "trix"];

const SUIT_SYMBOL: Record<string, string> = { h: "♥", c: "♣", d: "♦", s: "♠" };
export function cardLabel(id: CardId): string {
  const [rank, suit] = id.split("_") as [string, string];
  return `${rank.toUpperCase()}${SUIT_SYMBOL[suit]}`;
}

const C = (c: Contract) => c.toUpperCase();

export const T = texts({
  en: {
    seat: (n: number) => `Seat ${n}`,
    you: "You",
    /** One line per contract, from RULES.md §6. */
    rule: {
      dineri: "+10 per ♦ taken · all 8 ♦ = 150",
      damet: "+20 per queen taken",
      pli: "+10 per trick · all 8 tricks = 150",
      farcha: "+100 for the last trick",
      ray: "+100 for taking K♥ · 200 if declared",
      general: "All five at once · all 8 tricks = 0",
      trix: "Build from the jacks · 1st out −100, 2nd −50",
    } as Record<Contract, string>,
    multiplier: (contract: Contract, m: number, forced: boolean) => (contract === "trix" ? "no multiplier" : `×${m}${forced ? " (last pick)" : ""}`),
    ordinal: (n: number) => (n === 1 ? "1st" : n === 2 ? "2nd" : n === 3 ? "3rd" : `${n}th`),
    feed: {
      dealt: (no: number, who: string, you: boolean) => `Contract ${no}: new deal. ${who} ${you ? "pick" : "picks"} the contract.`,
      picked: (who: string, c: Contract, mult: string) => `${who} chose ${C(c)}${c === "trix" ? "" : ` (${mult} for the picker)`}.`,
      kingDeclared: (who: string) => `${who} declared the K♥: whoever takes it gets +200.`,
      trickWon: (who: string) => `${who} took the trick.`,
      passed: (who: string, you: boolean) => `${who} can't play and ${you ? "pass" : "passes"}.`,
      extraTurn: (who: string, you: boolean) => `${who} placed an ace and ${you ? "play" : "plays"} again.`,
      finished: (who: string, you: boolean, place: string, pts: string) => `${who} ${you ? "are" : "is"} out, ${place} (${pts}).`,
      scored: (c: Contract, parts: string[]) => `${C(c)} is over: ${parts.join(", ")}.`,
      gameOver: (losers: string[], many: boolean) => `Game over. ${losers.join(" and ")} ${many ? "lose" : "loses"}.`,
      peeked: "You looked at the last trick.",
      title: "What's happening",
      empty: "Moves and picks will show up here.",
    },
    toast: {
      chose: (who: string, c: Contract) => `${who} chose ${C(c)}`,
      declared: (who: string) => `${who} declared the K♥`,
      out: (who: string, you: boolean, place: string) => `${you ? "You are" : `${who} is`} out, ${place}`,
      ownerYou: "You are now the table owner",
      ownerOther: (name: string) => `${name} is now the table owner`,
    },
    scores: "Scores",
    declareKing: "Declare K♥",
    lastTrickButton: (n: number) => `Last trick (${n} left)`,
    play: (card: string) => `Play ${card}`,
    cantPlay: (card: string) => `${card} can't be played now`,
    offline: "Connection lost. Reconnecting…",
    rotate: "Turn your phone upright to play",
    rotateWhy: "The table needs the height.",
    backToTable: "Back to the table",
    badge: {
      contractNo: (n: number, max: number) => `Contract ${n} / ${max}`,
      pickedBy: (name: string) => `picked by ${name}`,
      declaredBy: (name: string) => `K♥ declared by ${name}`,
      picking: (name: string) => `${name} is picking`,
    },
    tag: {
      emptySeat: "Empty seat",
      youSuffix: " (you)",
      totalTitle: "Total score",
      pts: (n: number) => `${n} pts`,
      tricksTitle: "Tricks won this contract",
      tricks: (n: number) => `${n} trick${n === 1 ? "" : "s"}`,
      picker: "picker",
      out: (place: string) => `${place} out`,
    },
    turn: {
      yours: "Your turn",
      theirs: (name: string) => `${name} is playing…`,
      follow: (suit: string) => ` · follow ${suit} if you can`,
      stack: " · place a card on a stack",
    },
    choosing: (name: string) => `${name} is choosing a contract…`,
    picker: {
      title: "Choose your contract",
      trixDue: "Trix is due: it must be your 6th pick at the latest.",
      counts: (last: boolean) => `Your score in it counts ${last ? "×4 (your last pick)" : "×2"}. Trix is never multiplied.`,
      trixNext: " Trix is due by your next pick.",
      already: "already played",
      trixFirst: "trix first",
      needsJack: "needs a jack",
    },
    takes: (name: string, you: boolean) => `${name} ${you ? "take" : "takes"} it`,
    notStarted: "not started",
    peek: { title: "Last trick", legend: "★ took the trick · click to close" },
    summary: {
      over: (c: Contract) => `${C(c)} is over`,
      player: "Player",
      points: "Points",
      counted: "Counted",
      total: "Total",
      pickerX: (m: number) => `picker ×${m}`,
      declaredPenalty: "declared K♥: −50",
      out: (place: string) => `${place} out`,
      reset: "hit exactly 1000: back to 0!",
      continue: "Continue",
      waiting: "Waiting…",
      nextDeal: (secs: number, waiting: string[]) => `Next deal in ${secs}s${waiting.length ? ` · waiting for ${waiting.join(", ")}` : ""}`,
      youLower: "you",
    },
    over: {
      overLimit: "Someone went over 1000.",
      allPlayed: "All 28 contracts have been played.",
      lose: (names: string, many: boolean) => `${names} ${many ? "lose" : "loses"}`,
      points: (n: number) => `${n} points`,
      winners: (many: boolean): string => (many ? "Winners" : "Winner"),
      ready: (n: number, names: string) => `Ready: ${n}/4 (${names})`,
      nobody: "nobody yet",
      playAgain: "Play again",
      waitingOthers: "Waiting for the others…",
    },
    paused: {
      title: "Game paused",
      waitingFor: (names: string) => `Waiting for ${names}.`,
      emptySeat: (n: number) => `seat ${n} (empty)`,
      newLink: "Send this new link to whoever should take the empty seat:",
      playOn: "Play on with a bot",
      end: "End the game",
      ownerCan: "The table owner can continue with a bot or end the game.",
    },
    board: {
      title: "Leaderboard",
      legend: "Lowest score leads. Over 1000 and you're out; exactly 1000 resets to 0.",
      tied: (n: number) => `tied for ${n}`,
      up: (n: number) => `up ${n}`,
      down: (n: number) => `down ${n}`,
      owner: "Table owner",
      empty: "Empty",
      makeOwner: (name: string) => `Make ${name} the table owner`,
      remove: (name: string) => `Remove ${name}`,
      contract: (c: Contract, used: boolean) => `${C(c)}: ${used ? "already picked" : "still to pick"}`,
    },
  },
  fr: {
    seat: (n: number) => `Place ${n}`,
    you: "Vous",
    rule: {
      dineri: "+10 par ♦ pris · les 8 ♦ = 150",
      damet: "+20 par dame prise",
      pli: "+10 par pli · les 8 plis = 150",
      farcha: "+100 pour le dernier pli",
      ray: "+100 pour qui prend le K♥ · 200 s'il est annoncé",
      general: "Les cinq à la fois · les 8 plis = 0",
      trix: "On construit à partir des valets · 1er sorti −100, 2e −50",
    } as Record<Contract, string>,
    multiplier: (contract: Contract, m: number, forced: boolean) => (contract === "trix" ? "sans multiplicateur" : `×${m}${forced ? " (dernier choix)" : ""}`),
    ordinal: (n: number) => (n === 1 ? "1er" : `${n}e`),
    feed: {
      dealt: (no: number, who: string, you: boolean) => `Contrat ${no} : nouvelle donne. ${who} ${you ? "choisissez" : "choisit"} le contrat.`,
      picked: (who: string, c: Contract, mult: string) => `${who} ${who === "Vous" ? "avez" : "a"} choisi ${C(c)}${c === "trix" ? "" : ` (${mult} pour qui l'a choisi)`}.`,
      kingDeclared: (who: string) => `${who} ${who === "Vous" ? "avez" : "a"} annoncé le K♥ : qui le prend reçoit +200.`,
      trickWon: (who: string) => `${who} ${who === "Vous" ? "remportez" : "remporte"} le pli.`,
      passed: (who: string, you: boolean) => `${who} ne ${you ? "pouvez" : "peut"} pas jouer et ${you ? "passez" : "passe"}.`,
      extraTurn: (who: string, you: boolean) => `${who} ${you ? "avez" : "a"} posé un as et ${you ? "rejouez" : "rejoue"}.`,
      finished: (who: string, you: boolean, place: string, pts: string) => `${who} ${you ? "êtes" : "est"} sorti, ${place} (${pts}).`,
      scored: (c: Contract, parts: string[]) => `${C(c)} est terminé : ${parts.join(", ")}.`,
      gameOver: (losers: string[], many: boolean) => `Partie terminée. ${list("fr", losers)} ${many ? "perdent" : losers[0] === "Vous" ? "perdez" : "perd"}.`,
      peeked: "Vous avez regardé le dernier pli.",
      title: "Ce qui se passe",
      empty: "Les coups et les choix s'afficheront ici.",
    },
    toast: {
      chose: (who: string, c: Contract) => `${who} ${who === "Vous" ? "avez" : "a"} choisi ${C(c)}`,
      declared: (who: string) => `${who} ${who === "Vous" ? "avez" : "a"} annoncé le K♥`,
      out: (who: string, you: boolean, place: string) => `${you ? "Vous êtes" : `${who} est`} sorti, ${place}`,
      ownerYou: "Vous êtes maintenant l'hôte de la table",
      ownerOther: (name: string) => `${name} est maintenant l'hôte de la table`,
    },
    scores: "Scores",
    declareKing: "Annoncer le K♥",
    lastTrickButton: (n: number) => `Dernier pli (encore ${n})`,
    play: (card: string) => `Jouer ${card}`,
    cantPlay: (card: string) => `${card} ne peut pas être joué maintenant`,
    offline: "Connexion perdue. Reconnexion…",
    rotate: "Tournez votre téléphone à la verticale pour jouer",
    rotateWhy: "La table a besoin de hauteur.",
    backToTable: "Retour à la table",
    badge: {
      contractNo: (n: number, max: number) => `Contrat ${n} / ${max}`,
      pickedBy: (name: string) => `choisi par ${name}`,
      declaredBy: (name: string) => `K♥ annoncé par ${name}`,
      picking: (name: string) => `${name} choisit`,
    },
    tag: {
      emptySeat: "Place libre",
      youSuffix: " (vous)",
      totalTitle: "Score total",
      pts: (n: number) => `${n} pts`,
      tricksTitle: "Plis remportés dans ce contrat",
      tricks: (n: number) => `${n} pli${n > 1 ? "s" : ""}`,
      picker: "a choisi",
      out: (place: string) => `sorti ${place}`,
    },
    turn: {
      yours: "À vous de jouer",
      theirs: (name: string) => `${name} joue…`,
      follow: (suit: string) => ` · fournissez ${suit} si possible`,
      stack: " · posez une carte sur une pile",
    },
    choosing: (name: string) => `${name} choisit un contrat…`,
    picker: {
      title: "Choisissez votre contrat",
      trixDue: "Trix est dû : ce doit être votre 6e choix au plus tard.",
      counts: (last: boolean) => `Votre score y compte ${last ? "×4 (votre dernier choix)" : "×2"}. Trix n'est jamais multiplié.`,
      trixNext: " Trix est dû à votre prochain choix.",
      already: "déjà joué",
      trixFirst: "trix d'abord",
      needsJack: "il faut un valet",
    },
    takes: (name: string, you: boolean) => `${name} ${you ? "remportez" : "remporte"} le pli`,
    notStarted: "pas commencée",
    peek: { title: "Dernier pli", legend: "★ a remporté le pli · touchez pour fermer" },
    summary: {
      over: (c: Contract) => `${C(c)} est terminé`,
      player: "Joueur",
      points: "Points",
      counted: "Comptés",
      total: "Total",
      pickerX: (m: number) => `a choisi ×${m}`,
      declaredPenalty: "a annoncé le K♥ : −50",
      out: (place: string) => `sorti ${place}`,
      reset: "pile 1000 : retour à 0 !",
      continue: "Continuer",
      waiting: "En attente…",
      nextDeal: (secs: number, waiting: string[]) => `Donne suivante dans ${secs} s${waiting.length ? ` · on attend ${list("fr", waiting)}` : ""}`,
      youLower: "vous",
    },
    over: {
      overLimit: "Quelqu'un a dépassé 1000.",
      allPlayed: "Les 28 contrats ont été joués.",
      lose: (names: string, many: boolean) => `${names} ${many ? "perdent" : names === "Vous" ? "perdez" : "perd"}`,
      points: (n: number) => `${n} points`,
      winners: (many: boolean) => (many ? "Gagnants" : "Gagnant"),
      ready: (n: number, names: string) => `Prêts : ${n}/4 (${names})`,
      nobody: "personne pour l'instant",
      playAgain: "Rejouer",
      waitingOthers: "On attend les autres…",
    },
    paused: {
      title: "Partie en pause",
      waitingFor: (names: string) => `On attend ${names}.`,
      emptySeat: (n: number) => `la place ${n} (libre)`,
      newLink: "Envoyez ce nouveau lien à la personne qui prendra la place libre :",
      playOn: "Continuer avec un bot",
      end: "Terminer la partie",
      ownerCan: "L'hôte de la table peut continuer avec un bot ou terminer la partie.",
    },
    board: {
      title: "Classement",
      legend: "Le plus petit score mène. Au-delà de 1000, on est éliminé ; pile 1000 revient à 0.",
      tied: (n: number) => `ex æquo ${n}e`,
      up: (n: number) => `+${n} place${n > 1 ? "s" : ""}`,
      down: (n: number) => `−${n} place${n > 1 ? "s" : ""}`,
      owner: "Hôte de la table",
      empty: "Libre",
      makeOwner: (name: string) => `Nommer ${name} hôte de la table`,
      remove: (name: string) => `Retirer ${name}`,
      contract: (c: Contract, used: boolean) => `${C(c)} : ${used ? "déjà choisi" : "reste à choisir"}`,
    },
  },
  ar: {
    seat: (n: number) => `المقعد ${n}`,
    you: "أنت",
    rule: {
      dineri: `${ltr("+10")} لكل ♦ مأخوذة · كل الـ8 ♦ = 150`,
      damet: `${ltr("+20")} لكل ملكة (Q) مأخوذة`,
      pli: `${ltr("+10")} لكل أكلة · كل الأكلات الـ8 = 150`,
      farcha: `${ltr("+100")} للأكلة الأخيرة`,
      ray: `${ltr("+100")} لمن يأخذ K♥ · و200 إن أُعلن`,
      general: "الخمسة معًا · كل الأكلات الـ8 = 0",
      trix: `البناء يبدأ من الشباب (J) · الأول ${ltr("−100")}، الثاني ${ltr("−50")}`,
    } as Record<Contract, string>,
    multiplier: (contract: Contract, m: number, forced: boolean) => (contract === "trix" ? "بلا مضاعفة" : `${ltr(`×${m}`)}${forced ? " (آخر اختيار)" : ""}`),
    ordinal: (n: number) => ["", "الأول", "الثاني", "الثالث", "الرابع"][n] ?? `الـ${n}`,
    feed: {
      dealt: (no: number, who: string, you: boolean) => `العقد ${no}: توزيع جديد. ${you ? "أنت تختار" : `${who} يختار`} العقد.`,
      picked: (who: string, c: Contract, mult: string) => `${who === "أنت" ? "اخترتَ" : `${who} اختار`} ${C(c)}${c === "trix" ? "" : ` (${mult} لمن اختاره)`}.`,
      kingDeclared: (who: string) => `${who === "أنت" ? "أعلنتَ" : `${who} أعلن`} K♥: من يأخذها يحصل على ${ltr("+200")}.`,
      trickWon: (who: string) => `${who === "أنت" ? "أخذتَ" : `${who} أخذ`} الأكلة.`,
      passed: (who: string, you: boolean) => (you ? "لا يمكنك اللعب فتمرّر." : `${who} لا يستطيع اللعب فيمرّر.`),
      extraTurn: (who: string, you: boolean) => (you ? "وضعتَ آسًا وتلعب مجددًا." : `${who} وضع آسًا ويلعب مجددًا.`),
      finished: (who: string, you: boolean, place: string, pts: string) => `${you ? "خرجتَ" : `${who} خرج`}، ${place} (${pts}).`,
      scored: (c: Contract, parts: string[]) => `انتهى ${C(c)}: ${parts.join("، ")}.`,
      gameOver: (losers: string[]) => `انتهت اللعبة. ${list("ar", losers)} ${losers.length > 1 ? "خسروا" : losers[0] === "أنت" ? "خسرتَ" : "خسر"}.`,
      peeked: "نظرتَ إلى الأكلة الأخيرة.",
      title: "ما يجري",
      empty: "ستظهر هنا الحركات والاختيارات.",
    },
    toast: {
      chose: (who: string, c: Contract) => `${who === "أنت" ? "اخترتَ" : `${who} اختار`} ${C(c)}`,
      declared: (who: string) => `${who === "أنت" ? "أعلنتَ" : `${who} أعلن`} K♥`,
      out: (who: string, you: boolean, place: string) => `${you ? "خرجتَ" : `${who} خرج`}، ${place}`,
      ownerYou: "أصبحتَ صاحب الطاولة",
      ownerOther: (name: string) => `أصبح ${name} صاحب الطاولة`,
    },
    scores: "النقاط",
    declareKing: "أعلن K♥",
    lastTrickButton: (n: number) => `الأكلة الأخيرة (${plural("ar", n, { zero: "لم يبقَ شيء", one: "بقيت مرة", two: "بقيت مرتان", few: "بقيت # مرات", other: "بقيت # مرة" })})`,
    play: (card: string) => `العب ${card}`,
    cantPlay: (card: string) => `لا يمكن لعب ${card} الآن`,
    offline: "انقطع الاتصال. جارٍ إعادة الاتصال…",
    rotate: "أدر هاتفك عموديًا لتلعب",
    rotateWhy: "الطاولة تحتاج إلى الارتفاع.",
    backToTable: "العودة إلى الطاولة",
    badge: {
      contractNo: (n: number, max: number) => `العقد ${n} / ${max}`,
      pickedBy: (name: string) => `اختاره ${name}`,
      declaredBy: (name: string) => `أعلن ${name} K♥`,
      picking: (name: string) => `${name} يختار`,
    },
    tag: {
      emptySeat: "مقعد شاغر",
      youSuffix: " (أنت)",
      totalTitle: "مجموع النقاط",
      pts: (n: number) => `${n} نقطة`,
      tricksTitle: "الأكلات في هذا العقد",
      tricks: (n: number) => plural("ar", n, { zero: "لا أكلات", one: "أكلة", two: "أكلتان", few: "# أكلات", other: "# أكلة" }),
      picker: "المختار",
      out: (place: string) => `خرج ${place}`,
    },
    turn: {
      yours: "دورك",
      theirs: (name: string) => `${name} يلعب…`,
      follow: (suit: string) => ` · العب ${suit} إن استطعت`,
      stack: " · ضع ورقة على كومة",
    },
    choosing: (name: string) => `${name} يختار عقدًا…`,
    picker: {
      title: "اختر عقدك",
      trixDue: "حان وقت Trix: يجب أن يكون اختيارك السادس على الأكثر.",
      counts: (last: boolean) => `نقاطك فيه تُحسب ${last ? `${ltr("×4")} (آخر اختيار لك)` : ltr("×2")}. Trix لا يُضاعف أبدًا.`,
      trixNext: " يجب اختيار Trix في دورك القادم.",
      already: "لُعب من قبل",
      trixFirst: "Trix أولًا",
      needsJack: "يحتاج إلى J",
    },
    takes: (name: string, you: boolean) => (you ? "تأخذها أنت" : `${name} يأخذها`),
    notStarted: "لم تبدأ",
    peek: { title: "الأكلة الأخيرة", legend: "★ أخذ الأكلة · انقر للإغلاق" },
    summary: {
      over: (c: Contract) => `انتهى ${C(c)}`,
      player: "اللاعب",
      points: "النقاط",
      counted: "المحسوب",
      total: "المجموع",
      pickerX: (m: number) => `المختار ${ltr(`×${m}`)}`,
      declaredPenalty: `أعلن K♥: ${ltr("−50")}`,
      out: (place: string) => `خرج ${place}`,
      reset: "بلغ 1000 تمامًا: عاد إلى 0!",
      continue: "متابعة",
      waiting: "في الانتظار…",
      nextDeal: (secs: number, waiting: string[]) => `التوزيع التالي بعد ${secs} ث${waiting.length ? ` · في انتظار ${list("ar", waiting)}` : ""}`,
      youLower: "أنت",
    },
    over: {
      overLimit: "تجاوز أحدهم 1000.",
      allPlayed: "لُعبت العقود الـ28 كلها.",
      lose: (names: string, many: boolean) => `${names} ${many ? "خسروا" : names === "أنت" ? "خسرتَ" : "خسر"}`,
      points: (n: number) => `${n} نقطة`,
      winners: (many: boolean) => (many ? "الفائزون" : "الفائز"),
      ready: (n: number, names: string) => `جاهزون: ${n}/4 (${names})`,
      nobody: "لا أحد بعد",
      playAgain: "العب مجددًا",
      waitingOthers: "في انتظار الآخرين…",
    },
    paused: {
      title: "اللعبة متوقفة",
      waitingFor: (names: string) => `في انتظار ${names}.`,
      emptySeat: (n: number) => `المقعد ${n} (شاغر)`,
      newLink: "أرسل هذا الرابط الجديد لمن سيجلس في المقعد الشاغر:",
      playOn: "واصل مع روبوت",
      end: "أنهِ اللعبة",
      ownerCan: "يستطيع صاحب الطاولة المواصلة مع روبوت أو إنهاء اللعبة.",
    },
    board: {
      title: "الترتيب",
      legend: "الأقل نقاطًا في الصدارة. من يتجاوز 1000 يخرج، ومن يبلغ 1000 تمامًا يعود إلى 0.",
      tied: (n: number) => `متعادل في المركز ${n}`,
      up: (n: number) => `صعد ${n}`,
      down: (n: number) => `نزل ${n}`,
      owner: "صاحب الطاولة",
      empty: "شاغر",
      makeOwner: (name: string) => `اجعل ${name} صاحب الطاولة`,
      remove: (name: string) => `أزِل ${name}`,
      contract: (c: Contract, used: boolean) => `${C(c)}: ${used ? "اختير من قبل" : "لم يُختر بعد"}`,
    },
  },
});

export type TrixText = (typeof T)["en"];

/** A sentence for the activity feed, or null for events too small to mention. */
export function describe(t: TrixText, e: GameEvent, name: (s: Seat) => string, you: Seat): string | null {
  const who = (s: Seat) => (s === you ? t.you : name(s));
  switch (e.type) {
    case "dealt":
      return t.feed.dealt(e.contractNo, who(e.picker), e.picker === you);
    case "picked":
      return t.feed.picked(who(e.seat), e.contract, t.multiplier(e.contract, e.multiplier, e.forced));
    case "kingDeclared":
      return t.feed.kingDeclared(who(e.seat));
    case "trickWon":
      return t.feed.trickWon(who(e.seat));
    case "passed":
      return t.feed.passed(who(e.seat), e.seat === you);
    case "extraTurn":
      return t.feed.extraTurn(who(e.seat), e.seat === you);
    case "playerFinished":
      return t.feed.finished(who(e.seat), e.seat === you, t.ordinal(e.place), ltr(e.place === 1 ? "−100" : "−50"));
    case "contractScored":
      return t.feed.scored(
        e.result.contract,
        e.result.scores.map((sc, s) => `${name(s as Seat)} ${ltr(`${sc > 0 ? "+" : ""}${sc}`)}`),
      );
    case "gameOver": {
      const losers = e.standings.losers.map(who);
      return t.feed.gameOver(losers, losers.length > 1 || e.standings.losers[0] === you);
    }
    case "lastTrickShown":
      return t.feed.peeked;
    case "cardPlayed":
      return null;
  }
}
