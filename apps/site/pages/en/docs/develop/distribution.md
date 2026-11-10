# Verify and share an npm Loom

From the author project with its dependencies available, run `npm run build`. Send the resulting `dist/*.tgz`, a working invocation, an expected result, and the model, tool or system requirements. Ordinary runtime npm dependencies remain in `package.json`. Declare independently installed Looms in `loom.yaml` under `looms`.

Follow [the recipient installation](../start/build) in a directory separate from the source project. Check the selected version, run a valid input, reject an invalid one, export the file and open it. For a model-backed package, verify the real tool call on a configured host. For a staged process, also exercise each required wait and the rejection path.
