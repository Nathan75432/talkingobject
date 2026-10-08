import test from "node:test";
import assert from "node:assert/strict";
import { builtInReply, detectedObjects } from "../replies.js";
test("replies use the selected object and normalize natural punctuation", () => {
  assert.match(builtInReply("cup", "WHAT are you?!"), /I'm a cup.*drinks/);
  assert.match(builtInReply("cat", "Hello!"), /your cat/);
  assert.notEqual(
    builtInReply("dog", "Hello!"),
    builtInReply("dog", "Hello!", true),
  );
  assert.match(builtInReply("chair", "Something unexpected"), /place to sit/);
});
test("detections drop low confidence and retain best example of each class", () => {
  const predictions = [
    { class: "cat", score: 0.61 },
    { class: "dog", score: 0.99 },
    { class: "cat", score: 0.9 },
    { class: "cup", score: 0.59 },
  ];
  assert.deepEqual(detectedObjects(predictions), [
    predictions[1],
    predictions[2],
  ]);
  assert.deepEqual(detectedObjects([]), []);
});
