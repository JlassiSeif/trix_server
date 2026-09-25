// What the server's refusals say, in the player's language. The server sends a code and an English
// message; the code picks the line here. Codes not listed (e.g. a game's own) show the server's words.

import { texts, useText } from "./i18n";

const T = texts({
  en: {
    ALREADY_SEATED: "You are already at this table.",
    BAD_INVITE: "This invite link is no longer valid. Ask the table owner for the new one.",
    BAD_NAME: "Pick a name (1 to 20 characters).",
    BAD_TOKEN: "That seat is no longer yours.",
    NAME_TAKEN: "Someone at this table already has that name. Pick another one.",
    NOT_ELIGIBLE: "Ownership can only go to another player who is at the table right now.",
    NOT_FULL: "Every seat must be filled first.",
    NOT_IN_LOBBY: "Bots can be added before the game starts.",
    NOT_OWNER: "Only the table owner can do that.",
    NOT_PLAYING: "The game is not running right now.",
    NOT_SEATED: "You are not seated at this table.",
    ROOM_FULL: "The table is full.",
    ROOM_NOT_FOUND: "This table doesn't exist any more.",
    SEAT_TAKEN: "That seat is taken.",
    SERVER_FULL: "There are too many tables right now. Try again in a little while.",
    TOO_MANY_ATTEMPTS: "Too many wrong links from your connection. Wait a few minutes and try again.",
    TOO_MANY_TABLES: "You already have several tables open. Close one first.",
    RATE_LIMITED: "Too many messages at once. Reload the page.",
    GAME_CLOSED: "This game is resting for a moment. Try again soon.",
  },
  fr: {
    ALREADY_SEATED: "Vous êtes déjà à cette table.",
    BAD_INVITE: "Ce lien d'invitation n'est plus valable. Demandez le nouveau à l'hôte de la table.",
    BAD_NAME: "Choisissez un nom (1 à 20 caractères).",
    BAD_TOKEN: "Cette place n'est plus la vôtre.",
    NAME_TAKEN: "Quelqu'un à cette table porte déjà ce nom. Choisissez-en un autre.",
    NOT_ELIGIBLE: "La table ne peut passer qu'à un autre joueur présent en ce moment.",
    NOT_FULL: "Toutes les places doivent d'abord être prises.",
    NOT_IN_LOBBY: "Les bots s'ajoutent avant le début de la partie.",
    NOT_OWNER: "Seul l'hôte de la table peut faire cela.",
    NOT_PLAYING: "La partie n'est pas en cours.",
    NOT_SEATED: "Vous n'êtes pas assis à cette table.",
    ROOM_FULL: "La table est complète.",
    ROOM_NOT_FOUND: "Cette table n'existe plus.",
    SEAT_TAKEN: "Cette place est prise.",
    SERVER_FULL: "Il y a trop de tables en ce moment. Réessayez un peu plus tard.",
    TOO_MANY_ATTEMPTS: "Trop de liens erronés depuis votre connexion. Attendez quelques minutes et réessayez.",
    TOO_MANY_TABLES: "Vous avez déjà plusieurs tables ouvertes. Fermez-en une d'abord.",
    RATE_LIMITED: "Trop de messages d'un coup. Rechargez la page.",
    GAME_CLOSED: "Ce jeu fait une petite pause. Réessayez bientôt.",
  },
  ar: {
    ALREADY_SEATED: "أنت جالس على هذه الطاولة بالفعل.",
    BAD_INVITE: "رابط الدعوة هذا لم يعد صالحًا. اطلب الرابط الجديد من صاحب الطاولة.",
    BAD_NAME: "اختر اسمًا (من 1 إلى 20 حرفًا).",
    BAD_TOKEN: "هذا المقعد لم يعد لك.",
    NAME_TAKEN: "هناك من يحمل هذا الاسم على الطاولة. اختر اسمًا آخر.",
    NOT_ELIGIBLE: "لا تنتقل ملكية الطاولة إلا إلى لاعب حاضر الآن.",
    NOT_FULL: "يجب أن تمتلئ كل المقاعد أولًا.",
    NOT_IN_LOBBY: "تُضاف الروبوتات قبل بدء اللعبة.",
    NOT_OWNER: "صاحب الطاولة وحده يستطيع ذلك.",
    NOT_PLAYING: "اللعبة ليست جارية الآن.",
    NOT_SEATED: "أنت لست جالسًا على هذه الطاولة.",
    ROOM_FULL: "الطاولة ممتلئة.",
    ROOM_NOT_FOUND: "هذه الطاولة لم تعد موجودة.",
    SEAT_TAKEN: "هذا المقعد محجوز.",
    SERVER_FULL: "هناك طاولات كثيرة الآن. حاول بعد قليل.",
    TOO_MANY_ATTEMPTS: "روابط خاطئة كثيرة من اتصالك. انتظر بضع دقائق ثم حاول مجددًا.",
    TOO_MANY_TABLES: "لديك عدة طاولات مفتوحة. أغلق واحدة أولًا.",
    RATE_LIMITED: "رسائل كثيرة دفعة واحدة. أعد تحميل الصفحة.",
    GAME_CLOSED: "هذه اللعبة في استراحة قصيرة. حاول قريبًا.",
  },
});

/** The line to show for a server refusal. */
export function useErrorText(): (e: { code: string; message: string }) => string {
  const t = useText(T) as Record<string, string>;
  return (e) => t[e.code] ?? e.message;
}
