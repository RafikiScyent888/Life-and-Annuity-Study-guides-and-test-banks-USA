# Life & Health Exam Prep

Study guides and practice tests for state life and health insurance license exams.

- `content/` shared life and health question banks and study guide sections, used by every state
- `states/<code>/` each state's own law questions (`questions.js`), study guide sections and settings
- `templates/` page templates; `assets/` shared styles and the quiz engine
- `tools/build.ps1` builds the pages: `powershell -ExecutionPolicy Bypass -File tools\build.ps1`

Question IDs are permanent (saved progress uses them). Never reuse or renumber one.
