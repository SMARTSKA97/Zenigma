# Working notes for Claude

- Branch per batch: `phase-N`, verify with `tsc`, `ng test`, `ng build`, wait for CI, then fast-forward merge into `main` (fetch and pull first).
- Commit trailers: `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>` and the `Claude-Session:` line given in the session.
- **Release notes:** the owner tags releases himself, between chats. Before writing any note, run `scripts/next-notes.sh`. It fetches tags and prints the file for the NEXT version (newest `android-v*` tag, next minor), creating it if needed. Never edit the notes of a version that already has a tag.
- Changes since the newest tag are for the next version: check `git log android-vX.Y.Z..main` if unsure.
