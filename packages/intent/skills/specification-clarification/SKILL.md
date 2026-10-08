---
name: specification-clarification
description: Ask necessary clarification questions, incorporate actual answers and feedback, preserve history, and distinguish blocking questions from deferrable ones.
---

# Clarification and feedback

Read existing questions and feedbacks first. Use established facts and do not ask questions that already have answers.

Submitted question fields are id, question, description?, options?, and isBlock. Use increasing IDs such as QST-1 and QST-2. Options are {id:"QST-1:yes",label,description?}, with unique IDs within each question. Use clear, neutral question and option text. Set isBlock at creation: true requires an answer; false allows skipping.

submit_specification cannot set answer or skipped. Only Clarify Code records actual text returned by Runtime; blocking questions cannot be skipped. answer returned by read_specification is the actual response verbatim. skipped=true means the user skipped the question, not that the user approved deferral or supplied an answer.

Retain all existing questions and their original text, options, descriptions, and isBlock when submitting. Do not delete history or change skip permissions. An existing answer or skipped=true means the user responded; do not store separate resolution or processing flags. Incorporate actual answers into the draft without clearing isBlock. If an answer is insufficient, retain the original question and answer and create a new question; do not ask the answered question again. Unanswered blocking questions cannot become Deferred items.

Skipped nonblocking questions require an explicit Deferred change. Deferred.question must exactly match the original question. Preserve context and impact, and point impact_refs to affected objects; never fabricate answer. Skipping ends this question's interaction in the current Run; it does not resolve the business question or approve a default option. Deferred items remain visible in final confirmation. Do not automatically ask the original question again.

Code preserves feedbacks: user contains the user's original feedback, and check contains actual deterministic validation diagnostics. After reading and processing new feedback, submit processedFeedbackCount equal to the feedbacks.length just read. This processing claim does not replace Check's revalidation.

After submit_specification successfully saves revisions, return clarification_required only when unanswered, unskipped questions remain. Clarify Code initiates interaction; the Agent does not invoke user interaction directly or fabricate waiting success or answers.
