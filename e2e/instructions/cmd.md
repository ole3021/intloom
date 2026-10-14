# CMD entry

Use intloom_command for CLI operations. Commands execute with the pinned Node/bin paths and the isolated --project supplied by the runner. Examples: ["init"], ["workflow","add",workflowArchive], ["start"], ["doctor","--execution","cli"], ["flows"], ["flow",flowName,"--intent",intent], ["artifacts"], ["records"]. start is a top-level command: use ["start"], never ["service","start"]. Start before querying flows. These are usage examples; choose actions from actual results.

Use observe_run to follow the admitted Run, submit_questions for questions and submit_confirmation for confirmation. These typed helpers write the validated answer once to a file and invoke the real CLI answer command. attach only queries. doctor uses --execution cli for this CMD entry; service is the executor, not a doctor entry. Never use another flow to advance waiting execution. Finish after obtaining a terminal or failed/paused diagnostic state.
