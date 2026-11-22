# Marketplace

[日本語](marketplace.jp.md)

The marketplace is a page that lists rigs published on GitHub, each opening in the web simulator. It is a separate site from the simulator, at marketplace.mblint.shortarrow.jp.

## Listing

A public repository on GitHub is listed when it carries the topic `mblint-rig`. Adding the topic is all a publisher does; nothing is submitted and nothing is reviewed. A repository loses its place when it drops the topic, becomes private or is deleted, and when it is named in the marketplace's list of excluded repositories.

Each repository is shown with its `<owner>/<repo>`, its description, its number of stars and the date it was last pushed to. The repository's name links to it on GitHub, and a control opens it in the simulator at `https://mblint.shortarrow.jp/?github=<owner>/<repo>`, which loads the root of its default branch as the simulator's address does.

The repositories are ordered by their number of stars, most first. A field narrows them to those whose `<owner>/<repo>` or description contains its text, ignoring case.

What the marketplace shows is at most an hour behind GitHub. The marketplace does not read the repositories' files, so a listed repository may hold no rig the simulator can load; the simulator says so when it is opened.

## Publishing

The page has a section, "Publish your rig", listing the steps:

1. Make a public repository on GitHub, for example from the template ShortArrow/mblint-rigs.
2. Put the files of a rig exported from the simulator at the root of its default branch.
3. Add the topic `mblint-rig` to the repository: on its GitHub page, choose the gear beside About, enter it under Topics and choose Save changes, or run `gh repo edit <owner>/<repo> --add-topic mblint-rig`.
4. Wait up to an hour for the marketplace to list it.

The name of the template links to the template's repository on GitHub, https://github.com/ShortArrow/mblint-rigs.

## Look

The page has a header like the simulator's, naming the marketplace and linking back to the simulator at mblint.shortarrow.jp, and shows each repository as a card. It uses the simulator's colours, and its typefaces, Inter and JetBrains Mono, from Google Fonts as the simulator does. It follows the system's light or dark theme; having no script, it offers no switch between them. It loads nothing from the simulator's site, and does not scroll sideways, however long a repository's name or description. Below the list, it links to the simulator's privacy page at https://mblint.shortarrow.jp/privacy.html.

## Build

The marketplace is a Cloudflare Worker. It asks GitHub's search API for the repositories with the topic, signed in with a token that only reads public data, and keeps the answer for an hour, so a visitor's browser never asks GitHub. When GitHub cannot be reached, it serves the last answer it kept, and says how old that is. When it cannot read the answer it keeps, it says that it is busy and to try again later, and does not ask GitHub. When it has kept no answer and GitHub cannot be reached, it says that GitHub cannot be reached and to try again later.
