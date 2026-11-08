// Question banks register here. Each content file (shared life core, shared health core, a
// state's own law) calls LHEP.bank(meta, fill). Question IDs are permanent: saved progress and
// links use them, so never reuse or renumber an ID. Add new questions with new IDs.
window.LHEP = {
  banks: [],
  bank(meta, fill) {
    const questions = [];
    const add = q => {
      if (questions.some(x => x.id === q.id)) throw new Error(`Duplicate question ID ${q.id}`);
      if (!meta.topics[q.topic]) throw new Error(`Question ${q.id} has unknown topic ${q.topic}`);
      if (q.src && !meta.sources[q.src]) throw new Error(`Question ${q.id} has unknown source ${q.src}`);
      questions.push(q);
    };
    fill({
      // multiple choice: answer is the letter of the right option
      mc: (id, topic, q, opts, ans, why, src) => add({ id, topic, type: "mc", q, opts, ans: "ABCD".indexOf(ans), why, src }),
      // true or false
      tf: (id, topic, q, ans, why, src) => add({ id, topic, type: "tf", q, opts: ["True", "False"], ans: ans ? 0 : 1, why, src }),
      // short answer, self-graded against the model answer
      sa: (id, topic, q, model, src) => add({ id, topic, type: "sa", q, model, src })
    });
    this.banks.push({ meta, questions });
  }
};
