// Mock exam blueprints for North Carolina, from the NC Department of Insurance content outlines
// (effective March 15, 2024). Each section draws its questions from the listed study guide topics,
// in the same numbers as the real exam. Only four-option multiple-choice questions are used.
// The real exams give 75 minutes for 60 questions, 5 of them unscored pretest questions. The mock
// gives 55 scored questions in 69 minutes, the same pace.
window.LHEP_MOCKS = {
  life: {
    name: "North Carolina Life Agent",
    short: "Life",
    minutes: 69,
    pass: 70,
    sections: [
      { name: "Types of individual life insurance", count: 17, topics: ["L4"] },
      { name: "Annuities", count: 5, topics: ["L7"] },
      { name: "Policy provisions, options and other features", count: 11, topics: ["L5"] },
      { name: "Other life topics", count: 8, topics: ["L1", "L2", "L3", "L6", "L8", "L9"] },
      { name: "North Carolina statutes and regulations pertinent to life", count: 14, topics: ["S1", "L10"] }
    ]
  },
  health: {
    name: "North Carolina Accident & Health",
    short: "Accident & health",
    minutes: 69,
    pass: 70,
    sections: [
      { name: "Accident & health insurance policies", count: 22, topics: ["H1", "H2", "H3"] },
      { name: "Accident & health insurance provisions", count: 11, topics: ["H4"] },
      { name: "Other accident & health topics", count: 8, topics: ["H5", "H8"] },
      { name: "North Carolina statutes and regulations pertinent to accident & health", count: 14, topics: ["S2", "H6", "H7"] }
    ]
  }
};
