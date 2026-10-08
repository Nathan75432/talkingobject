export const samples = {
  cup: "☕",
  cat: "🐈",
  dog: "🐕",
  chair: "🪑",
  book: "📖",
  bottle: "🍶",
};
const facts = {
  cup: "I hold your favorite drinks. Tea, coffee, or hot chocolate?",
  cat: "I nap, explore, and keep a close eye on my humans.",
  dog: "I love walks, games, and spending time with my people.",
  chair: "I give you a place to sit and take a break.",
  book: "I carry stories and ideas, one page at a time.",
  bottle: "I keep drinks ready for your next adventure.",
};
export function builtInReply(object, message, playful = false) {
  const text = message
    .toLowerCase()
    .replace(/[^a-z0-9\s']/g, "")
    .trim();
  if (/\b(joke|funny|laugh)\b/.test(text))
    return `I'm a ${object} with a lot to say. My stand-up career is a little awkward… I usually just sit here!`;
  if (/\b(what|who)\b.*\b(you|do)\b/.test(text))
    return `I'm a ${object}. ${facts[object] || "I am one of the everyday things around you."}`;
  if (/\b(hi|hello|hey)\b/.test(text))
    return playful
      ? `Hey! Your ${object} has entered the chat. Try not to be starstruck.`
      : `Hello! I'm your ${object}. What would you like to know about me?`;
  if (/\b(thanks|thank)\b/.test(text))
    return `You're welcome! Your ${object} is happy to help.`;
  return playful
    ? `As a ${object}, I have strong opinions and absolutely no schedule. Ask what I do, or ask me for a joke!`
    : `I'm your ${object}. ${facts[object] || "I am an everyday object."} Try asking “What do you do?” or “Tell me a joke.”`;
}
export function detectedObjects(predictions) {
  const best = new Map();
  for (const prediction of predictions)
    if (
      prediction.score >= 0.6 &&
      (!best.has(prediction.class) ||
        best.get(prediction.class).score < prediction.score)
    )
      best.set(prediction.class, prediction);
  return [...best.values()].sort((a, b) => b.score - a.score);
}
