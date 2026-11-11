# Life & Health Exam Prep

Study guides and practice tests for state life and health insurance license exams.

- `content/` shared life and health question banks and study guide sections, used by every state
- `states/<code>/` each state's own law questions (`questions.js`), study guide sections and settings
- `states/<code>/exams.js` the mock exam blueprint: sections, question counts and which topics feed each section, from the state's exam content outline
- `templates/` page templates; `assets/` shared styles, the practice test engine (`quiz.js`) and the mock exam engine (`mock.js`)
- `tools/build.ps1` builds the pages: `powershell -ExecutionPolicy Bypass -File tools\build.ps1`
- `tools/serve.ps1` previews the site at http://localhost:8765/

When writing questions, keep the wrong answers as long and specific as the right one, so the longest option is never a giveaway.

Question IDs are permanent (saved progress uses them). Never reuse or renumber one.

## Master copies (Claude Docs)

Review and edit content in these Docs, then sync the changes into the repo files:

- [Shared core: life and health](https://claude.ai/artifact/Dwq9yKTYyPECyGk2RJynRN) for `content/`
- [North Carolina](https://claude.ai/artifact/BRJSr4UdoEMq7T4pHAnQHN) for `states/nc/`

Each Doc has a Study guide tab, a Test bank tab and a Sources & changelog tab.
